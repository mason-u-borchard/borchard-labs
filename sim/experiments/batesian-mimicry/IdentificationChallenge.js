/**
 * IdentificationChallenge -- species ID modal for the Batesian mimicry survey.
 *
 * Presents a close-up view of a found salamander and asks the student
 * to identify it from a set of plausible species. Tracks accuracy stats
 * and provides corrective feedback with distinguishing features.
 */

import {
    SPECIES,
    ID_OPTIONS,
    SPECIES_COLOR_GROUP,
    DISTINGUISHING_FEATURES
} from './config.js';


// -------------------------------------------------------------------
// Feature label mapping -- human-readable names for observable traits
// -------------------------------------------------------------------

var FEATURE_LABELS = {
    skinTexture:   'Skin texture',
    spotPattern:   'Spot pattern',
    tailShape:     'Tail shape',
    bodyShape:     'Body shape',
    eyeColor:      'Eye color',
    size:          'Overall size',
    costalGrooves: 'Costal grooves'
};

var GUIDED_HINTS = {
    skinTexture:   'Notice the skin texture -- smooth, rough, or granular?',
    spotPattern:   'Look at the spot pattern and arrangement',
    tailShape:     'Check whether the tail is round or has a ridge (keel)',
    bodyShape:     'Observe the head-to-body proportions',
    eyeColor:      'Look closely at the eye color',
    size:          'Consider the overall body size',
    costalGrooves: 'Count the vertical grooves along the sides (costal grooves)'
};


// -------------------------------------------------------------------
// Inject scoped styles once
// -------------------------------------------------------------------

var stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    var css = `
        .idc-backdrop {
            position: fixed;
            top: 0;
            right: -380px;
            width: 370px;
            height: 100%;
            z-index: 9000;
            transition: right 0.3s ease-out;
            pointer-events: none;
        }
        .idc-backdrop.idc-visible {
            right: 0;
            pointer-events: auto;
        }
        .idc-modal {
            background: var(--parchment);
            border-left: 2px solid var(--border);
            box-shadow: -4px 0 24px var(--shadow-lg);
            padding: var(--space-lg);
            width: 100%;
            height: 100%;
            overflow-y: auto;
            position: relative;
            outline: none;
        }
        .idc-modal h3 {
            font-family: var(--font-heading);
            color: var(--ink);
            margin-bottom: var(--space-md);
            font-size: 1.25rem;
        }
        .idc-canvas-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: var(--space-md);
        }
        .idc-canvas {
            border: 1px solid var(--border-light);
            border-radius: var(--radius);
            background: var(--parchment-warm);
        }
        .idc-features {
            background: var(--parchment-warm);
            border: 1px solid var(--border-light);
            border-radius: var(--radius);
            padding: var(--space-sm) var(--space-md);
            margin-bottom: var(--space-md);
            font-family: var(--font-body);
            font-size: 0.9rem;
            color: var(--ink);
        }
        .idc-features h4 {
            font-family: var(--font-heading);
            font-size: 0.95rem;
            margin-bottom: var(--space-xs);
        }
        .idc-features ul {
            list-style: disc;
            padding-left: 1.4rem;
        }
        .idc-features li {
            margin-bottom: 2px;
            line-height: 1.5;
        }
        .idc-features .idc-hint {
            color: var(--ink-light);
            font-style: italic;
            font-size: 0.85rem;
        }
        .idc-options {
            margin-bottom: var(--space-md);
        }
        .idc-option {
            display: block;
            padding: 0.55rem 0.75rem;
            margin-bottom: 4px;
            border: 1px solid var(--border-light);
            border-radius: var(--radius);
            cursor: pointer;
            font-family: var(--font-body);
            font-size: 0.95rem;
            color: var(--ink);
            transition: background 0.15s, border-color 0.15s;
        }
        .idc-option:hover {
            background: var(--parchment-warm);
            border-color: var(--border);
        }
        .idc-option input[type="radio"] {
            margin-right: 0.5rem;
            vertical-align: middle;
        }
        .idc-option .idc-sciname {
            font-style: italic;
            color: var(--ink-light);
            font-size: 0.88rem;
            margin-left: 0.25rem;
        }
        .idc-option .idc-key-num {
            font-family: var(--font-mono);
            font-size: 0.8rem;
            color: var(--ink-faint);
            margin-right: 0.35rem;
        }
        .idc-submit {
            margin-top: var(--space-md);
            margin-bottom: var(--space-md);
            position: sticky;
            bottom: var(--space-md);
            width: 100%;
            z-index: 2;
        }
        .idc-result {
            padding: var(--space-sm) var(--space-md);
            border-radius: var(--radius);
            font-family: var(--font-body);
            font-size: 0.95rem;
            line-height: 1.55;
            display: none;
        }
        .idc-result.idc-correct {
            background: rgba(45, 106, 79, 0.1);
            border: 1px solid var(--forest);
            color: var(--forest-dark);
        }
        .idc-result.idc-incorrect {
            background: rgba(188, 71, 73, 0.1);
            border: 1px solid var(--rust);
            color: var(--ink);
        }
        .idc-result strong {
            display: block;
            margin-bottom: 4px;
        }
        .idc-result .idc-features-feedback {
            margin-top: var(--space-xs);
            font-size: 0.88rem;
            color: var(--ink-light);
        }
        .idc-continue {
            margin-top: var(--space-sm);
        }
    `;

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}


