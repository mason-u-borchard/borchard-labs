/**
 * FieldNotebook -- Interactive data recording for the Batesian mimicry survey.
 *
 * Extends DataCollector with a field-notebook-styled UI. Students record
 * morphometric measurements, habitat data, and species IDs for each animal
 * encountered during cover object surveys. Hidden columns track true species
 * and ID accuracy for post-survey analysis.
 */

import { DataCollector } from '../../engine/DataCollector.js';
import { NOTEBOOK_COLUMNS, NOTEBOOK_HIDDEN_COLUMNS, SPECIES } from './config.js';


export class FieldNotebook extends DataCollector {

    constructor() {
        super({
            columns: NOTEBOOK_COLUMNS,
            experimentName: 'batesian-mimicry'
        });

        this._entryCount = 0;
        this._entryFormEl = null;
        this._isEntryMode = false;
        this._currentAnimal = null;
        this._currentCoverObj = null;
        this._submitCallback = null;
        this._hiddenData = [];
    }

    /**
     * Build the field notebook UI inside the given container.
     * Overrides the base DataCollector mount entirely.
     * @param {HTMLElement} container
     */
    mount(container) {
        // Let the base class build its table structure first
        super.mount(container);

        // Inject notebook-specific styles
        this._injectStyles();

        // Restyle the data-collector wrapper as a field notebook
        this._el.classList.add('field-notebook');

        // Replace the header content
        var header = this._el.querySelector('.data-collector-header');
        if (header) {
            var title = document.createElement('span');
            title.className = 'field-notebook-title';
            title.textContent = 'Field Notebook';
            header.insertBefore(title, header.firstChild);
        }

        // Add ruled-paper background to the table body
        var wrap = this._el.querySelector('.data-table-wrap');
        if (wrap) {
            wrap.classList.add('field-notebook-body');
        }

        // Build the entry form (hidden until openEntryForm is called)
        this._buildEntryForm();
        this._el.appendChild(this._entryFormEl);
    }

    /**
     * Open the entry form for a new observation.
     * @param {Object} animal - Salamander instance
     * @param {Object} coverObj - CoverObject instance
     * @param {string} speciesId - Species key from the ID challenge result
     * @param {boolean} isCorrectId - Whether the student's ID was correct
     * @param {string} surveyTime - Formatted survey time string
     * @param {number} airTemp - Current air temperature in Celsius
     */
    openEntryForm(animal, coverObj, speciesId, isCorrectId, surveyTime, airTemp) {
        this._currentAnimal = animal;
        this._currentCoverObj = coverObj;
        this._entryCount++;

        // Store the hidden truth for later
        this._pendingTrueSpecies = animal.getTrait('speciesKey');
        this._pendingIsCorrect = isCorrectId;

        // Auto-populated read-only fields
        this._entryFormEl.querySelector('[data-field="entry-num"]').textContent = this._entryCount;
        this._entryFormEl.querySelector('[data-field="time"]').textContent = surveyTime;
        this._entryFormEl.querySelector('[data-field="cover-num"]').textContent = coverObj.id || '--';
        this._entryFormEl.querySelector('[data-field="obj-type"]').textContent = coverObj.type || '--';
        this._entryFormEl.querySelector('[data-field="species-id"]').textContent = this._formatSpeciesLabel(speciesId);

        // Store the raw species key for the row data
        this._pendingSpeciesId = speciesId;

        // Pre-fill measurement fields from the animal
        var measurements = animal.getFieldMeasurements();
        var svlInput = this._entryFormEl.querySelector('[data-input="svl"]');
        var tlInput = this._entryFormEl.querySelector('[data-input="tl"]');
        var massInput = this._entryFormEl.querySelector('[data-input="mass"]');
        var tempInput = this._entryFormEl.querySelector('[data-input="air-temp"]');

        svlInput.value = measurements.svl != null ? measurements.svl : '';
        tlInput.value = measurements.totalLength != null ? measurements.totalLength : '';
        massInput.value = measurements.mass != null ? measurements.mass : '';
        tempInput.value = airTemp != null ? Math.round(airTemp * 10) / 10 : '';

        // Reset student-entry fields to defaults
        this._entryFormEl.querySelector('[data-input="sex"]').value = 'Unknown';
        this._entryFormEl.querySelector('[data-input="age-class"]').value = 'Adult';
        this._entryFormEl.querySelector('[data-input="moisture"]').value = 'Damp';
        this._entryFormEl.querySelector('[data-input="notes"]').value = '';

        // Show the form and focus the first editable field
        this._entryFormEl.style.display = 'block';
        this._isEntryMode = true;
        svlInput.focus();
        svlInput.select();
    }

