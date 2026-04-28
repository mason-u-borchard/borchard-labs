/**
 * UIManager -- bridges the 3D rendering layer with the existing
 * HTML-based simulation UI components (FieldNotebook, IdentificationChallenge,
 * AnalysisPanel, FieldSetup).
 *
 * On desktop: HTML overlays slide in over the 3D canvas.
 * On VR: panels would be world-space (future -- for now desktop only).
 */

import { FieldNotebook } from '../FieldNotebook.js';
import { IdentificationChallenge } from '../IdentificationChallenge.js';
import { AnalysisPanel } from '../AnalysisPanel.js';
import { DEFAULTS } from '../config.js';


export class UIManager {

    /**
     * @param {HTMLElement} container - the simulation container element
     * @param {object} config - survey config from FieldSetup
     */
    constructor(container, config) {
        this._container = container;
        this._config = config;
        this._onPointerUnlock = null; // callback to re-lock after overlay dismisses

        // Build the overlay wrapper that sits on top of the 3D canvas
        this._overlay = document.createElement('div');
        this._overlay.className = 'sim-3d-overlay';
        this._overlay.style.cssText = [
            'position: absolute',
            'top: 0',
            'left: 0',
            'width: 100%',
            'height: 100%',
            'pointer-events: none',
            'z-index: 10'
        ].join('; ');
        container.appendChild(this._overlay);

        // HUD bar (weather, progress, time)
        this._buildHUD();

        // Field notebook
        this._notebook = new FieldNotebook();
        this._notebookWrap = document.createElement('div');
        this._notebookWrap.style.cssText = [
            'position: absolute',
            'bottom: 0',
            'left: 0',
            'width: 100%',
            'max-height: 40%',
            'overflow-y: auto',
            'pointer-events: auto',
            'background: rgba(250, 248, 244, 0.95)',
            'border-top: 1px solid #d4cec4',
            'display: none'
        ].join('; ');
        this._notebook.mount(this._notebookWrap);
        this._overlay.appendChild(this._notebookWrap);

        // ID challenge (constructor mounts internally)
        this._idChallenge = new IdentificationChallenge(this._overlay);

        // Analysis panel (created, not mounted until needed)
        this._analysis = new AnalysisPanel(container);

        // Callbacks
        this._onRecordSaved = null;
        this._onIdentified = null;

        // Wire notebook save
        var self = this;
        this._notebook.onSave(function (rowData) {
            self._notebookWrap.style.display = 'none';
            self._relockPointer();
            if (self._onRecordSaved) self._onRecordSaved(rowData);
        });
    }


    // ── ID Challenge ───────────────────────────────────────────────

    /**
     * Show the species identification panel for a found animal.
     */
    showIDChallenge(salamanderTraits, difficulty) {
        this._unlockPointer();

        // The ID challenge expects a salamander-like object with getTrait()
        var traitProxy = {
            traits: salamanderTraits,
            getTrait: function (key) { return this.traits[key]; },
            renderLarge: function () {} // no-op -- 3D animal is visible on canvas
        };

        this._idChallenge.show(traitProxy, difficulty || 'standard');
    }

    /**
     * Register callback for when the student submits an identification.
     */
    onIdentified(callback) {
        this._onIdentified = callback;
        this._idChallenge.onSubmit(function (result) {
            if (callback) callback(result);
        });
    }

    /**
     * Hide the ID challenge panel.
     */
    hideIDChallenge() {
        this._idChallenge.hide();
        // Don't relock yet -- notebook opens next
    }


    // ── Field Notebook ─────────────────────────────────────────────

    /**
     * Open the field notebook entry form for data recording.
     */
    showNotebook(animalTraits, coverObj, speciesId, isCorrect, surveyTime, airTemp) {
        this._unlockPointer();
        this._notebookWrap.style.display = 'block';

        // Build a proxy object matching what FieldNotebook.openEntryForm expects
        var animalProxy = {
            getTrait: function (key) { return animalTraits[key]; },
            getFieldMeasurements: function () {
                return {
                    svl: animalTraits.svl,
                    totalLength: animalTraits.totalLength,
                    mass: animalTraits.mass
                };
            }
        };

        var coverProxy = {
            id: coverObj.id,
            type: coverObj.type
        };

        this._notebook.openEntryForm(
            animalProxy, coverProxy, speciesId, isCorrect, surveyTime, airTemp
        );
    }