// -------------------------------------------------------------------
// IdentificationChallenge
// -------------------------------------------------------------------

export class IdentificationChallenge {
    constructor(container) {
        this._container = container;
        this._submitCallback = null;
        this._currentSalamander = null;
        this._currentDifficulty = null;
        this._optionKeys = [];

        // accuracy tracking
        this._stats = { correct: 0, incorrect: 0, bySpecies: {} };

        // bound handlers (for cleanup)
        this._onKeyDown = this._handleKeyDown.bind(this);

        this.mount(container);
    }

    // ---------------------------------------------------------------
    // DOM construction
    // ---------------------------------------------------------------

    mount(container) {
        injectStyles();

        this._backdrop = document.createElement('div');
        this._backdrop.className = 'idc-backdrop';
        this._backdrop.setAttribute('role', 'dialog');
        this._backdrop.setAttribute('aria-modal', 'true');
        this._backdrop.setAttribute('aria-label', 'Species Identification');

        var modal = document.createElement('div');
        modal.className = 'idc-modal';
        modal.tabIndex = -1;
        this._modal = modal;

        // Header
        var heading = document.createElement('h3');
        heading.textContent = 'Species Identification';
        modal.appendChild(heading);

        // Canvas
        var canvasWrap = document.createElement('div');
        canvasWrap.className = 'idc-canvas-wrap';
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'idc-canvas';
        this._canvas.width = 300;
        this._canvas.height = 200;
        canvasWrap.appendChild(this._canvas);
        modal.appendChild(canvasWrap);

        // Feature hints
        this._featuresEl = document.createElement('div');
        this._featuresEl.className = 'idc-features';
        modal.appendChild(this._featuresEl);

        // Species options
        this._optionsEl = document.createElement('div');
        this._optionsEl.className = 'idc-options';
        modal.appendChild(this._optionsEl);

        // Submit button
        this._submitBtn = document.createElement('button');
        this._submitBtn.className = 'btn btn-primary idc-submit';
        this._submitBtn.textContent = 'Submit Identification';
        this._submitBtn.addEventListener('click', this._handleSubmit.bind(this));
        modal.appendChild(this._submitBtn);

        // Result section
        this._resultEl = document.createElement('div');
        this._resultEl.className = 'idc-result';
        modal.appendChild(this._resultEl);

        this._backdrop.appendChild(modal);
        container.appendChild(this._backdrop);
    }

    // ---------------------------------------------------------------
    // Show / Hide
    // ---------------------------------------------------------------

    show(salamander, difficulty) {
        this._currentSalamander = salamander;
        this._currentDifficulty = difficulty || 'standard';

        // clear previous state
        this._resultEl.style.display = 'none';
        this._resultEl.className = 'idc-result';
        this._resultEl.innerHTML = '';
        this._submitBtn.style.display = '';
        this._submitBtn.disabled = false;

        // render the animal on the canvas
        var ctx = this._canvas.getContext('2d');
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        salamander.renderLarge(ctx, 0, 0, this._canvas.width, this._canvas.height);

        // determine which species options to present
        var speciesKey = salamander.getTrait('speciesKey');
        var colorGroup = SPECIES_COLOR_GROUP[speciesKey] || 'all';
        var optionKeys = (ID_OPTIONS[colorGroup] || ID_OPTIONS.all).slice();

        // make sure the correct species is in the list
        if (optionKeys.indexOf(speciesKey) === -1) {
            optionKeys.push(speciesKey);
        }

        this._optionKeys = optionKeys;
        this._buildOptions(optionKeys);

        // feature hints
        this._buildFeatures(salamander, difficulty);

        // show
        this._backdrop.classList.add('idc-visible');
        this._modal.focus();
        document.addEventListener('keydown', this._onKeyDown);
    }

