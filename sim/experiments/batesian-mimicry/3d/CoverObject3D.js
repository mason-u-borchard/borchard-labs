/**
 * Batesian Mimicry Simulation -- 3D Cover Object
 *
 * Interactive cover objects (rocks, logs, boards, bark) that students
 * flip to discover salamanders underneath. Each object type has distinct
 * procedural geometry, a soil patch revealed on flip, and a pivot-based
 * flip animation that swings the object up from its ground-contact edge.
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';


// -------------------------------------------------------------------
// Size variant ranges per type (meters)
// -------------------------------------------------------------------

var SIZE_RANGES = {
    rock: { radius: [0.12, 0.22] },
    log:  { radiusTop: [0.06, 0.10], radiusBottom: [0.07, 0.12], length: [0.3, 0.6] },
    board: { width: 0.4, height: 0.02, depth: 0.3 },
    bark: { width: 0.2, height: 0.15 }
};


// -------------------------------------------------------------------
// PBR texture loader -- textures are optional, falls back gracefully
// -------------------------------------------------------------------

var textureLoader = new THREE.TextureLoader();
var rockAlbedo = null;
var rockNormal = null;
var barkAlbedo = null;
var barkNormal = null;
var woodAlbedo = null;

var texturesAttempted = false;

function loadPBRTextures(basePath) {
    if (texturesAttempted) return;
    texturesAttempted = true;

    var base = basePath || 'textures/';

    textureLoader.load(base + 'rock_albedo.jpg', function (t) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        rockAlbedo = t;
    }, undefined, function () { /* not found -- use procedural fallback */ });

    textureLoader.load(base + 'rock_normal.jpg', function (t) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        rockNormal = t;
    }, undefined, function () {});

    textureLoader.load(base + 'bark_albedo.jpg', function (t) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        barkAlbedo = t;
    }, undefined, function () {});

    textureLoader.load(base + 'bark_normal.jpg', function (t) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        barkNormal = t;
    }, undefined, function () {});

    textureLoader.load(base + 'wood_albedo.jpg', function (t) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        woodAlbedo = t;
    }, undefined, function () {});
}


// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}


// -------------------------------------------------------------------
// Procedural canvas textures (used when PBR textures aren't available)
// -------------------------------------------------------------------

/**
 * Paint a noise-varied gray rock texture on a canvas.
 * Not uniform -- includes slight green tint on upper region for moss.
 */
function generateRockCanvas(w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');

    // Base: varied gray, not uniform
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var base = 110 + Math.floor(Math.random() * 40);
            // Slight warm/cool variation
            var rShift = Math.floor(Math.random() * 8 - 4);
            var gShift = Math.floor(Math.random() * 8 - 4);
            var bShift = Math.floor(Math.random() * 6 - 3);
            ctx.fillStyle = 'rgb(' + (base + rShift) + ',' + (base + gShift) + ',' + (base + bShift) + ')';
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Larger blotchy variations for realism
    var blotchCount = Math.floor(randRange(8, 16));
    for (var i = 0; i < blotchCount; i++) {
        var bx = randRange(0, w);
        var by = randRange(0, h);
        var br = randRange(w * 0.05, w * 0.2);
        var shade = Math.floor(randRange(-30, 30));
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        if (shade > 0) {
            ctx.fillStyle = 'rgba(255,255,255,' + (shade / 255).toFixed(3) + ')';
        } else {
            ctx.fillStyle = 'rgba(0,0,0,' + (-shade / 255).toFixed(3) + ')';
        }
        ctx.fill();
    }

    // Moss suggestion on upper portion
    var mossGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    mossGrad.addColorStop(0, 'rgba(60, 140, 80, 0.12)');
    mossGrad.addColorStop(1, 'rgba(60, 140, 80, 0)');
    ctx.fillStyle = mossGrad;
    ctx.fillRect(0, 0, w, Math.floor(h * 0.5));

    return canvas;
}

/**
 * Paint a weathered gray wood texture on a canvas.
 */
