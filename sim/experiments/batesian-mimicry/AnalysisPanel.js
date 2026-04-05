/**
 * AnalysisPanel -- post-survey analysis view for the Batesian mimicry
 * field simulation. Replaces the canvas during the analysis phase and
 * presents summary stats, species frequency charts, ratio analysis,
 * accuracy breakdowns, and guided analysis questions.
 */

import { SPECIES, SPECIES_WEIGHTS } from './config.js';


// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------

var PANEL_CSS = `
.analysis-panel {
    background: var(--parchment);
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;
    font-family: var(--font-body);
    color: var(--ink);
    line-height: 1.6;
}

.analysis-panel h2 {
    font-family: var(--font-heading);
    color: var(--forest-dark);
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
}

.analysis-panel h3 {
    font-family: var(--font-heading);
    color: var(--ocean);
    margin: 2rem 0 1rem;
    font-size: 1.15rem;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 0.4rem;
}

.analysis-panel .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
}

@media (max-width: 600px) {
    .analysis-panel .stat-grid {
        grid-template-columns: 1fr;
    }
}

.analysis-panel .stat-card {
    background: var(--parchment-warm);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
}

.analysis-panel .stat-value {
    font-family: var(--font-mono);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--forest);
    margin: 0;
}

.analysis-panel .stat-label {
    font-size: 0.82rem;
    color: var(--ink-light);
    margin: 0;
}

.analysis-panel .chart-wrap {
    margin: 1rem 0;
    overflow-x: auto;
}

.analysis-panel .chart-wrap canvas {
    display: block;
    max-width: 100%;
}

.analysis-panel .ratio-display {
    font-family: var(--font-mono);
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--forest);
    text-align: center;
    margin: 1rem 0 0.5rem;
}

.analysis-panel .ratio-explanation {
    font-size: 0.9rem;
    color: var(--ink-light);
    max-width: 640px;
    margin: 0 auto 1rem;
    text-align: center;
}

.analysis-panel .ratio-bar-wrap {
    position: relative;
    width: 400px;
    max-width: 100%;
    height: 36px;
    margin: 1rem auto;
    border-radius: 4px;
    overflow: visible;
}

.analysis-panel .ratio-bar-bg {
    width: 100%;
    height: 24px;
    border-radius: 4px;
    background: linear-gradient(to right, #52b788, #b8860b, #bc4749);
}

.analysis-panel .ratio-marker {
    position: absolute;
    top: -4px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 12px solid var(--ink);
    transform: translateX(-8px);
}

.analysis-panel .ratio-labels {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-faint);
    margin-top: 2px;
}

.analysis-panel .accuracy-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    margin: 1rem 0;
}

.analysis-panel .accuracy-table th {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 2px solid var(--border);
    font-weight: 600;
    color: var(--ink-light);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.analysis-panel .accuracy-table td {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--border-light);
}

.analysis-panel .accuracy-table tr.mimic-model-row {
    background: rgba(184, 134, 11, 0.08);
}

.analysis-panel .confusion-note {
    background: var(--parchment-warm);
    border-left: 3px solid var(--gold);
    padding: 0.6rem 1rem;
    font-size: 0.88rem;
    color: var(--ink);
    margin: 0.75rem 0;
    border-radius: 0 var(--radius) var(--radius) 0;
}

.analysis-panel .question-card {
    background: #fff;
    border-left: 3px solid var(--ocean-light);
    border-radius: 0 var(--radius) var(--radius) 0;
    padding: 1rem 1.25rem;
    margin: 0.75rem 0;
}

.analysis-panel .question-text {
    font-weight: 600;
    margin: 0 0 0.3rem;
    font-size: 0.95rem;
}

.analysis-panel .question-hint {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-faint);
    margin: 0 0 0.5rem;
}

.analysis-panel .question-card textarea {
    width: 100%;
    min-height: 3.2rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.9rem;
    resize: vertical;
    background: var(--parchment);
    color: var(--ink);
    box-sizing: border-box;
}

.analysis-panel .question-card textarea:focus {
    outline: none;
    border-color: var(--ocean-light);
    box-shadow: 0 0 0 2px rgba(69, 123, 157, 0.15);
}

.analysis-panel .action-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
}
`;


// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
        for (var k in attrs) {
            if (k === 'className') node.className = attrs[k];
            else if (k === 'textContent') node.textContent = attrs[k];
            else if (k === 'innerHTML') node.innerHTML = attrs[k];
            else node.setAttribute(k, attrs[k]);
        }
    }
    if (children) {
        var list = Array.isArray(children) ? children : [children];
        for (var i = 0; i < list.length; i++) {
            if (typeof list[i] === 'string') {
                node.appendChild(document.createTextNode(list[i]));
            } else if (list[i]) {
                node.appendChild(list[i]);
            }
        }
    }
    return node;
}