    hide() {
        this._backdrop.classList.remove('idc-visible');
        this._currentSalamander = null;
        this._currentDifficulty = null;
        this._optionKeys = [];
        document.removeEventListener('keydown', this._onKeyDown);
    }

    // ---------------------------------------------------------------
    // Options list
    // ---------------------------------------------------------------

    _buildOptions(keys) {
        this._optionsEl.innerHTML = '';

        for (var i = 0; i < keys.length; i++) {
            var sp = SPECIES[keys[i]];
            if (!sp) continue;
            this._optionsEl.appendChild(this._createOptionEl(keys[i], sp, i + 1));
        }

        // "Other / Unknown" option
        this._optionsEl.appendChild(this._createOptionEl('UNKNOWN', {
            commonName: 'Other / Unknown',
            scientificName: ''
        }, keys.length + 1));
    }

    _createOptionEl(key, sp, num) {
        var label = document.createElement('label');
        label.className = 'idc-option';

        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'idc-species';
        radio.value = key;

        var numSpan = document.createElement('span');
        numSpan.className = 'idc-key-num';
        numSpan.textContent = num + '.';

        label.appendChild(radio);
        label.appendChild(numSpan);
        label.appendChild(document.createTextNode(sp.commonName));

        if (sp.scientificName) {
            var sci = document.createElement('span');
            sci.className = 'idc-sciname';
            sci.textContent = '(' + sp.scientificName + ')';
            label.appendChild(document.createTextNode(' '));
            label.appendChild(sci);
        }

        return label;
    }

    // ---------------------------------------------------------------
    // Feature hints
    // ---------------------------------------------------------------

    _buildFeatures(salamander, difficulty) {
        this._featuresEl.innerHTML = '';

        if (difficulty === 'expert') {
            this._featuresEl.style.display = 'none';
            return;
        }

        this._featuresEl.style.display = '';
        var features = salamander.getIdentifyingFeatures();

        var title = document.createElement('h4');
        title.textContent = difficulty === 'guided'
            ? 'Observable Features'
            : 'Feature Checklist';
        this._featuresEl.appendChild(title);

        var list = document.createElement('ul');

        var featureKeys = Object.keys(features);
        for (var i = 0; i < featureKeys.length; i++) {
            var fk = featureKeys[i];
            var val = features[fk];
            if (val === null || val === undefined) continue;

            // format costal grooves specially
            var displayVal = val;
            if (fk === 'costalGrooves') {
                displayVal = val === 0 ? 'none visible' : val + ' grooves';
            }

            var li = document.createElement('li');
            var labelText = FEATURE_LABELS[fk] || fk;
            li.textContent = labelText + ': ' + displayVal;

            // guided mode adds hint text
            if (difficulty === 'guided' && GUIDED_HINTS[fk]) {
                var hint = document.createElement('div');
                hint.className = 'idc-hint';
                hint.textContent = GUIDED_HINTS[fk];
                li.appendChild(hint);
            }

            list.appendChild(li);
        }

        this._featuresEl.appendChild(list);
    }

    // ---------------------------------------------------------------
    // Submit handling
    // ---------------------------------------------------------------

