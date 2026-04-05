/**
 * BatesianMimicrySim -- main orchestrator for the field survey simulation.
 *
 * Extends Simulation to manage a player-driven survey where the student
 * flips cover objects, identifies salamanders, and records field data.
 *
 * Uses a three-view camera system:
 *   Transect (wide) -> Approach (medium) -> Examination (close-up)
 * Views transition smoothly via the ViewManager.
 */

import { Simulation } from '../../engine/Simulation.js';
import { ForestEnvironment } from './ForestEnvironment.js';
import { EventEngine } from './EventEngine.js';
import { Salamander } from './Salamander.js';
import { FieldNotebook } from './FieldNotebook.js';
import { IdentificationChallenge } from './IdentificationChallenge.js';
import { AnalysisPanel } from './AnalysisPanel.js';
import { ViewManager } from './ViewManager.js';
import { ParticleSystem } from './ParticleSystem.js';
import { SPECIES, DEFAULTS, getSeason } from './config.js';


export class BatesianMimicrySim extends Simulation {

    init() {
        super.init();

        var cfg = this._config;
        this.maxTicks = 0;
        this._totalObjects = (parseInt(cfg.coverObjectCount, 10) || 40) * (parseInt(cfg.transectCount, 10) || 2);

        // Sub-state within the engine's 'running' state
        this.subState = 'surveying';
        this._currentTransect = 1;
        this._surveyStartTime = null;
        this._surveyElapsed = 0;
        this._pendingAnimal = null;
        this._pendingCoverObj = null;
        this._pendingEncounter = null;
        this._difficulty = cfg.tutorial ? 'guided' : 'standard';
        this._tutorialCount = 0;
        this._animatingFlip = false;
        this._flipObj = null;
        this._lastFrameTime = 0;

        // View manager (three-view camera system)
        this._viewManager = new ViewManager(this.canvas.width, this.canvas.height);

        // Particle system (ambient atmosphere)
        var month = parseInt(cfg.surveyMonth, 10) || 4;
        var season = getSeason(month);
        this._particles = new ParticleSystem(this.canvas.width, this.canvas.height, season);

        // Environment
        this.environment = new ForestEnvironment(cfg);
        this.environment.generateTransect(this.canvas.width, this.canvas.height);

        // Event engine
        this._eventEngine = new EventEngine(cfg, this.environment.weatherSystem);

        // Field notebook
        this._notebook = new FieldNotebook();
        this._notebook.mount(this._container);
        this._notebook.onSave(this._onRecordSaved.bind(this));

        // ID challenge (constructor calls mount internally)
        this._idChallenge = new IdentificationChallenge(this._container);
        this._idChallenge.onSubmit(this._onIdentified.bind(this));

        // Analysis panel (created but not mounted until needed)
        this._analysis = new AnalysisPanel(this._container);

        // Field HUD
        this._buildFieldHUD();

        // Canvas click handler
        this._boundClick = this._handleCanvasClick.bind(this);
        this.canvas.addEventListener('click', this._boundClick);
        this.canvas.style.cursor = 'pointer';

        // Keyboard shortcuts
        this._boundKeydown = this._handleKeydown.bind(this);
        document.addEventListener('keydown', this._boundKeydown);
    }