function generateWeatheredWoodCanvas(w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');

    // Weathered gray-brown base
    ctx.fillStyle = '#9a9080';
    ctx.fillRect(0, 0, w, h);

    // Wood grain lines running along width
    ctx.strokeStyle = 'rgba(60, 50, 40, 0.15)';
    for (var i = 0; i < 40; i++) {
        var gy = randRange(0, h);
        ctx.lineWidth = randRange(0.5, 2);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        for (var x = 0; x < w; x += 20) {
            ctx.lineTo(x, gy + randRange(-1.5, 1.5));
        }
        ctx.stroke();
    }

    // Random darker weathering patches
    for (var i = 0; i < 6; i++) {
        var px = randRange(0, w);
        var py = randRange(0, h);
        var pr = randRange(w * 0.05, w * 0.15);
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(50, 40, 35, 0.12)';
        ctx.fill();
    }

    return canvas;
}


// -------------------------------------------------------------------
// CoverObject3D
// -------------------------------------------------------------------

export class CoverObject3D {

    constructor(id, type, worldX, worldZ, qualityScore, terrainHeightFn) {
        this.id = id;
        this.type = type;
        this.worldX = worldX;
        this.worldZ = worldZ;
        this.qualityScore = qualityScore;
        this.terrainHeightFn = terrainHeightFn;

        this.state = 'covered';    // 'covered' | 'flipping' | 'uncovered'
        this.checked = false;
        this.animal = null;
        this.animalFadeProgress = 0;

        this.flipProgress = 0;
        this.mesh = null;
        this.soilPatch = null;
        this.pivotGroup = null;
        this._decorElements = [];

        // attempt to load PBR textures (no-op if already tried)
        loadPBRTextures();

        // main group -- added to scene's CoverObjectGroup
        this.group = new THREE.Group();
        this.group.name = 'cover_' + id;

        // build everything
        this.createMesh();
        this.createSoilPatch();

        // position at terrain height
        var terrainY = this.terrainHeightFn(this.worldX, this.worldZ);
        this.group.position.set(this.worldX, terrainY, this.worldZ);
    }


    // ---------------------------------------------------------------
    // Mesh creation -- type-specific procedural geometry
    // ---------------------------------------------------------------

    createMesh() {
        switch (this.type) {
            case 'rock':  this._createRock();  break;
            case 'log':   this._createLog();   break;
            case 'board': this._createBoard(); break;
            case 'bark':  this._createBark();  break;
            default:      this._createRock();  break;
        }
    }