    /**
     * Close the entry form without saving.
     */
    closeEntryForm() {
        if (this._entryFormEl) {
            this._entryFormEl.style.display = 'none';
        }
        this._isEntryMode = false;
        this._currentAnimal = null;
        this._currentCoverObj = null;
    }

    /**
     * Register a callback that fires when the student saves an entry.
     * @param {Function} callback - Receives the saved row data object.
     */
    onSave(callback) {
        this._submitCallback = callback;
    }

    /**
     * Returns species counts from the student's recorded identifications.
     * @returns {Object} Map of species keys to observation counts.
     */
    getSpeciesSummary() {
        var summary = {};
        var rows = this.getTable();
        for (var i = 0; i < rows.length; i++) {
            var sp = rows[i]['Species ID'];
            if (sp) {
                summary[sp] = (summary[sp] || 0) + 1;
            }
        }
        return summary;
    }

    /**
     * Tally mimic vs model counts from the student's identifications.
     * @returns {{ mimics: number, models: number, ratio: string }}
     */
    getMimicModelRatio() {
        var mimics = 0;
        var models = 0;
        var rows = this.getTable();

        for (var i = 0; i < rows.length; i++) {
            var sp = rows[i]['Species ID'];
            if (SPECIES[sp]) {
                if (SPECIES[sp].role === 'mimic') mimics++;
                else if (SPECIES[sp].role === 'model') models++;
            }
        }

        var gcd = this._gcd(mimics, models);
        var ratioStr = gcd > 0
            ? (mimics / gcd) + ':' + (models / gcd)
            : mimics + ':' + models;

        return { mimics: mimics, models: models, ratio: ratioStr };
    }

    /**
     * Calculate the student's ID accuracy from hidden data.
     * @returns {{ correct: number, total: number, accuracy: number }}
     */
    getTrueAccuracy() {
        var correct = 0;
        var total = this._hiddenData.length;

        for (var i = 0; i < total; i++) {
            if (this._hiddenData[i].correct) correct++;
        }

        return {
            correct: correct,
            total: total,
            accuracy: total > 0 ? Math.round((correct / total) * 100) / 100 : 0
        };
    }

    /**
     * Export CSV with both visible and hidden columns.
     * Hidden columns (true species, correctness) are appended at the end
     * so the student can review their accuracy after the survey.
     * @returns {string}
     */
    toCSV() {
        var allColumns = this.columns.concat(NOTEBOOK_HIDDEN_COLUMNS);
        var lines = [];

        // Header row
        lines.push(allColumns.map(escapeCSV).join(','));

        // Data rows
        var rows = this.getTable();
        for (var i = 0; i < rows.length; i++) {
            var fields = [];
            for (var j = 0; j < this.columns.length; j++) {
                var val = rows[i][this.columns[j]];
                fields.push(escapeCSV(val === null || val === undefined ? '' : String(val)));
            }

            // Append hidden columns
            var hidden = this._hiddenData[i] || {};
            fields.push(escapeCSV(hidden.trueSpecies || ''));
            fields.push(escapeCSV(hidden.correct ? 'Y' : 'N'));

            lines.push(fields.join(','));
        }

        return lines.join('\r\n') + '\r\n';
    }


    // ---------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------