    /**
     * Override start() to enter running state with render-only loop.
     */
    start() {
        if (this.state !== 'setup') return;
        this._setState('running');
        this.subState = 'surveying';
        this._surveyStartTime = performance.now();
        this._lastFrameTime = performance.now();
        this._rafId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Override _loop -- render-only, no auto-advancing ticks.
     */
    _loop(now) {
        if (this.state !== 'running') return;

        // Calculate delta time for particles
        var dt = (now - this._lastFrameTime) / 1000;
        this._lastFrameTime = now;
        if (dt > 0.1) dt = 0.016; // cap at ~60fps equivalent if tab was inactive

        // Update view transitions
        this._viewManager.update(now);

        // Update particles
        this._particles.update(dt);

        this.render();
        this._rafId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Override tick() -- no-op, ticks are manual.
     */
    tick() {}

    /**
     * Main render -- draws the scene through the camera transform.
     */
    render() {
        var w = this.canvas.width;
        var h = this.canvas.height;
        var ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        if (this.subState === 'analyzing') return;

        // Apply camera transform
        this._viewManager.applyTransform(ctx);

        // Draw forest floor and cover objects (in world coordinates)
        if (this.environment) {
            this.environment.render(ctx, w, h);
        }

        // Draw visible animals on uncovered objects
        var objects = this.environment.getCoverObjects();
        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];
            if (obj.state === 'uncovered' && obj.animal) {
                var pos = obj.getRevealPosition();
                obj.animal.x = pos.x;
                obj.animal.y = pos.y;
                obj.animal.render(ctx);
            }
        }

        // Flip animation
        if (this._animatingFlip && this._flipObj) {
            this._flipObj.updateAnimation(performance.now());
            if (this._flipObj.state === 'uncovered') {
                this._onFlipComplete();
            }
        }

        // Reset transform for screen-space overlays
        this._viewManager.resetTransform(ctx);

        // Progress bar (screen-space)
        this.environment.renderProgressBar(ctx, w, h);

        // Particles (screen-space, float on top)
        this._particles.render(ctx);

        // Update HTML HUD
        this._updateFieldHUD();
    }

    // ── Click handling ─────────────────────────────────────────────────

    _handleCanvasClick(e) {
        if (this.state !== 'running') return;
        if (this._viewManager.isTransitioning()) return;
        if (this._animatingFlip) return;

        var rect = this.canvas.getBoundingClientRect();
        var scaleX = this.canvas.width / rect.width;
        var scaleY = this.canvas.height / rect.height;
        var sx = (e.clientX - rect.left) * scaleX;
        var sy = (e.clientY - rect.top) * scaleY;

        var currentView = this._viewManager.getCurrentView();

        if (currentView === 'transect' && this.subState === 'surveying') {
            // In transect view -- convert to world coords and find a cover object
            var world = this._viewManager.screenToWorld(sx, sy);
            var obj = this.environment.getObjectAt(world.x, world.y);
            if (!obj) return;

            // Transition to approach view, then wait for another click to flip
            this._pendingCoverObj = obj;
            this.canvas.style.cursor = 'grab';
            this._particles.setViewMode('approach');
            this._viewManager.setView('approach', obj);

        } else if (currentView === 'approach' && this.subState === 'surveying') {
            // In approach view -- any click flips the focused object.
            // The student already chose this object from the transect view;
            // requiring a second precision click is frustrating.
            // Use Escape to back out without flipping.
            var obj = this._pendingCoverObj;
            if (obj) {
                this.canvas.style.cursor = 'grabbing';
                this._flipCoverObject(obj);
            }
        }
    }

    // ── Flip and encounter logic ───────────────────────────────────────

    _flipCoverObject(obj) {
        if (!obj.flip()) return;

        this._animatingFlip = true;
        this._flipObj = obj;

        var encounter = this._eventEngine.generateEncounter(obj);
        this._pendingEncounter = encounter;

        if (encounter.type === 'salamander' && encounter.speciesKeys.length > 0) {
            var key = encounter.speciesKeys[0];
            var animal = new Salamander(key);
            obj.setAnimal(animal);
            this._pendingAnimal = animal;
        } else {
            this._pendingAnimal = null;
        }

        this.tickCount++;
        this._surveyElapsed += 1.2;
        this.emit('tick', this.tickCount);
    }