function gcd(a, b) {
    a = Math.round(a);
    b = Math.round(b);
    if (b === 0) return a;
    return gcd(b, a % b);
}

function formatRatio(mimicCount, modelCount) {
    if (modelCount === 0 && mimicCount === 0) return '0:0';
    if (modelCount === 0) return mimicCount + ':0';
    if (mimicCount === 0) return '0:' + modelCount;
    var d = gcd(mimicCount, modelCount);
    return (mimicCount / d) + ':' + (modelCount / d);
}

function pct(n, total) {
    if (total === 0) return '0%';
    return Math.round((n / total) * 100) + '%';
}


// -------------------------------------------------------------------
// AnalysisPanel
// -------------------------------------------------------------------

export class AnalysisPanel {

    constructor(container) {
        this._container = container;
        this._root = null;
        this._styleEl = null;
        this._data = null;
        this._downloadCb = null;
        this._newSurveyCb = null;
    }


    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    /**
     * Ingest survey results. Call before mount() or after to refresh.
     */
    load(data) {
        this._data = data;
        this._computed = this._computeStats(data);

        // Re-render if already mounted
        if (this._root) {
            this.destroy();
            this.mount(this._container);
        }
    }

    /**
     * Build and insert the analysis panel DOM into the container.
     */
    mount(container) {
        if (container) this._container = container;

        // Inject styles once
        if (!this._styleEl) {
            this._styleEl = document.createElement('style');
            this._styleEl.textContent = PANEL_CSS;
            document.head.appendChild(this._styleEl);
        }

        this._root = el('div', { className: 'analysis-panel' });

        if (this._data && this._computed) {
            this._buildSummary();
            this._buildSpeciesChart();
            this._buildRatioAnalysis();
            this._buildAccuracyBreakdown();
            this._buildQuestions();
            this._buildActionButtons();
        }

        this._container.appendChild(this._root);
    }

    /** Register callback for CSV download button */
    onDownload(callback) {
        this._downloadCb = callback;
    }

    /** Register callback for "Run Another Survey" button */
    onNewSurvey(callback) {
        this._newSurveyCb = callback;
    }

    /** Tear down and remove DOM */
    destroy() {
        if (this._root && this._root.parentNode) {
            this._root.parentNode.removeChild(this._root);
        }
        if (this._styleEl && this._styleEl.parentNode) {
            this._styleEl.parentNode.removeChild(this._styleEl);
        }
        this._root = null;
        this._styleEl = null;
    }


    // ---------------------------------------------------------------
    // Stats computation
    // ---------------------------------------------------------------

    _computeStats(data) {
        var stats = {};

        // Basic counts
        stats.totalObjects = data.totalObjects || 0;
        stats.checkedObjects = data.checkedObjects || 0;

        // Count animals from notebook rows
        var rows = data.notebookRows || [];
        var hidden = data.hiddenData || [];
        stats.animalsFound = rows.length;

        // Species tallies
        var speciesCounts = {};
        var trueSpeciesCounts = {};
        for (var i = 0; i < rows.length; i++) {
            var id = rows[i]['Species ID'] || rows[i].speciesId;
            if (id) {
                speciesCounts[id] = (speciesCounts[id] || 0) + 1;
            }
            // True species from hidden data
            if (hidden[i]) {
                var trueId = hidden[i]['True Species'] || hidden[i].trueSpecies;
                if (trueId) {
                    trueSpeciesCounts[trueId] = (trueSpeciesCounts[trueId] || 0) + 1;
                }
            }
        }
        stats.speciesCounts = speciesCounts;
        stats.trueSpeciesCounts = trueSpeciesCounts;
        stats.uniqueSpecies = Object.keys(speciesCounts).length;

        // Accuracy
        var acc = data.accuracy || { correct: 0, total: 0, bySpecies: {} };
        stats.correct = acc.correct;
        stats.total = acc.total;
        stats.bySpecies = acc.bySpecies || {};

        // Mimic-model counts (based on student IDs)
        var mimicCount = speciesCounts['PSRU'] || 0;
        var modelCount = speciesCounts['NOVI'] || 0;
        stats.mimicCount = mimicCount;
        stats.modelCount = modelCount;
        stats.ratioString = formatRatio(mimicCount, modelCount);
        stats.ratioDecimal = modelCount > 0 ? mimicCount / modelCount : null;

        // Mimic-model confusion count
        var confusionCount = 0;
        for (var j = 0; j < rows.length; j++) {
            if (!hidden[j]) continue;
            var studentId = rows[j]['Species ID'] || rows[j].speciesId;
            var trueSpecies = hidden[j]['True Species'] || hidden[j].trueSpecies;
            var isConfusion = (
                (studentId === 'NOVI' && trueSpecies === 'PSRU') ||
                (studentId === 'PSRU' && trueSpecies === 'NOVI')
            );
            if (isConfusion) confusionCount++;
        }
        stats.mimicModelConfusions = confusionCount;

        // Weather summary
        var w = data.weather || {};
        stats.weatherSummary = this._formatWeather(w);

        return stats;
    }