    _createRock() {
        var range = SIZE_RANGES.rock;
        var radius = randRange(range.radius[0], range.radius[1]);

        // Higher detail dodecahedron for more irregular displacement
        var geo = new THREE.DodecahedronGeometry(radius, 2);
        var pos = geo.attributes.position;

        // More aggressive vertex displacement for irregularity
        for (var i = 0; i < pos.count; i++) {
            var vx = pos.getX(i);
            var vy = pos.getY(i);
            var vz = pos.getZ(i);
            // Layer two frequencies for natural rock shape
            var offset1 = Math.sin(vx * 5) * Math.cos(vz * 3) * 0.035;
            var offset2 = Math.sin(vx * 11 + vz * 7) * 0.015;
            var combined = offset1 + offset2;
            pos.setX(i, vx + combined);
            pos.setY(i, vy + combined * 0.5);
            pos.setZ(i, vz + combined * 0.7);
        }

        // flatten the bottom slightly so it sits on ground
        for (var i = 0; i < pos.count; i++) {
            var y = pos.getY(i);
            if (y < -radius * 0.3) {
                pos.setY(i, -radius * 0.3 + (y + radius * 0.3) * 0.3);
            }
        }

        geo.computeVertexNormals();

        // add moss tinting via vertex colors on upward-facing vertices
        var colors = new Float32Array(pos.count * 3);
        var normal = geo.attributes.normal;

        for (var i = 0; i < pos.count; i++) {
            var ny = normal.getY(i);
            var mossFactor = Math.max(0, ny) * 0.35;
            // Noise-varied gray base per vertex instead of uniform #888
            var grayBase = 0.45 + Math.random() * 0.18;
            var baseR = grayBase + randRange(-0.03, 0.03);
            var baseG = grayBase + randRange(-0.03, 0.03);
            var baseB = grayBase + randRange(-0.02, 0.02);
            var mossR = 0x52 / 255, mossG = 0xb7 / 255, mossB = 0x88 / 255;
            colors[i * 3]     = lerp(baseR, mossR, mossFactor);
            colors[i * 3 + 1] = lerp(baseG, mossG, mossFactor);
            colors[i * 3 + 2] = lerp(baseB, mossB, mossFactor);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        var mat;
        if (rockAlbedo) {
            mat = new THREE.MeshStandardMaterial({
                map: rockAlbedo,
                normalMap: rockNormal || null,
                vertexColors: true,
                roughness: 0.75,
                metalness: 0.0
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                vertexColors: true,
                roughness: 0.75,
                metalness: 0.0
            });
        }

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'rock_mesh_' + this.id;

        // offset mesh so bottom edge is at y=0 within the pivot
        this.mesh.position.y = radius * 0.3;

        this._extents = { radius: radius, height: radius * 0.6 };
        this._setupPivot();
    }

    _createLog() {
        var range = SIZE_RANGES.log;
        var rTop = randRange(range.radiusTop[0], range.radiusTop[1]);
        var rBot = randRange(range.radiusBottom[0], range.radiusBottom[1]);
        var len = randRange(range.length[0], range.length[1]);

        var geo = new THREE.CylinderGeometry(rTop, rBot, len, 12);

        // Vertex colors for moss on the upward-facing surface
        var pos = geo.attributes.position;
        var normals = geo.attributes.normal;
        var colors = new Float32Array(pos.count * 3);

        var barkR = 0x6b / 255, barkG = 0x42 / 255, barkB = 0x26 / 255;
        var mossR = 0x48 / 255, mossG = 0x90 / 255, mossB = 0x58 / 255;

        for (var i = 0; i < pos.count; i++) {
            var ny = normals.getY(i);
            // Cylinder lies on its side after rotation, so check the
            // direction that will face up after rotating Z by PI/2.
            // Before rotation, the "up" of the log cylinder is the radial
            // direction, so we use the vertex normal's Y component pre-rotation.
            var mossFactor = Math.max(0, ny) * 0.40;
            colors[i * 3]     = lerp(barkR, mossR, mossFactor) + randRange(-0.02, 0.02);
            colors[i * 3 + 1] = lerp(barkG, mossG, mossFactor) + randRange(-0.02, 0.02);
            colors[i * 3 + 2] = lerp(barkB, mossB, mossFactor) + randRange(-0.01, 0.01);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        var mat;
        if (barkAlbedo) {
            mat = new THREE.MeshStandardMaterial({
                map: barkAlbedo,
                normalMap: barkNormal || null,
                vertexColors: true,
                roughness: 0.85,
                metalness: 0.0
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                vertexColors: true,
                roughness: 0.85,
                metalness: 0.0
            });
        }

        this.mesh = new THREE.Mesh(geo, mat);

        // rotate to lie on side (cylinder axis -> X axis)
        this.mesh.rotation.z = Math.PI / 2;

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'log_mesh_' + this.id;

        // position so it rests on the ground
        this.mesh.position.y = rBot;

        // add ring detail on the cut end
        this._addLogRings(rTop, len);

        this._extents = { radius: Math.max(rTop, rBot), height: rBot * 2, length: len };
        this._setupPivot();
    }

    _addLogRings(radius, length) {
        var ringGroup = new THREE.Group();
        var ringMat = new THREE.MeshStandardMaterial({
            color: 0x8B6914,
            roughness: 0.7,
            metalness: 0.0
        });

        // concentric rings on the cut face
        for (var r = 0; r < 4; r++) {
            var ringRadius = radius * (0.3 + r * 0.18);
            var ringGeo = new THREE.RingGeometry(ringRadius - 0.003, ringRadius + 0.003, 16);
            var ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.y = Math.PI / 2;
            ring.position.x = length / 2 + 0.001;
            ring.castShadow = false;
            ring.receiveShadow = true;
            ringGroup.add(ring);
        }

        this.mesh.add(ringGroup);
    }

    _createBoard() {
        var s = SIZE_RANGES.board;
        var geo = new THREE.BoxGeometry(s.width, s.height, s.depth, 8, 1, 6);
        var pos = geo.attributes.position;

        // warp top vertices slightly for weathered look
        for (var i = 0; i < pos.count; i++) {
            var y = pos.getY(i);
            if (y > 0) {
                var x = pos.getX(i);
                var z = pos.getZ(i);
                var warp = Math.sin(x * 8) * Math.cos(z * 6) * 0.004;
                pos.setY(i, y + warp + (Math.random() - 0.5) * 0.002);
            }
        }
        geo.computeVertexNormals();

        var mat;
        if (woodAlbedo) {
            mat = new THREE.MeshStandardMaterial({
                map: woodAlbedo,
                roughness: 0.75,
                metalness: 0.0
            });
        } else {
            // Weathered gray board -- not fresh wood
            var boardCanvas = generateWeatheredWoodCanvas(128, 128);
            var boardTex = new THREE.CanvasTexture(boardCanvas);
            boardTex.colorSpace = THREE.SRGBColorSpace;
            mat = new THREE.MeshStandardMaterial({
                map: boardTex,
                roughness: 0.75,
                metalness: 0.0
            });
        }

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'board_mesh_' + this.id;

        // sit on ground -- half height up
        this.mesh.position.y = s.height / 2;

        this._extents = { radius: Math.max(s.width, s.depth) * 0.5, height: s.height };
        this._setupPivot();
    }

    _createBark() {
        var s = SIZE_RANGES.bark;
        var geo = new THREE.PlaneGeometry(s.width, s.height, 6, 4);
        var pos = geo.attributes.position;

        // curve the center vertices outward for a natural bark curl
        for (var i = 0; i < pos.count; i++) {
            var x = pos.getX(i);
            var y = pos.getY(i);
            var distFromCenter = Math.sqrt(x * x + y * y);
            var maxDist = Math.sqrt(s.width * s.width + s.height * s.height) * 0.5;
            var curvature = (1 - distFromCenter / maxDist) * 0.025;
            pos.setZ(i, curvature);
        }
        geo.computeVertexNormals();

        var mat;
        if (barkAlbedo) {
            mat = new THREE.MeshStandardMaterial({
                map: barkAlbedo,
                normalMap: barkNormal || null,
                roughness: 0.8,
                metalness: 0.0,
                side: THREE.DoubleSide
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: 0x8a6b42,
                roughness: 0.8,
                metalness: 0.0,
                side: THREE.DoubleSide
            });
        }

        this.mesh = new THREE.Mesh(geo, mat);

        // lay flat on ground
        this.mesh.rotation.x = -Math.PI / 2;

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'bark_mesh_' + this.id;

        this.mesh.position.y = 0.01;

        this._extents = { radius: Math.max(s.width, s.height) * 0.5, height: 0.025 };
        this._setupPivot();
    }


    // ---------------------------------------------------------------
    // Pivot group -- allows rotation from the bottom edge
    // ---------------------------------------------------------------

    _setupPivot() {
        // pivot sits at ground level at one edge of the object
        // the mesh is parented to it so rotating the pivot swings
        // the mesh up from that edge
        this.pivotGroup = new THREE.Group();
        this.pivotGroup.name = 'pivot_' + this.id;

        // offset pivot to the -Z edge of the object
        var offsetZ = (this._extents.radius || 0.1) * 0.8;
        this.pivotGroup.position.set(0, 0, -offsetZ);

        // move mesh so its center is offset from pivot origin
        this.mesh.position.z = (this.mesh.position.z || 0) + offsetZ;

        this.pivotGroup.add(this.mesh);
        this.group.add(this.pivotGroup);
    }


    // ---------------------------------------------------------------
    // Soil patch -- dark disc revealed under flipped object
    // ---------------------------------------------------------------

    createSoilPatch() {
        var patchRadius = (this._extents.radius || 0.15) * 1.2;
        var geo = new THREE.CircleGeometry(patchRadius, 16);
        geo.rotateX(-Math.PI / 2);

        // Very dark, wet-looking soil
        var mat = new THREE.MeshStandardMaterial({
            color: 0x1a1208,
            roughness: 0.25,
            metalness: 0.0
        });

        this.soilPatch = new THREE.Mesh(geo, mat);
        this.soilPatch.receiveShadow = true;
        this.soilPatch.position.y = 0.002;  // just above terrain to avoid z-fight
        this.soilPatch.visible = false;
        this.soilPatch.name = 'soil_' + this.id;

        this.group.add(this.soilPatch);
    }


    // ---------------------------------------------------------------
    // Decorative elements on soil patch (invertebrate props)
    // ---------------------------------------------------------------

    _addSoilDecor() {
        var patchRadius = (this._extents.radius || 0.15) * 0.8;

        // Pill bug -- small gray sphere
        var pillGeo = new THREE.SphereGeometry(0.006, 6, 4);
        pillGeo.scale(1.0, 0.5, 1.4);  // flatten and elongate
        var pillMat = new THREE.MeshStandardMaterial({
            color: 0x707070,
            roughness: 0.6,
            metalness: 0.05
        });
        var pillBug = new THREE.Mesh(pillGeo, pillMat);
        pillBug.position.set(
            randRange(-patchRadius * 0.5, patchRadius * 0.5),
            0.005,
            randRange(-patchRadius * 0.3, patchRadius * 0.3)
        );
        pillBug.rotation.y = randRange(0, Math.PI * 2);
        pillBug.castShadow = true;
        this.group.add(pillBug);
        this._decorElements.push(pillBug);

        // Earthworm -- thin brown cylinder curved slightly
        var wormLength = randRange(0.03, 0.05);
        var wormGeo = new THREE.CylinderGeometry(0.002, 0.0015, wormLength, 5, 3);
        var wormPos = wormGeo.attributes.position;
        // Add slight S-curve
        for (var i = 0; i < wormPos.count; i++) {
            var wy = wormPos.getY(i);
            var waveFactor = Math.sin((wy / wormLength) * Math.PI * 2) * 0.004;
            wormPos.setX(i, wormPos.getX(i) + waveFactor);
        }
        wormGeo.computeVertexNormals();

        var wormMat = new THREE.MeshStandardMaterial({
            color: 0x8b5a3c,
            roughness: 0.4,
            metalness: 0.0
        });
        var worm = new THREE.Mesh(wormGeo, wormMat);
        worm.position.set(
            randRange(-patchRadius * 0.4, patchRadius * 0.4),
            0.004,
            randRange(-patchRadius * 0.4, patchRadius * 0.4)
        );
        worm.rotation.z = Math.PI / 2;  // lay flat
        worm.rotation.y = randRange(0, Math.PI * 2);
        worm.castShadow = true;
        this.group.add(worm);
        this._decorElements.push(worm);

        // Second pill bug (smaller, positioned differently)
        var pill2Geo = new THREE.SphereGeometry(0.004, 6, 4);
        pill2Geo.scale(1.0, 0.5, 1.3);
        var pill2 = new THREE.Mesh(pill2Geo, pillMat);
        pill2.position.set(
            randRange(-patchRadius * 0.6, patchRadius * 0.6),
            0.004,
            randRange(-patchRadius * 0.5, patchRadius * 0.5)
        );
        pill2.rotation.y = randRange(0, Math.PI * 2);
        pill2.castShadow = true;
        this.group.add(pill2);
        this._decorElements.push(pill2);

        // Hide until flip completes
        for (var d = 0; d < this._decorElements.length; d++) {
            this._decorElements[d].visible = false;
        }
    }


    // ---------------------------------------------------------------
    // Highlight -- emissive glow on hover / approach
    // ---------------------------------------------------------------

    createHighlight() {
        // handled inline via setHighlight -- no extra mesh needed
    }

    setHighlight(on) {
        if (!this.mesh || !this.mesh.material) return;
        if (on) {
            this.mesh.material.emissive = new THREE.Color(0xb8860b);
            this.mesh.material.emissiveIntensity = 0.3;
        } else {
            this.mesh.material.emissive = new THREE.Color(0x000000);
            this.mesh.material.emissiveIntensity = 0;
        }
    }


    // ---------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------

    getGroup() {
        return this.group;
    }

    isChecked() {
        return this.checked;
    }


    // ---------------------------------------------------------------
    // Flip
    // ---------------------------------------------------------------

    flip() {
        if (this.state === 'flipping' || this.state === 'uncovered') {
            return false;
        }
        this.state = 'flipping';
        this.flipProgress = 0;

        // Create soil decor now so it's ready when flip completes
        if (this._decorElements.length === 0) {
            this._addSoilDecor();
        }

        return true;
    }


    // ---------------------------------------------------------------
    // Animation update -- call each frame with delta time in seconds
    // ---------------------------------------------------------------

    updateAnimation(dt) {
        // flip animation
        if (this.state === 'flipping') {
            this.flipProgress += dt / 0.6;  // 600ms total

            var t = Math.min(this.flipProgress, 1);
            var eased = easeOutCubic(t);

            // rotate pivot around X axis -- swings the object up from its edge
            this.pivotGroup.rotation.x = eased * Math.PI / 2;

            // slight lateral translation so it "lands" to the side
            this.pivotGroup.position.z = this.pivotGroup.position.z;
            this.mesh.position.x = eased * (this._extents.radius || 0.1) * 0.6;

            if (this.flipProgress >= 1) {
                this.flipProgress = 1;
                this.state = 'uncovered';
                this.checked = true;
                this.soilPatch.visible = true;

                // Show decorative invertebrates
                for (var d = 0; d < this._decorElements.length; d++) {
                    this._decorElements[d].visible = true;
                }

                // start animal fade-in if one is set
                if (this.animal) {
                    this.animal.visible = true;
                    this.animal.material.opacity = 0;
                    this.animal.material.transparent = true;
                    this.animalFadeProgress = 0;
                }
            }
        }

        // animal fade-in after flip completes
        if (this.state === 'uncovered' && this.animal && this.animalFadeProgress < 1) {
            this.animalFadeProgress += dt / 0.3;  // 300ms fade
            if (this.animalFadeProgress > 1) this.animalFadeProgress = 1;
            this.animal.material.opacity = this.animalFadeProgress;
            if (this.animalFadeProgress >= 1) {
                this.animal.material.transparent = false;
            }
        }
    }


    // ---------------------------------------------------------------
    // Animal attachment
    // ---------------------------------------------------------------

    setAnimal(salamanderMesh) {
        this.animal = salamanderMesh;
        this.animal.visible = false;

        // position on the soil patch
        this.animal.position.set(0, 0.01, 0);
        this.group.add(this.animal);
    }


    // ---------------------------------------------------------------
    // Hit testing
    // ---------------------------------------------------------------

    hitTest(raycaster) {
        if (this.state === 'uncovered') return false;
        var intersects = raycaster.intersectObject(this.mesh, true);
        return intersects.length > 0;
    }


    // ---------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------

    dispose() {
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (this.mesh.material.map) this.mesh.material.map.dispose();
                if (this.mesh.material.normalMap) this.mesh.material.normalMap.dispose();
                this.mesh.material.dispose();
            }
            // dispose child meshes (log rings, etc.)
            this.mesh.traverse(function (child) {
                if (child !== this.mesh && child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            }.bind(this));
        }
        if (this.soilPatch) {
            if (this.soilPatch.geometry) this.soilPatch.geometry.dispose();
            if (this.soilPatch.material) this.soilPatch.material.dispose();
        }
        // Dispose decorative elements
        for (var d = 0; d < this._decorElements.length; d++) {
            var el = this._decorElements[d];
            if (el.geometry) el.geometry.dispose();
            if (el.material) el.material.dispose();
        }
        this._decorElements = [];

        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
    }
}