    _onFlipComplete() {
        var encounter = this._pendingEncounter;
        if (!encounter) return;

        this._animatingFlip = false;
        this._flipObj = null;

        // Use _pendingCoverObj since flippedObj may be stale after clearing _flipObj
        var obj = this._pendingCoverObj;

        if (encounter.event) {
            var evt = encounter.event;
            // Add descriptive detail if the event object doesn't have one
            if (!evt.detail) {
                var details = {
                    eggClutch: 'A cluster of small white eggs attached to the underside of the cover object. A female is brooding nearby. You note the observation and carefully replace the cover.',
                    copperhead: 'A copperhead is coiled beneath the cover object. You slowly replace it and mark the location. Safety first.',
                    ringneck: 'A small ring-necked snake slithers away as you lift the cover. Non-venomous -- you note it and continue.',
                    predation: 'A ring-necked snake is in the process of consuming a small salamander. A rare observation worth documenting.',
                    deadAnimal: 'A desiccated salamander lies motionless on the soil. Likely died from exposure or disease. You note the observation.'
                };
                evt.detail = details[evt.key] || '';
            }
            this._showEventMessage(evt);
            return;
        }

        var self = this;

        switch (encounter.type) {
            case 'empty':
            case 'invertebrate':
                this._showBriefMessage(encounter.description || 'Nothing here.');
                // Zoom back to transect after a brief pause
                setTimeout(function () {
                    self.canvas.style.cursor = 'pointer';
                    self._particles.setViewMode('transect');
                    self._viewManager.setView('transect', null, function () {
                        self._pendingCoverObj = null;
                        self._checkSurveyComplete();
                    });
                }, 800);
                break;

            case 'salamander':
                if (this._pendingAnimal) {
                    // Zoom to examination view, then show ID challenge
                    this._particles.setViewMode('examination');
                    this._viewManager.setView('examination', obj, function () {
                        self._setSubState('identifying');
                        var diff = self._difficulty;
                        if (self._config.tutorial && self._tutorialCount < 3) {
                            diff = 'guided';
                            self._tutorialCount++;
                        }
                        self.canvas.style.cursor = 'crosshair';
                        self._idChallenge.show(self._pendingAnimal, diff);
                    });
                }
                break;

            case 'snake':
                this._showEventMessage({
                    label: encounter.description || 'Snake!',
                    detail: 'You carefully replace the cover object and note the location. Safety first.'
                });
                break;

            default:
                this._showBriefMessage(encounter.description || '');
                setTimeout(function () {
                    self._particles.setViewMode('transect');
                    self._viewManager.setView('transect', null, function () {
                        self._pendingCoverObj = null;
                        self._checkSurveyComplete();
                    });
                }, 800);
                break;
        }
    }

    // ── ID and recording callbacks ─────────────────────────────────────

    _onIdentified(result) {
        this._setSubState('recording');

        var weather = this.environment.getWeather();
        var surveyTime = this._formatSurveyTime();

        this._notebook.openEntryForm(
            this._pendingAnimal,
            this._pendingCoverObj,
            result.selectedSpecies,
            result.isCorrect,
            surveyTime,
            weather.temperature
        );
    }

    _onRecordSaved(rowData) {
        var self = this;

        // Zoom back: examination -> approach -> transect
        this._particles.setViewMode('approach');
        this._viewManager.setView('approach', this._pendingCoverObj, function () {
            self._particles.setViewMode('transect');
            self._viewManager.setView('transect', null, function () {
                self._pendingAnimal = null;
                self._pendingCoverObj = null;
                self._pendingEncounter = null;
                self.canvas.style.cursor = 'pointer';
                self._setSubState('surveying');
                self._checkSurveyComplete();
            });
        });
    }

    // ── Survey flow ────────────────────────────────────────────────────

    _checkSurveyComplete() {
        var progress = this.environment.getProgress();

        if (progress.checked >= progress.total) {
            if (this._currentTransect < (parseInt(this._config.transectCount, 10) || 2)) {
                this._currentTransect++;
                this.environment.generateTransect(this.canvas.width, this.canvas.height);
                this._showBriefMessage('Moving to transect ' + this._currentTransect + '...');
            } else {
                this._endSurvey();
            }
        }
    }

    _endSurvey() {
        this._setSubState('reviewing');

        var accuracy = this._idChallenge.getAccuracyStats();
        var weather = this.environment.getWeather();

        var data = {
            notebookRows: this._notebook.getTable(),
            hiddenData: this._notebook._hiddenData || [],
            encounterHistory: this._eventEngine.getEncounterHistory(),
            totalObjects: this._totalObjects,
            checkedObjects: this.tickCount,
            weather: {
                description: this.environment.weatherSystem.getDescription(),
                temperature: weather.temperature,
                humidity: weather.humidity
            },
            accuracy: accuracy
        };

        this.canvas.style.display = 'none';
        if (this._hudEl) this._hudEl.style.display = 'none';

        this._analysis.load(data);
        this._analysis.mount(this._container);

        this._analysis.onDownload(function () {
            this._notebook.download();
        }.bind(this));

        this._analysis.onNewSurvey(function () {
            this.reset();
        }.bind(this));

        this._setSubState('analyzing');
    }