    /**
     * Build the entry form card, initially hidden.
     */
    _buildEntryForm() {
        var self = this;

        var card = document.createElement('div');
        card.className = 'field-notebook-entry';
        card.style.display = 'none';

        // -- Auto-populated section (left) --
        var autoSection = document.createElement('div');
        autoSection.className = 'entry-section entry-auto';

        autoSection.innerHTML =
            '<div class="entry-field">' +
                '<label>Entry #</label>' +
                '<span data-field="entry-num">--</span>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label>Time</label>' +
                '<span data-field="time">--</span>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label>Cover Obj #</label>' +
                '<span data-field="cover-num">--</span>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label>Obj Type</label>' +
                '<span data-field="obj-type">--</span>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label>Species ID</label>' +
                '<span data-field="species-id">--</span>' +
            '</div>';

        // -- Student-entry section (right) --
        var inputSection = document.createElement('div');
        inputSection.className = 'entry-section entry-inputs';

        inputSection.innerHTML =
            '<div class="entry-field">' +
                '<label for="nb-svl">SVL (mm)</label>' +
                '<input type="number" id="nb-svl" data-input="svl" step="0.1" min="0">' +
            '</div>' +
            '<div class="entry-field">' +
                '<label for="nb-tl">Total Length (mm)</label>' +
                '<input type="number" id="nb-tl" data-input="tl" step="0.1" min="0">' +
            '</div>' +
            '<div class="entry-field">' +
                '<label for="nb-mass">Mass (g)</label>' +
                '<input type="number" id="nb-mass" data-input="mass" step="0.01" min="0">' +
            '</div>' +
            '<div class="entry-field">' +
                '<label for="nb-sex">Sex</label>' +
                '<select id="nb-sex" data-input="sex">' +
                    '<option>Male</option>' +
                    '<option>Female</option>' +
                    '<option selected>Unknown</option>' +
                '</select>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label for="nb-age">Age Class</label>' +
                '<select id="nb-age" data-input="age-class">' +
                    '<option selected>Adult</option>' +
                    '<option>Subadult</option>' +
                    '<option>Juvenile</option>' +
                '</select>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label for="nb-moisture">Substrate Moisture</label>' +
                '<select id="nb-moisture" data-input="moisture">' +
                    '<option>Dry</option>' +
                    '<option selected>Damp</option>' +
                    '<option>Wet</option>' +
                    '<option>Saturated</option>' +
                '</select>' +
            '</div>' +
            '<div class="entry-field">' +
                '<label for="nb-temp">Air Temp (C)</label>' +
                '<input type="number" id="nb-temp" data-input="air-temp" step="0.1">' +
            '</div>' +
            '<div class="entry-field entry-field-wide">' +
                '<label for="nb-notes">Notes</label>' +
                '<input type="text" id="nb-notes" data-input="notes" placeholder="Optional observations...">' +
            '</div>';

        // -- Buttons --
        var actions = document.createElement('div');
        actions.className = 'entry-actions';

        var saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = 'Save Entry';
        saveBtn.addEventListener('click', function () {
            self._handleSave();
        });

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-ghost';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            self.closeEntryForm();
        });

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);

        // Assemble the card
        var columns = document.createElement('div');
        columns.className = 'entry-columns';
        columns.appendChild(autoSection);
        columns.appendChild(inputSection);

        card.appendChild(columns);
        card.appendChild(actions);

        this._entryFormEl = card;
    }

    /**
     * Validate and save the current entry.
     */
    _handleSave() {
        var svlVal = parseFloat(this._entryFormEl.querySelector('[data-input="svl"]').value);

        if (isNaN(svlVal) || svlVal <= 0) {
            this._entryFormEl.querySelector('[data-input="svl"]').focus();
            return;
        }

        if (!this._pendingSpeciesId) {
            return;
        }

        var rowData = {};
        rowData['Entry #'] = this._entryCount;
        rowData['Time'] = this._entryFormEl.querySelector('[data-field="time"]').textContent;
        rowData['Cover Obj #'] = this._entryFormEl.querySelector('[data-field="cover-num"]').textContent;
        rowData['Obj Type'] = this._entryFormEl.querySelector('[data-field="obj-type"]').textContent;
        rowData['Species ID'] = this._pendingSpeciesId;
        rowData['ID Confidence'] = '';  // can be extended later
        rowData['SVL (mm)'] = svlVal;
        rowData['Total Length (mm)'] = parseFloat(this._entryFormEl.querySelector('[data-input="tl"]').value) || '';
        rowData['Mass (g)'] = parseFloat(this._entryFormEl.querySelector('[data-input="mass"]').value) || '';
        rowData['Sex'] = this._entryFormEl.querySelector('[data-input="sex"]').value;
        rowData['Age Class'] = this._entryFormEl.querySelector('[data-input="age-class"]').value;
        rowData['Substrate Moisture'] = this._entryFormEl.querySelector('[data-input="moisture"]').value;
        rowData['Air Temp (C)'] = parseFloat(this._entryFormEl.querySelector('[data-input="air-temp"]').value) || '';
        rowData['Notes'] = this._entryFormEl.querySelector('[data-input="notes"]').value.trim();

        // Hidden tracking data
        this._hiddenData.push({
            trueSpecies: this._pendingTrueSpecies,
            correct: this._pendingIsCorrect
        });

        // Record into the base DataCollector
        this.record(rowData);

        // Close form
        this.closeEntryForm();

        // Notify
        if (this._submitCallback) {
            this._submitCallback(rowData);
        }

        // Scroll the table to show the new row
        if (this._wrapEl) {
            this._wrapEl.scrollTop = this._wrapEl.scrollHeight;
        }
    }

    /**
     * Format a species key into a readable label.
     * @param {string} key - e.g. 'NOVI'
     * @returns {string}
     */
    _formatSpeciesLabel(key) {
        if (SPECIES[key]) {
            return SPECIES[key].commonName + ' (' + key + ')';
        }
        return key || '--';
    }

    /**
     * Greatest common divisor (Euclidean). Used for ratio formatting.
     */
    _gcd(a, b) {
        if (b === 0) return a;
        return this._gcd(b, a % b);
    }

    /**
     * Inject the scoped stylesheet for field-notebook appearance.
     */
    _injectStyles() {
        if (document.getElementById('field-notebook-styles')) return;

        var style = document.createElement('style');
        style.id = 'field-notebook-styles';
        style.textContent =
            '.field-notebook {' +
                'background: #faf5e8;' +
                'border-radius: var(--radius-lg, 12px);' +
                'box-shadow: 0 2px 12px var(--shadow-md, rgba(43,43,43,0.12));' +
                'padding: var(--space-md, 1rem);' +
                'font-family: var(--font-body, sans-serif);' +
            '}' +

            '.field-notebook .data-collector-header {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: var(--space-sm, 0.5rem);' +
                'margin-bottom: var(--space-sm, 0.5rem);' +
                'border-bottom: 2px solid var(--border, #d4cec4);' +
                'padding-bottom: var(--space-sm, 0.5rem);' +
            '}' +

            '.field-notebook-title {' +
                'font-family: var(--font-heading, Georgia, serif);' +
                'font-size: 1.25rem;' +
                'font-weight: 700;' +
                'color: var(--ink, #2b2b2b);' +
                'margin-right: auto;' +
            '}' +

            '.field-notebook .data-collector-count {' +
                'font-size: 0.85rem;' +
                'color: var(--ink-faint, #888);' +
                'margin-right: var(--space-sm, 0.5rem);' +
            '}' +

            '.field-notebook-body {' +
                'background-image: repeating-linear-gradient(' +
                    'transparent,' +
                    'transparent 23px,' +
                    'rgba(69, 123, 157, 0.10) 23px,' +
                    'rgba(69, 123, 157, 0.10) 24px' +
                ');' +
                'background-position: 0 0;' +
            '}' +

            '.field-notebook .data-table {' +
                'width: 100%;' +
                'border-collapse: collapse;' +
                'font-family: var(--font-mono, monospace);' +
                'font-size: 0.78rem;' +
            '}' +

            '.field-notebook .data-table th {' +
                'background: var(--parchment-warm, #f3efe7);' +
                'font-family: var(--font-body, sans-serif);' +
                'font-size: 0.72rem;' +
                'font-weight: 600;' +
                'text-transform: uppercase;' +
                'letter-spacing: 0.03em;' +
                'color: var(--ink-light, #555);' +
                'padding: 4px 6px;' +
                'text-align: left;' +
                'border-bottom: 1px solid var(--border, #d4cec4);' +
                'position: sticky;' +
                'top: 0;' +
                'z-index: 1;' +
            '}' +

            '.field-notebook .data-table td {' +
                'padding: 3px 6px;' +
                'border-bottom: 1px solid rgba(212, 206, 196, 0.4);' +
                'white-space: nowrap;' +
                'color: var(--ink, #2b2b2b);' +
            '}' +

            '.field-notebook .data-table tbody tr:nth-child(even) {' +
                'background: rgba(250, 245, 232, 0.6);' +
            '}' +

            '.field-notebook .data-table tbody tr:nth-child(odd) {' +
                'background: rgba(243, 239, 231, 0.4);' +
            '}' +

            /* Entry form card */
            '.field-notebook-entry {' +
                'margin-top: var(--space-md, 1rem);' +
                'padding: var(--space-md, 1rem);' +
                'background: #fff;' +
                'border: 1px solid var(--border, #d4cec4);' +
                'border-left: 4px solid var(--forest, #2d6a4f);' +
                'border-radius: var(--radius, 6px);' +
                'box-shadow: 0 1px 4px var(--shadow, rgba(43,43,43,0.08));' +
            '}' +

            '.entry-columns {' +
                'display: grid;' +
                'grid-template-columns: 1fr 2fr;' +
                'gap: var(--space-md, 1rem);' +
            '}' +

            '.entry-section {' +
                'display: grid;' +
                'grid-template-columns: 1fr 1fr;' +
                'gap: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);' +
                'align-content: start;' +
            '}' +

            '.entry-auto {' +
                'grid-template-columns: 1fr;' +
            '}' +

            '.entry-auto .entry-field {' +
                'display: flex;' +
                'justify-content: space-between;' +
                'align-items: center;' +
                'padding: 3px 8px;' +
                'background: var(--parchment-warm, #f3efe7);' +
                'border-radius: 3px;' +
                'color: var(--ink-faint, #888);' +
            '}' +

            '.entry-auto .entry-field label {' +
                'font-size: 0.78rem;' +
                'font-weight: 600;' +
                'color: var(--ink-light, #555);' +
            '}' +

            '.entry-auto .entry-field span {' +
                'font-family: var(--font-mono, monospace);' +
                'font-size: 0.82rem;' +
                'color: var(--ink, #2b2b2b);' +
            '}' +

            '.entry-inputs .entry-field {' +
                'display: flex;' +
                'flex-direction: column;' +
                'gap: 2px;' +
            '}' +

            '.entry-inputs .entry-field label {' +
                'font-size: 0.72rem;' +
                'font-weight: 600;' +
                'color: var(--ink-light, #555);' +
            '}' +

            '.entry-field-wide {' +
                'grid-column: 1 / -1;' +
            '}' +

            '.field-notebook-entry input,' +
            '.field-notebook-entry select {' +
                'padding: 4px 6px;' +
                'border: 1px solid var(--border, #d4cec4);' +
                'border-radius: 3px;' +
                'font-family: var(--font-mono, monospace);' +
                'font-size: 0.82rem;' +
                'background: #fff;' +
                'color: var(--ink, #2b2b2b);' +
            '}' +

            '.field-notebook-entry input:focus,' +
            '.field-notebook-entry select:focus {' +
                'outline: none;' +
                'border-color: var(--forest, #2d6a4f);' +
                'box-shadow: 0 0 0 2px rgba(45, 106, 79, 0.15);' +
            '}' +

            '.entry-actions {' +
                'display: flex;' +
                'gap: var(--space-sm, 0.5rem);' +
                'margin-top: var(--space-md, 1rem);' +
                'padding-top: var(--space-sm, 0.5rem);' +
                'border-top: 1px solid var(--border-light, #e8e2d6);' +
            '}';

        document.head.appendChild(style);
    }
}


// -- Module-level helpers --

function escapeCSV(value) {
    var str = String(value);
    if (str.indexOf('"') !== -1 || str.indexOf(',') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}
