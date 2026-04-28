/**
 * Batesian Mimicry 3D -- Entry Point
 *
 * Sets up the Three.js scene, wires all components together, and
 * manages the survey interaction flow. Desktop first-person with
 * optional WebXR VR support.
 */

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { FieldSetup } from '../FieldSetup.js';
import { WeatherSystem } from '../WeatherSystem.js';
import { EventEngine } from '../EventEngine.js';
import { Salamander } from '../Salamander.js';
import { DEFAULTS, getSeason } from '../config.js';

import { SceneBuilder } from './SceneBuilder.js';
import { CoverObject3D } from './CoverObject3D.js';
import { SalamanderRenderer } from './SalamanderRenderer.js';
import { InputManager } from './InputManager.js';
import { DesktopControls } from './DesktopControls.js';
import { UIManager } from './UIManager.js';


// ── Module state ───────────────────────────────────────────────────

var renderer, scene, camera;
var composer, bloom;
var container, resizeObserver;
var weatherSystem, eventEngine;
var sceneBuilder, inputManager, desktopControls, uiManager;
var salamanderRenderer;
var coverObjects3D = [];
var config = null;
var clock = new THREE.Clock();

// Survey state
var subState = 'surveying';   // surveying | approaching | flipping | identifying | recording | analyzing
var currentObject = null;     // the CoverObject3D being interacted with
var currentAnimal = null;     // Salamander agent (for data)
var currentAnimalMesh = null; // THREE.Group in the scene
var pendingEncounter = null;
var tickCount = 0;
var surveyElapsed = 0;
var tutorialCount = 0;
var totalObjects = 0;

// Event detail text for special events
var EVENT_DETAILS = {
    eggClutch: 'A cluster of small white eggs attached to the underside. A female is brooding nearby. You note the observation and carefully replace the cover.',
    copperhead: 'A copperhead is coiled beneath the cover object. You slowly replace it and mark the location. Safety first.',
    ringneck: 'A small ring-necked snake slithers away. Non-venomous -- you note it and continue.',
    predation: 'A ring-necked snake is consuming a small salamander. A rare observation worth documenting.',
    deadAnimal: 'A desiccated salamander lies motionless. Likely died from exposure or disease. You note the observation.'
};


// ── Initialization ─────────────────────────────────────────────────

function init(parentEl, cfg) {
    container = parentEl;
    config = cfg;
    totalObjects = (parseInt(cfg.coverObjectCount, 10) || 40) * (parseInt(cfg.transectCount, 10) || 2);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;

    var rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, Math.max(rect.height, 500));
    container.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xC4D4C8);
    scene.fog = new THREE.FogExp2(0xC4D4C8, 0.012);

    // Camera -- start at edge of terrain, looking toward center where objects are
    camera = new THREE.PerspectiveCamera(60, rect.width / Math.max(rect.height, 500), 0.1, 200);
    camera.position.set(0, 1.65, 20);
    camera.lookAt(0, 0, 0);

    // Lighting
    var sun = new THREE.DirectionalLight(0xFFF5E0, 1.0);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    scene.add(new THREE.HemisphereLight(0xC4D4C8, 0x6B5B47, 0.9));
    scene.add(new THREE.AmbientLight(0x404040, 0.5));

    // VR button
    if (navigator.xr) {
        container.appendChild(VRButton.createButton(renderer));
    }

    // Post-processing
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    bloom = new UnrealBloomPass(
        new THREE.Vector2(rect.width, rect.height),
        0.15,   // strength -- very subtle
        0.4,    // radius
        0.85    // threshold -- only bright areas bloom
    );
    composer.addPass(bloom);

    composer.addPass(new OutputPass());

    // Simulation systems
    var month = parseInt(cfg.surveyMonth, 10) || DEFAULTS.surveyMonth;
    var day = parseInt(cfg.surveyDay, 10) || DEFAULTS.surveyDay;
    weatherSystem = new WeatherSystem(month, day);
    eventEngine = new EventEngine(cfg, weatherSystem);

    // Scene builder (terrain, trees, ferns, atmosphere)
    sceneBuilder = new SceneBuilder(scene, cfg);
    sceneBuilder.build().then(function() {
        // Scene assets loaded
    }).catch(function(err) {
        console.warn('Some assets failed to load:', err);
    });

    // Salamander renderer
    salamanderRenderer = new SalamanderRenderer();

    // Place cover objects along the transect
    placeCoverObjects(cfg);

    // Input manager
    inputManager = new InputManager(renderer, camera, scene);
    var interactiveObjects = coverObjects3D.map(function (co) { return co.getGroup(); });
    inputManager.setInteractiveObjects(interactiveObjects);
    inputManager.onSelect(handleSelect);

    // Desktop controls
    desktopControls = new DesktopControls(camera, renderer);
    desktopControls.enable();

    // UI manager (HUD, notebook, ID challenge, analysis)
    uiManager = new UIManager(container, cfg);
    uiManager.showCrosshair(true);
    uiManager.onIdentified(handleIdentified);
    uiManager.onRecordSaved(handleRecordSaved);
    uiManager.onEndSurvey(handleEndSurvey);

    // Resize
    resizeObserver = new ResizeObserver(function (entries) {
        var e = entries[0];
        if (!e) return;
        var w = e.contentRect.width;
        var h = Math.max(e.contentRect.height, 500);
        if (w === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
        if (bloom) bloom.resolution.set(w, h);
    });
    resizeObserver.observe(container);

    // Show the keyboard controls guide
    var guideEl = document.getElementById('bm-controls-guide');
    if (guideEl) guideEl.style.display = 'block';

    // Start
    clock.start();
    renderer.setAnimationLoop(animate);
}