    // ── Sub-state management ───────────────────────────────────────────

    _setSubState(newSubState) {
        var prev = this.subState;
        this.subState = newSubState;
        this.emit('subStateChange', { from: prev, to: newSubState });
    }

    _formatSurveyTime() {
        var startHour = this._config.surveyStartHour || DEFAULTS.surveyStartHour;
        var totalMinutes = startHour * 60 + Math.round(this._surveyElapsed);
        var hours = Math.floor(totalMinutes / 60);
        var mins = totalMinutes % 60;
        return (hours < 10 ? '0' : '') + hours + ':' + (mins < 10 ? '0' : '') + mins;
    }

    // ── UI messages ────────────────────────────────────────────────────

    _showBriefMessage(text) {
        if (!text) return;

        var msgEl = document.createElement('div');
        msgEl.textContent = text;
        msgEl.style.cssText = [
            'position: absolute',
            'bottom: 40px',
            'left: 50%',
            'transform: translateX(-50%)',
            'background: rgba(43, 43, 43, 0.85)',
            'color: #faf8f4',
            'padding: 8px 20px',
            'border-radius: 6px',
            'font-family: "Source Sans 3", sans-serif',
            'font-size: 0.9rem',
            'pointer-events: none',
            'z-index: 10',
            'transition: opacity 0.4s ease'
        ].join('; ');

        this._container.style.position = 'relative';
        this._container.appendChild(msgEl);

        setTimeout(function () {
            msgEl.style.opacity = '0';
            setTimeout(function () {
                if (msgEl.parentNode) msgEl.parentNode.removeChild(msgEl);
            }, 400);
        }, 1500);
    }

    _showEventMessage(event) {
        var msgEl = document.createElement('div');
        msgEl.style.cssText = [
            'position: absolute',
            'top: 50%',
            'left: 50%',
            'transform: translate(-50%, -50%)',
            'background: #faf8f4',
            'border: 2px solid #bc4749',
            'padding: 24px 32px',
            'border-radius: 12px',
            'box-shadow: 0 8px 32px rgba(43, 43, 43, 0.2)',
            'z-index: 20',
            'max-width: 400px',
            'text-align: center',
            'font-family: "Source Sans 3", sans-serif'
        ].join('; ');

        var title = document.createElement('h4');
        title.textContent = event.label || 'Event';
        title.style.cssText = 'font-family: Merriweather, serif; margin-bottom: 8px; color: #bc4749;';

        var detail = document.createElement('p');
        detail.textContent = event.detail || '';
        detail.style.cssText = 'color: #555; font-size: 0.95rem; margin-bottom: 16px;';

        var btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = 'Continue';
        var self = this;
        btn.addEventListener('click', function () {
            if (msgEl.parentNode) msgEl.parentNode.removeChild(msgEl);
            // Zoom back to transect after event
            self._particles.setViewMode('transect');
            self._viewManager.setView('transect', null, function () {
                self._pendingCoverObj = null;
                self.canvas.style.cursor = 'pointer';
                self._checkSurveyComplete();
            });
        });

        msgEl.appendChild(title);
        msgEl.appendChild(detail);
        msgEl.appendChild(btn);

        this._container.style.position = 'relative';
        this._container.appendChild(msgEl);
    }

    // ── Field HUD ──────────────────────────────────────────────────────

    _buildFieldHUD() {
        var el = document.createElement('div');
        el.className = 'field-hud';
        el.style.cssText = [
            'display: flex',
            'justify-content: space-between',
            'align-items: center',
            'padding: 8px 16px',
            'background: rgba(250, 248, 244, 0.92)',
            'border-bottom: 1px solid #d4cec4',
            'font-family: "Source Sans 3", sans-serif',
            'font-size: 0.85rem',
            'color: #555',
            'gap: 16px',
            'flex-wrap: wrap'
        ].join('; ');

        this._hudWeather = document.createElement('span');
        this._hudProgress = document.createElement('span');
        this._hudProgress.style.fontFamily = '"Fira Code", Consolas, monospace';
        this._hudTime = document.createElement('span');
        this._hudTime.style.fontFamily = '"Fira Code", Consolas, monospace';

        var endBtn = document.createElement('button');
        endBtn.className = 'btn btn-sm btn-ghost';
        endBtn.textContent = 'End Survey';
        endBtn.style.cssText = 'margin-left: auto; padding: 4px 12px; font-size: 0.8rem;';
        var self = this;
        endBtn.addEventListener('click', function () {
            if (self.subState === 'surveying') {
                self._endSurvey();
            }
        });

        el.appendChild(this._hudWeather);
        el.appendChild(this._hudProgress);
        el.appendChild(this._hudTime);
        el.appendChild(endBtn);

        this._container.insertBefore(el, this.canvas);
        this._hudEl = el;
    }