    /**
     * Register callback for when the student saves a notebook entry.
     */
    onRecordSaved(callback) {
        this._onRecordSaved = callback;
    }

    /**
     * Hide the notebook panel.
     */
    hideNotebook() {
        this._notebookWrap.style.display = 'none';
        this._notebook.closeEntryForm();
    }

    /**
     * Get the notebook data table (for analysis).
     */
    getNotebookData() {
        return this._notebook.getTable();
    }

    /**
     * Get hidden accuracy data from the notebook.
     */
    getHiddenData() {
        return this._notebook._hiddenData || [];
    }

    /**
     * Download the CSV.
     */
    downloadCSV() {
        this._notebook.download();
    }


    // ── Analysis Panel ─────────────────────────────────────────────

    /**
     * Show the post-survey analysis panel.
     * Hides the 3D canvas and shows full-page analysis.
     */
    showAnalysis(data, onDownload, onNewSurvey) {
        // Hide the 3D overlay
        this._overlay.style.display = 'none';

        this._analysis.load(data);
        this._analysis.mount(this._container);

        if (onDownload) {
            this._analysis.onDownload(onDownload);
        }
        if (onNewSurvey) {
            this._analysis.onNewSurvey(onNewSurvey);
        }
    }


    // ── HUD ────────────────────────────────────────────────────────

    _buildHUD() {
        var hud = document.createElement('div');
        hud.style.cssText = [
            'position: absolute',
            'top: 0',
            'left: 0',
            'width: 100%',
            'display: flex',
            'justify-content: space-between',
            'align-items: center',
            'padding: 8px 16px',
            'background: rgba(43, 43, 43, 0.7)',
            'color: #faf8f4',
            'font-family: "Source Sans 3", sans-serif',
            'font-size: 0.85rem',
            'pointer-events: auto',
            'gap: 12px',
            'flex-wrap: wrap',
            'box-sizing: border-box'
        ].join('; ');

        this._hudWeather = document.createElement('span');
        this._hudWeather.style.opacity = '0.9';

        this._hudProgress = document.createElement('span');
        this._hudProgress.style.fontFamily = '"Fira Code", Consolas, monospace';

        this._hudTime = document.createElement('span');
        this._hudTime.style.fontFamily = '"Fira Code", Consolas, monospace';

        var endBtn = document.createElement('button');
        endBtn.textContent = 'End Survey';
        endBtn.style.cssText = [
            'margin-left: auto',
            'padding: 4px 14px',
            'font-size: 0.8rem',
            'background: transparent',
            'color: #faf8f4',
            'border: 1px solid rgba(250, 248, 244, 0.4)',
            'border-radius: 4px',
            'cursor: pointer'
        ].join('; ');
        this._endSurveyBtn = endBtn;

        hud.appendChild(this._hudWeather);
        hud.appendChild(this._hudProgress);
        hud.appendChild(this._hudTime);
        hud.appendChild(endBtn);

        this._hudEl = hud;
        this._overlay.appendChild(hud);
    }

    /**
     * Update the HUD display.
     */
    updateHUD(weatherDesc, progressText, timeText) {
        if (this._hudWeather) this._hudWeather.textContent = weatherDesc;
        if (this._hudProgress) this._hudProgress.textContent = progressText;
        if (this._hudTime) this._hudTime.textContent = timeText;
    }

    /**
     * Register callback for the End Survey button.
     */
    onEndSurvey(callback) {
        var self = this;
        this._endSurveyBtn.addEventListener('click', function () {
            self._unlockPointer();
            if (callback) callback();
        });
    }


    // ── Brief Messages ─────────────────────────────────────────────

    /**
     * Show a brief message that fades after 1.5 seconds.
     */
    showMessage(text) {
        if (!text) return;

        var msg = document.createElement('div');
        msg.textContent = text;
        msg.style.cssText = [
            'position: absolute',
            'bottom: 60px',
            'left: 50%',
            'transform: translateX(-50%)',
            'background: rgba(43, 43, 43, 0.85)',
            'color: #faf8f4',
            'padding: 10px 24px',
            'border-radius: 8px',
            'font-family: "Source Sans 3", sans-serif',
            'font-size: 1rem',
            'pointer-events: none',
            'transition: opacity 0.4s ease',
            'z-index: 20'
        ].join('; ');

        this._overlay.appendChild(msg);

        setTimeout(function () {
            msg.style.opacity = '0';
            setTimeout(function () {
                if (msg.parentNode) msg.parentNode.removeChild(msg);
            }, 400);
        }, 1500);
    }