    _handleSubmit() {
        var selected = this._getSelectedValue();
        if (!selected) return;

        var salamander = this._currentSalamander;
        var correctKey = salamander.getTrait('speciesKey');
        var isCorrect = selected === correctKey;

        // record to stats
        this._recordResult(correctKey, isCorrect);

        // build result display
        this._submitBtn.style.display = 'none';
        this._resultEl.style.display = '';

        if (isCorrect) {
            this._resultEl.className = 'idc-result idc-correct';
            var correctSp = SPECIES[correctKey];
            this._resultEl.innerHTML = '';

            var msg = document.createElement('strong');
            msg.textContent = 'Correct!';
            this._resultEl.appendChild(msg);
            this._resultEl.appendChild(
                document.createTextNode('This is a ' + correctSp.commonName + '.')
            );
        } else {
            this._resultEl.className = 'idc-result idc-incorrect';
            var correctSp = SPECIES[correctKey];
            this._resultEl.innerHTML = '';

            var msg = document.createElement('strong');
            msg.textContent = 'Incorrect';
            this._resultEl.appendChild(msg);
            this._resultEl.appendChild(
                document.createTextNode('This is a ' + correctSp.commonName + '.')
            );

            // show distinguishing features that would have helped
            var featureInfo = DISTINGUISHING_FEATURES[correctKey];
            if (featureInfo) {
                var fb = document.createElement('div');
                fb.className = 'idc-features-feedback';
                var lines = [];
                var fKeys = Object.keys(featureInfo);
                for (var i = 0; i < fKeys.length; i++) {
                    lines.push(featureInfo[fKeys[i]]);
                }
                fb.textContent = 'Key features: ' + lines.join(' | ');
                this._resultEl.appendChild(fb);
            }

            // also mention the selected species if it's real
            if (selected !== 'UNKNOWN' && SPECIES[selected]) {
                var wrongFeatures = DISTINGUISHING_FEATURES[selected];
                if (wrongFeatures) {
                    var contrast = document.createElement('div');
                    contrast.className = 'idc-features-feedback';
                    var wrongLines = [];
                    var wKeys = Object.keys(wrongFeatures);
                    for (var i = 0; i < wKeys.length; i++) {
                        wrongLines.push(wrongFeatures[wKeys[i]]);
                    }
                    contrast.textContent = SPECIES[selected].commonName + ' differs: ' + wrongLines.join(' | ');
                    this._resultEl.appendChild(contrast);
                }
            }
        }

        // continue button
        var continueBtn = document.createElement('button');
        continueBtn.className = 'btn btn-primary idc-continue';
        continueBtn.textContent = 'Continue';
        continueBtn.addEventListener('click', function () {
            var result = {
                selectedSpecies: selected,
                correctSpecies: correctKey,
                isCorrect: isCorrect,
                salamander: salamander
            };
            if (this._submitCallback) {
                this._submitCallback(result);
            }
            this.hide();
        }.bind(this));
        this._resultEl.appendChild(continueBtn);
    }

    _getSelectedValue() {
        var radios = this._optionsEl.querySelectorAll('input[name="idc-species"]');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) return radios[i].value;
        }
        return null;
    }

    // ---------------------------------------------------------------
    // Keyboard handling
    // ---------------------------------------------------------------

    _handleKeyDown(e) {
        // Escape closes
        if (e.key === 'Escape') {
            e.preventDefault();
            this.hide();
            return;
        }

        // Number keys select options
        var num = parseInt(e.key, 10);
        if (num >= 1 && num <= this._optionKeys.length + 1) {
            e.preventDefault();
            var radios = this._optionsEl.querySelectorAll('input[name="idc-species"]');
            var idx = num - 1;
            if (idx < radios.length) {
                radios[idx].checked = true;
            }
            return;
        }

        // Enter submits
        if (e.key === 'Enter') {
            e.preventDefault();
            // if result is showing, click continue; otherwise submit
            var continueBtn = this._resultEl.querySelector('.idc-continue');
            if (continueBtn && this._resultEl.style.display !== 'none') {
                continueBtn.click();
            } else {
                this._handleSubmit();
            }
        }
    }

    // ---------------------------------------------------------------
    // Accuracy tracking
    // ---------------------------------------------------------------

    _recordResult(correctKey, isCorrect) {
        if (isCorrect) {
            this._stats.correct++;
        } else {
            this._stats.incorrect++;
        }

        if (!this._stats.bySpecies[correctKey]) {
            this._stats.bySpecies[correctKey] = { correct: 0, total: 0 };
        }
        this._stats.bySpecies[correctKey].total++;
        if (isCorrect) {
            this._stats.bySpecies[correctKey].correct++;
        }
    }

    getAccuracyStats() {
        var total = this._stats.correct + this._stats.incorrect;
        return {
            correct: this._stats.correct,
            incorrect: this._stats.incorrect,
            total: total,
            accuracy: total > 0 ? Math.round((this._stats.correct / total) * 100) / 100 : 0,
            bySpecies: this._stats.bySpecies
        };
    }

    reset() {
        this._stats = { correct: 0, incorrect: 0, bySpecies: {} };
    }

    // ---------------------------------------------------------------
    // Callback registration
    // ---------------------------------------------------------------

    onSubmit(callback) {
        this._submitCallback = callback;
    }

    // ---------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------

    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
        if (this._backdrop && this._backdrop.parentNode) {
            this._backdrop.parentNode.removeChild(this._backdrop);
        }
        this._backdrop = null;
        this._modal = null;
        this._canvas = null;
        this._featuresEl = null;
        this._optionsEl = null;
        this._submitBtn = null;
        this._resultEl = null;
        this._currentSalamander = null;
        this._submitCallback = null;
    }
}