    _formatWeather(w) {
        // Accept the description string directly if provided
        if (w.description) return w.description;
        var parts = [];
        var sky = w.sky || w.weatherLabel;
        var temp = w.temp !== undefined ? w.temp : w.temperature;
        if (sky) parts.push(sky);
        if (temp !== undefined) parts.push(Math.round(temp * 10) / 10 + '\u00b0C');
        if (w.humidity !== undefined) parts.push(w.humidity + '% RH');
        if (w.precip) parts.push(w.precip);
        return parts.length > 0 ? parts.join(', ') : 'Not recorded';
    }


    // ---------------------------------------------------------------
    // Section builders
    // ---------------------------------------------------------------

    _buildSummary() {
        var s = this._computed;

        this._root.appendChild(el('h2', { textContent: 'Survey Results' }));

        var grid = el('div', { className: 'stat-grid' });

        grid.appendChild(this._statCard(
            s.checkedObjects + ' / ' + s.totalObjects,
            'Cover Objects Checked'
        ));
        grid.appendChild(this._statCard(
            String(s.animalsFound),
            'Animals Found'
        ));
        grid.appendChild(this._statCard(
            String(s.uniqueSpecies),
            'Species Observed'
        ));
        grid.appendChild(this._statCard(
            pct(s.correct, s.total) + '  (' + s.correct + '/' + s.total + ')',
            'ID Accuracy'
        ));
        grid.appendChild(this._statCard(
            s.ratioString,
            'Mimic\u2009:\u2009Model Ratio'
        ));
        grid.appendChild(this._statCard(
            s.weatherSummary,
            'Survey Conditions'
        ));

        this._root.appendChild(grid);
    }

    _statCard(value, label) {
        var card = el('div', { className: 'stat-card' });
        card.appendChild(el('p', { className: 'stat-value', textContent: value }));
        card.appendChild(el('p', { className: 'stat-label', textContent: label }));
        return card;
    }


    // ---------------------------------------------------------------
    // Species frequency chart
    // ---------------------------------------------------------------

    _buildSpeciesChart() {
        this._root.appendChild(el('h3', { textContent: 'Species Encounter Frequencies' }));

        var canvas = el('canvas', { width: '600', height: '300' });
        var wrap = el('div', { className: 'chart-wrap' }, [canvas]);
        this._root.appendChild(wrap);

        // Defer render so the canvas is in the DOM
        requestAnimationFrame(function () {
            this.renderSpeciesChart(canvas);
        }.bind(this));
    }

    /**
     * Draw horizontal bar chart showing species encounter counts
     * with expected frequency markers for comparison.
     */
    renderSpeciesChart(canvas) {
        var counts = this._computed.speciesCounts;
        var totalAnimals = this._computed.animalsFound;

        // Build sorted species list (highest count first)
        var entries = [];
        var keys = Object.keys(SPECIES);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var count = counts[k] || 0;
            entries.push({ key: k, count: count, species: SPECIES[k] });
        }
        entries.sort(function (a, b) { return b.count - a.count; });

        // Filter to species that were actually encountered or have >1% expected weight
        entries = entries.filter(function (e) {
            return e.count > 0 || (SPECIES_WEIGHTS[e.key] && SPECIES_WEIGHTS[e.key] >= 0.01);
        });

        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var displayW = 600;
        var displayH = Math.max(300, entries.length * 36 + 40);

        canvas.width = displayW * dpr;
        canvas.height = displayH * dpr;
        canvas.style.width = displayW + 'px';
        canvas.style.height = displayH + 'px';
        ctx.scale(dpr, dpr);

        // Background
        var bgStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--parchment').trim() || '#faf8f4';
        ctx.fillStyle = bgStyle;
        ctx.fillRect(0, 0, displayW, displayH);

        var leftMargin = 155;
        var rightMargin = 55;
        var topMargin = 10;
        var barHeight = 22;
        var barGap = 12;
        var chartWidth = displayW - leftMargin - rightMargin;