    _updateFieldHUD() {
        if (!this._hudWeather) return;
        this._hudWeather.textContent = this.environment.weatherSystem.getDescription();

        var progress = this.environment.getProgress();
        var totalProgress = ((this._currentTransect - 1) * (parseInt(this._config.coverObjectCount, 10) || 40)) + progress.checked;
        this._hudProgress.textContent = 'Objects: ' + totalProgress + ' / ' + this._totalObjects;

        this._hudTime.textContent = this._formatSurveyTime();
    }

    // ── Keyboard ───────────────────────────────────────────────────────

    _handleKeydown(e) {
        if (this.state !== 'running') return;

        if (e.key === 'Escape') {
            if (this.subState === 'identifying') {
                this._idChallenge.hide();
                if (this._pendingCoverObj && this._pendingCoverObj.animal) {
                    this._pendingCoverObj.animal = null;
                }
                this._pendingAnimal = null;
                this._pendingEncounter = null;
                // Zoom back to transect
                var self = this;
                this._particles.setViewMode('transect');
                this._viewManager.setView('transect', null, function () {
                    self._pendingCoverObj = null;
                    self.canvas.style.cursor = 'pointer';
                    self._setSubState('surveying');
                    self._checkSurveyComplete();
                });
            } else if (this.subState === 'recording') {
                this._notebook.closeEntryForm();
                this._pendingAnimal = null;
                this._pendingEncounter = null;
                var self = this;
                this._particles.setViewMode('transect');
                this._viewManager.setView('transect', null, function () {
                    self._pendingCoverObj = null;
                    self.canvas.style.cursor = 'pointer';
                    self._setSubState('surveying');
                });
            } else if (this._viewManager.getCurrentView() === 'approach' && this.subState === 'surveying') {
                // Escape from approach view -- zoom back to transect
                this._pendingCoverObj = null;
                this.canvas.style.cursor = 'pointer';
                this._particles.setViewMode('transect');
                this._viewManager.setView('transect');
            }
        }
    }

    // ── Reset & destroy ────────────────────────────────────────────────

    reset() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        this.tickCount = 0;
        this._lastTick = 0;
        this.subState = 'surveying';
        this._currentTransect = 1;
        this._surveyElapsed = 0;
        this._pendingAnimal = null;
        this._pendingCoverObj = null;
        this._pendingEncounter = null;
        this._animatingFlip = false;
        this._tutorialCount = 0;

        if (this.environment) this.environment.reset();
        if (this._notebook) this._notebook.clear();
        if (this._idChallenge) this._idChallenge.reset();
        if (this._analysis) this._analysis.destroy();
        if (this._particles) this._particles.clear();

        // Reset view to transect
        if (this._viewManager) {
            this._viewManager.resize(this.canvas.width, this.canvas.height);
        }

        this._eventEngine = new EventEngine(this._config, this.environment.weatherSystem);

        if (this.canvas) this.canvas.style.display = '';
        if (this._hudEl) this._hudEl.style.display = '';
        this.canvas.style.cursor = 'pointer';

        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.emit('reset');
        this._setState('setup');
    }

    destroy() {
        if (this.canvas) {
            this.canvas.removeEventListener('click', this._boundClick);
        }
        document.removeEventListener('keydown', this._boundKeydown);

        if (this._notebook) this._notebook.destroy();
        if (this._idChallenge) this._idChallenge.destroy();
        if (this._analysis) this._analysis.destroy();
        if (this._hudEl && this._hudEl.parentNode) {
            this._hudEl.parentNode.removeChild(this._hudEl);
        }

        super.destroy();
    }
}