// ── Cover Object Placement ─────────────────────────────────────────

function placeCoverObjects(cfg) {
    var count = parseInt(cfg.coverObjectCount, 10) || 40;
    var types = ['rock', 'log', 'board', 'bark'];
    var typeWeights = [0.35, 0.30, 0.20, 0.15];

    // Place objects in a grid pattern within the terrain
    var cols = Math.ceil(Math.sqrt(count));
    var rows = Math.ceil(count / cols);
    var spacingX = 50 / (cols + 1);
    var spacingZ = 50 / (rows + 1);
    var placed = 0;

    var coverGroup = new THREE.Group();
    coverGroup.name = 'CoverObjectGroup';
    scene.add(coverGroup);

    for (var r = 0; r < rows && placed < count; r++) {
        for (var c = 0; c < cols && placed < count; c++) {
            var wx = -25 + spacingX * (c + 1) + (Math.random() - 0.5) * spacingX * 0.5;
            var wz = -25 + spacingZ * (r + 1) + (Math.random() - 0.5) * spacingZ * 0.5;

            // Pick type by weighted random
            var roll = Math.random();
            var cumulative = 0;
            var type = types[0];
            for (var t = 0; t < types.length; t++) {
                cumulative += typeWeights[t];
                if (roll < cumulative) { type = types[t]; break; }
            }

            var quality = betaSample(2, 5);
            var co = new CoverObject3D(placed, type, wx, wz, quality, sceneBuilder.getTerrainHeightAt.bind(sceneBuilder));
            coverObjects3D.push(co);
            coverGroup.add(co.getGroup());
            placed++;
        }
    }
}

function betaSample(a, b) {
    var x = 0;
    for (var i = 0; i < a; i++) x -= Math.log(Math.random());
    var y = 0;
    for (var i = 0; i < b; i++) y -= Math.log(Math.random());
    return x / (x + y);
}


// ── Render Loop ────────────────────────────────────────────────────

function animate() {
    var dt = clock.getDelta();

    // Update desktop controls
    if (desktopControls) {
        desktopControls.update(dt);

        // Terrain following -- keep camera above the ground
        if (sceneBuilder) {
            var pos = camera.position;
            var terrainY = sceneBuilder.getTerrainHeightAt(pos.x, pos.z);
            var standH = 1.65;
            var minY = terrainY + standH;
            if (pos.y < minY) {
                pos.y = minY;
            }
        }
    }

    // Update scene atmosphere (particles, leaves)
    if (sceneBuilder) sceneBuilder.update(dt);

    // Update cover object animations
    for (var i = 0; i < coverObjects3D.length; i++) {
        coverObjects3D[i].updateAnimation(dt);

        // Check if flip animation just completed
        if (coverObjects3D[i] === currentObject && coverObjects3D[i].state === 'uncovered' && subState === 'flipping') {
            onFlipComplete();
        }
    }

    // Update salamander breathing animation
    if (currentAnimalMesh && salamanderRenderer) {
        salamanderRenderer.animate(currentAnimalMesh, dt, 'idle');
    }

    // Update HUD
    if (uiManager && subState !== 'analyzing') {
        var weatherDesc = weatherSystem ? weatherSystem.getDescription() : '';
        var checked = coverObjects3D.filter(function (co) { return co.isChecked(); }).length;
        uiManager.updateHUD(
            weatherDesc,
            'Objects: ' + checked + ' / ' + totalObjects,
            formatSurveyTime()
        );
    }

    // Update input hover highlights
    if (inputManager) inputManager.update();

    // EffectComposer doesn't work in VR -- fall back to direct render
    if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
    } else {
        composer.render();
    }
}


// ── Interaction Handling ───────────────────────────────────────────

function handleSelect(object) {
    if (subState !== 'surveying') return;

    // Find which CoverObject3D was clicked
    var co = findCoverObject(object);
    if (!co || co.isChecked()) return;

    // Flip it
    currentObject = co;
    subState = 'flipping';

    if (!co.flip()) {
        subState = 'surveying';
        currentObject = null;
        return;
    }

    // Generate encounter
    var encounter = eventEngine.generateEncounter({
        type: co.type,
        qualityScore: co.qualityScore
    });
    pendingEncounter = encounter;
    tickCount++;
    surveyElapsed += 1.2;

    // If salamander, create the agent and 3D mesh
    if (encounter.type === 'salamander' && encounter.speciesKeys.length > 0) {
        var key = encounter.speciesKeys[0];
        currentAnimal = new Salamander(key);

        // Create 3D mesh from traits
        currentAnimalMesh = salamanderRenderer.createSalamander(key, currentAnimal.traits);
        co.setAnimal(currentAnimalMesh);
    } else {
        currentAnimal = null;
        currentAnimalMesh = null;
    }
}