        var maxCount = 0;
        for (var j = 0; j < entries.length; j++) {
            if (entries[j].count > maxCount) maxCount = entries[j].count;
        }
        // Include expected in max calculation
        for (var m = 0; m < entries.length; m++) {
            var expWeight = SPECIES_WEIGHTS[entries[m].key] || 0;
            var expCount = Math.round(expWeight * totalAnimals);
            if (expCount > maxCount) maxCount = expCount;
        }
        if (maxCount === 0) maxCount = 1;

        // Mono font for numbers
        var monoFont = '11px "Fira Code", Consolas, monospace';
        var labelFont = '12px "Source Sans 3", "Segoe UI", Roboto, sans-serif';

        for (var n = 0; n < entries.length; n++) {
            var entry = entries[n];
            var y = topMargin + n * (barHeight + barGap);
            var barW = (entry.count / maxCount) * chartWidth;

            // Species label (left side)
            ctx.fillStyle = '#2b2b2b';
            ctx.font = labelFont;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(entry.species.commonName, leftMargin - 10, y + barHeight / 2);

            // Bar
            var bodyColor = entry.species.color.body;
            ctx.fillStyle = bodyColor;
            ctx.fillRect(leftMargin, y, Math.max(barW, 1), barHeight);

            // Bar border
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(leftMargin, y, Math.max(barW, 1), barHeight);

            // Count label (right of bar)
            ctx.fillStyle = '#2b2b2b';
            ctx.font = monoFont;
            ctx.textAlign = 'left';
            ctx.fillText(String(entry.count), leftMargin + barW + 6, y + barHeight / 2);

            // Expected frequency marker (dashed vertical line)
            var expectedWeight = SPECIES_WEIGHTS[entry.key] || 0;
            if (expectedWeight > 0 && totalAnimals > 0) {
                var expectedCount = Math.round(expectedWeight * totalAnimals);
                var expX = leftMargin + (expectedCount / maxCount) * chartWidth;

                ctx.save();
                ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(expX, y - 2);
                ctx.lineTo(expX, y + barHeight + 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Legend for expected marker
        var legendY = topMargin + entries.length * (barHeight + barGap) + 4;
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(leftMargin, legendY + 5);
        ctx.lineTo(leftMargin + 16, legendY + 5);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#888';
        ctx.font = '10px "Source Sans 3", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Expected frequency (based on published weights)', leftMargin + 22, legendY + 8);
    }


    // ---------------------------------------------------------------
    // Mimic:Model ratio analysis
    // ---------------------------------------------------------------

    _buildRatioAnalysis() {
        var s = this._computed;

        this._root.appendChild(el('h3', { textContent: 'Mimic-to-Model Ratio' }));

        // Large ratio display
        var ratioLabel = s.ratioString + '  (PSRU : NOVI)';
        this._root.appendChild(el('div', { className: 'ratio-display', textContent: ratioLabel }));

        this._root.appendChild(el('p', {
            className: 'ratio-explanation',
            textContent: 'In Batesian mimicry, protection breaks down when mimics become ' +
                'too common relative to models. Theory predicts the threshold is near 1:1.'
        }));

        // Visual ratio bar
        var barWrap = el('div', { className: 'ratio-bar-wrap' });
        this._root.appendChild(barWrap);

        this.renderRatioBar(barWrap);
    }

    /**
     * Build a horizontal gradient bar from green (low mimic ratio)
     * to red (high mimic ratio) with a marker at the observed value.
     */
    renderRatioBar(container) {
        var s = this._computed;

        // Background gradient bar
        container.appendChild(el('div', { className: 'ratio-bar-bg' }));

        // Place marker -- scale: 0:1 is left edge, 5:1 is right edge
        // We map mimic:model ratio (0 to 5) across the bar width
        var ratio = s.ratioDecimal !== null ? s.ratioDecimal : 0;
        var clampedRatio = Math.min(Math.max(ratio, 0), 5);
        var position = (clampedRatio / 5) * 100;

        var marker = el('div', { className: 'ratio-marker' });
        marker.style.left = position + '%';
        container.appendChild(marker);

        // Scale labels
        var labels = el('div', { className: 'ratio-labels' });
        var labelValues = ['0:1', '1:3', '1:1', '3:1', '5:1'];
        for (var i = 0; i < labelValues.length; i++) {
            labels.appendChild(el('span', { textContent: labelValues[i] }));
        }
        container.appendChild(labels);
    }


    // ---------------------------------------------------------------
    // Accuracy breakdown
    // ---------------------------------------------------------------

    _buildAccuracyBreakdown() {
        var s = this._computed;

        this._root.appendChild(el('h3', { textContent: 'Identification Accuracy' }));

        var table = el('table', { className: 'accuracy-table' });
        var thead = el('thead');
        var headerRow = el('tr');
        var headers = ['Species', 'Correct', 'Total', 'Accuracy'];
        for (var h = 0; h < headers.length; h++) {
            headerRow.appendChild(el('th', { textContent: headers[h] }));
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        var tbody = el('tbody');
        var keys = Object.keys(SPECIES);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var sp = SPECIES[k];
            var bySpecies = s.bySpecies[k];
            if (!bySpecies && !s.speciesCounts[k]) continue;

            var correct = bySpecies ? (bySpecies.correct || 0) : 0;
            var total = bySpecies ? (bySpecies.total || 0) : (s.speciesCounts[k] || 0);

            var row = el('tr');
            if (k === 'NOVI' || k === 'PSRU') {
                row.className = 'mimic-model-row';
            }

            row.appendChild(el('td', { textContent: sp.commonName + ' (' + k + ')' }));
            row.appendChild(el('td', { textContent: String(correct) }));
            row.appendChild(el('td', { textContent: String(total) }));
            row.appendChild(el('td', { textContent: pct(correct, total) }));

            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        this._root.appendChild(table);

        // Mimic-model confusion note
        if (s.mimicModelConfusions > 0) {
            var noteText = 'You confused the mimic and model ' + s.mimicModelConfusions +
                ' time' + (s.mimicModelConfusions > 1 ? 's' : '') +
                '. In a real survey, this would affect your mimic:model ratio estimate.';
            this._root.appendChild(el('div', { className: 'confusion-note', textContent: noteText }));
        }
    }


    // ---------------------------------------------------------------
    // Guided questions
    // ---------------------------------------------------------------

    _buildQuestions() {
        var s = this._computed;

        this._root.appendChild(el('h3', { textContent: 'Analysis Questions' }));

        var questions = [
            {
                text: '1. What is the mimic-to-model ratio from your data? Express as a ratio (e.g., 1:3).',
                hint: 'Your calculated ratio: ' + s.ratioString + ' (PSRU:NOVI = ' +
                      s.mimicCount + ':' + s.modelCount + ')'
            },
            {
                text: '2. What fraction of cover objects contained salamanders? ' +
                      'What does this tell you about detection probability?',
                hint: 'Objects with animals: ' + s.animalsFound + ' found under ' +
                      s.checkedObjects + ' checked objects'
            },
            {
                text: '3. Which species was most commonly encountered? ' +
                      'Is this consistent with published Appalachian survey data?',
                hint: this._mostCommonHint()
            },
            {
                text: '4. At what mimic:model ratio does theory predict mimicry breaks down? ' +
                      'How does your ratio compare?',
                hint: null
            },
            {
                text: '5. List three potential sources of error in your data.',
                hint: null
            }
        ];

        for (var i = 0; i < questions.length; i++) {
            var q = questions[i];
            var card = el('div', { className: 'question-card' });
            card.appendChild(el('p', { className: 'question-text', textContent: q.text }));
            if (q.hint) {
                card.appendChild(el('p', { className: 'question-hint', textContent: q.hint }));
            }
            var textarea = el('textarea', { rows: '3', placeholder: 'Your answer...' });
            card.appendChild(textarea);
            this._root.appendChild(card);
        }
    }

    _mostCommonHint() {
        var counts = this._computed.speciesCounts;
        var best = null;
        var bestCount = 0;
        for (var k in counts) {
            if (counts[k] > bestCount) {
                bestCount = counts[k];
                best = k;
            }
        }
        if (!best) return null;
        var name = SPECIES[best] ? SPECIES[best].commonName : best;
        return 'Most common: ' + name + ' (' + bestCount + ' encounters)';
    }


    // ---------------------------------------------------------------
    // Action buttons
    // ---------------------------------------------------------------

    _buildActionButtons() {
        var wrap = el('div', { className: 'action-buttons' });
        var self = this;

        var dlBtn = el('button', { className: 'btn btn-primary', textContent: 'Download CSV' });
        dlBtn.addEventListener('click', function () {
            if (self._downloadCb) self._downloadCb();
        });

        var newBtn = el('button', { className: 'btn btn-secondary', textContent: 'Run Another Survey' });
        newBtn.addEventListener('click', function () {
            if (self._newSurveyCb) self._newSurveyCb();
        });

        wrap.appendChild(dlBtn);
        wrap.appendChild(newBtn);
        this._root.appendChild(wrap);
    }
}