    /**
     * Show an event message with a Continue button (copperhead, egg clutch, etc.)
     */
    showEventMessage(event, onContinue) {
        this._unlockPointer();

        var self = this;
        var card = document.createElement('div');
        card.style.cssText = [
            'position: absolute',
            'top: 50%',
            'left: 50%',
            'transform: translate(-50%, -50%)',
            'background: #faf8f4',
            'border: 2px solid #bc4749',
            'padding: 28px 36px',
            'border-radius: 12px',
            'box-shadow: 0 8px 32px rgba(0,0,0,0.3)',
            'max-width: 420px',
            'text-align: center',
            'font-family: "Source Sans 3", sans-serif',
            'pointer-events: auto',
            'z-index: 30'
        ].join('; ');

        var title = document.createElement('h4');
        title.textContent = event.label || 'Event';
        title.style.cssText = 'font-family: Merriweather, serif; margin-bottom: 10px; color: #bc4749;';

        var detail = document.createElement('p');
        detail.textContent = event.detail || '';
        detail.style.cssText = 'color: #555; font-size: 0.95rem; margin-bottom: 18px; line-height: 1.5;';

        var btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = 'Continue';
        btn.style.pointerEvents = 'auto';
        btn.addEventListener('click', function () {
            if (card.parentNode) card.parentNode.removeChild(card);
            self._relockPointer();
            if (onContinue) onContinue();
        });

        card.appendChild(title);
        card.appendChild(detail);
        card.appendChild(btn);
        this._overlay.appendChild(card);
    }


    // ── Crosshair ──────────────────────────────────────────────────

    /**
     * Show/hide a simple crosshair in the center of the screen (desktop mode).
     */
    showCrosshair(visible) {
        if (!this._crosshair) {
            this._crosshair = document.createElement('div');
            this._crosshair.style.cssText = [
                'position: absolute',
                'top: 50%',
                'left: 50%',
                'width: 20px',
                'height: 20px',
                'margin-top: -10px',
                'margin-left: -10px',
                'pointer-events: none',
                'z-index: 5',
                'opacity: 0.5'
            ].join('; ');
            // Draw a simple + crosshair
            this._crosshair.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20">' +
                '<line x1="10" y1="3" x2="10" y2="8" stroke="#fff" stroke-width="1.5"/>' +
                '<line x1="10" y1="12" x2="10" y2="17" stroke="#fff" stroke-width="1.5"/>' +
                '<line x1="3" y1="10" x2="8" y2="10" stroke="#fff" stroke-width="1.5"/>' +
                '<line x1="12" y1="10" x2="17" y2="10" stroke="#fff" stroke-width="1.5"/>' +
                '</svg>';
            this._overlay.appendChild(this._crosshair);
        }
        this._crosshair.style.display = visible ? '' : 'none';
    }


    // ── ID Challenge Accuracy ──────────────────────────────────────

    getAccuracyStats() {
        return this._idChallenge.getAccuracyStats();
    }


    // ── Pointer lock management ───────────────────────────────────

    /**
     * Exit pointer lock so the user can click HTML buttons.
     * Call _relockPointer() when the overlay is dismissed.
     */
    _unlockPointer() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    /**
     * Re-engage pointer lock after an overlay is dismissed.
     * Uses a short delay so the click that dismissed the overlay
     * doesn't immediately re-trigger pointer lock.
     */
    _relockPointer() {
        var container = this._container;
        setTimeout(function () {
            var canvas = container.querySelector('canvas');
            if (canvas) {
                canvas.requestPointerLock();
            }
        }, 200);
    }


    // ── Cleanup ────────────────────────────────────────────────────

    dispose() {
        if (this._notebook) this._notebook.destroy();
        if (this._idChallenge) this._idChallenge.destroy();
        if (this._analysis) this._analysis.destroy();
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
    }
}