function findCoverObject(sceneObject) {
    // Walk up the scene graph to match against cover object groups
    var obj = sceneObject;
    while (obj) {
        for (var i = 0; i < coverObjects3D.length; i++) {
            if (coverObjects3D[i].getGroup() === obj) {
                return coverObjects3D[i];
            }
        }
        obj = obj.parent;
    }
    return null;
}

function onFlipComplete() {
    var encounter = pendingEncounter;
    if (!encounter) { subState = 'surveying'; return; }

    // Special events
    if (encounter.event) {
        var evt = encounter.event;
        if (!evt.detail) evt.detail = EVENT_DETAILS[evt.key] || '';
        uiManager.showEventMessage(evt, function () {
            subState = 'surveying';
            currentObject = null;
            pendingEncounter = null;
            checkSurveyComplete();
        });
        return;
    }

    switch (encounter.type) {
        case 'empty':
        case 'invertebrate':
            uiManager.showMessage(encounter.description || 'Nothing here.');
            subState = 'surveying';
            currentObject = null;
            pendingEncounter = null;
            checkSurveyComplete();
            break;

        case 'salamander':
            if (currentAnimal) {
                subState = 'identifying';
                var diff = config.tutorial && tutorialCount < 3 ? 'guided' : 'standard';
                if (diff === 'guided') tutorialCount++;
                uiManager.showIDChallenge(currentAnimal.traits, diff);
            }
            break;

        case 'snake':
            uiManager.showEventMessage({
                label: encounter.description || 'Snake!',
                detail: 'You carefully replace the cover object and note the location. Safety first.'
            }, function () {
                subState = 'surveying';
                currentObject = null;
                pendingEncounter = null;
                checkSurveyComplete();
            });
            break;

        default:
            uiManager.showMessage(encounter.description || '');
            subState = 'surveying';
            currentObject = null;
            pendingEncounter = null;
            checkSurveyComplete();
            break;
    }
}


// ── ID and Recording ───────────────────────────────────────────────

function handleIdentified(result) {
    subState = 'recording';
    uiManager.hideIDChallenge();

    var weatherConds = weatherSystem.getCurrentConditions();
    uiManager.showNotebook(
        currentAnimal.traits,
        { id: currentObject.id, type: currentObject.type },
        result.selectedSpecies,
        result.isCorrect,
        formatSurveyTime(),
        weatherConds.temperature
    );
}

function handleRecordSaved(rowData) {
    subState = 'surveying';
    uiManager.hideNotebook();
    currentAnimal = null;
    currentAnimalMesh = null;
    currentObject = null;
    pendingEncounter = null;
    checkSurveyComplete();
}

function handleEndSurvey() {
    subState = 'analyzing';

    var accuracy = uiManager.getAccuracyStats();
    var weatherConds = weatherSystem.getCurrentConditions();

    var data = {
        notebookRows: uiManager.getNotebookData(),
        hiddenData: uiManager.getHiddenData(),
        encounterHistory: eventEngine.getEncounterHistory(),
        totalObjects: totalObjects,
        checkedObjects: tickCount,
        weather: {
            description: weatherSystem.getDescription(),
            temperature: weatherConds.temperature,
            humidity: weatherConds.humidity
        },
        accuracy: accuracy
    };

    // Hide the 3D canvas
    renderer.domElement.style.display = 'none';

    uiManager.showAnalysis(data,
        function () { uiManager.downloadCSV(); },
        function () {
            // Reset -- reload the page for simplicity in POC
            window.location.reload();
        }
    );
}


// ── Survey Flow Helpers ────────────────────────────────────────────

function checkSurveyComplete() {
    var checked = coverObjects3D.filter(function (co) { return co.isChecked(); }).length;
    if (checked >= coverObjects3D.length) {
        handleEndSurvey();
    }
}

function formatSurveyTime() {
    var startHour = config.surveyStartHour || DEFAULTS.surveyStartHour;
    var totalMinutes = startHour * 60 + Math.round(surveyElapsed);
    var hours = Math.floor(totalMinutes / 60);
    var mins = totalMinutes % 60;
    return (hours < 10 ? '0' : '') + hours + ':' + (mins < 10 ? '0' : '') + mins;
}


// ── Bootstrap ──────────────────────────────────────────────────────

var containerEl = document.getElementById('bm-simulation-container');

if (containerEl) {
    containerEl.innerHTML = '';

    var configScreen = new FieldSetup({
        onStart: function (cfg) {
            configScreen.destroy();
            configScreen = null;
            init(containerEl, cfg);
        }
    });

    configScreen.mount(containerEl);
}
