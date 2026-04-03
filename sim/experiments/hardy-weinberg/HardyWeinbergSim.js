/**
 * Hardy-Weinberg Equilibrium Simulation.
 *
 * Renders a real-time stacked area chart of genotype frequencies across
 * generations, plus a population proportion bar. Each tick = one generation.
 */

import { Simulation } from '../../engine/Simulation.js';
import { HWPopulation } from './HWPopulation.js';
import { HWDataCollector } from './HWDataCollector.js';
import { HUD } from '../../engine/HUD.js';
import { formatNumber } from '../../engine/utils.js';
import { COLORS } from './config.js';

// Chart layout constants
var CHART_PAD_LEFT = 58;
var CHART_PAD_RIGHT = 16;
var CHART_PAD_TOP = 40;  // room for legend above chart area
var CHART_PAD_BOTTOM = 86; // x-axis labels + title + gap + proportion bar + bar labels
var BAR_HEIGHT = 20;
var BAR_GAP = 38; // enough to clear x-axis tick labels and "Generation" title

export class HardyWeinbergSim extends Simulation {
    init() {
        super.init();

        var cfg = this._config;
        this.maxTicks = cfg.generations;
        this.tickRate = 4; // 4 generations/sec default, feels responsive

        // Population model
        this.environment = new HWPopulation(cfg);

        // Data collector
        this._dataCollector = new HWDataCollector();
        this._dataCollector.mount(this._container);

        // Record generation 0
        this._dataCollector.recordGeneration(0, this.environment);

        // HUD
        this._hud = new HUD(this);
        this._hud.mount(this._container);
        this._updateHUDStats();
    }

    tick() {
        this.environment.update(this.tickCount);
        this._dataCollector.recordGeneration(this.tickCount, this.environment);
        this._updateHUDStats();
    }

    render() {
        var w = this.canvas.width;
        var h = this.canvas.height;
        var ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        var chartLeft = CHART_PAD_LEFT;
        var chartRight = w - CHART_PAD_RIGHT;
        var chartTop = CHART_PAD_TOP;
        var chartBottom = h - CHART_PAD_BOTTOM;
        var chartW = chartRight - chartLeft;
        var chartH = chartBottom - chartTop;

        this._drawChartBackground(ctx, chartLeft, chartTop, chartW, chartH);
        this._drawStackedAreas(ctx, chartLeft, chartTop, chartW, chartH);
        this._drawExpectedLines(ctx, chartLeft, chartTop, chartW, chartH);
        this._drawAxes(ctx, chartLeft, chartTop, chartW, chartH);
        this._drawLegend(ctx, chartLeft, chartW);
        this._drawProportionBar(ctx, chartLeft, chartBottom + BAR_GAP, chartW);
    }

    reset() {
        super.reset();
        if (this.environment) this.environment.reset();
        if (this._dataCollector) this._dataCollector.clear();
        // Re-record generation 0
        if (this.environment && this._dataCollector) {
            this._dataCollector.recordGeneration(0, this.environment);
        }
        if (this._hud) this._updateHUDStats();
    }

    destroy() {
        if (this._hud) this._hud.destroy();
        if (this._dataCollector) this._dataCollector.destroy();
        super.destroy();
    }

    // -- HUD stats --

    _updateHUDStats() {
        var s = this.environment.getAll();
        this._hud.setStats({
            'p (A)': formatNumber(s.p, 4),
            'q (a)': formatNumber(s.q, 4),
            'AA': formatNumber(s.freqAA, 4),
            'Aa': formatNumber(s.freqAa, 4),
            'aa': formatNumber(s.freqaa, 4),
            '\u03C7\u00B2': formatNumber(this.environment.chiSquare(), 4)
        });
    }

    // -- Chart rendering --

    _drawChartBackground(ctx, x, y, w, h) {
        ctx.fillStyle = '#faf8f4'; // parchment
        ctx.fillRect(x, y, w, h);

        // Horizontal grid lines at 0.25 intervals
        ctx.strokeStyle = '#e8e2d6'; // parchment-dark
        ctx.lineWidth = 1;
        for (var i = 1; i < 4; i++) {
            var lineY = y + h - (i * 0.25 * h);
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + w, lineY);
            ctx.stroke();
        }
    }

    _drawStackedAreas(ctx, x, y, w, h) {
        var history = this.environment.history;
        var n = history.length;
        if (n < 1) return;

        // Determine visible window — show at most enough points to fill the chart
        var maxVisible = Math.max(Math.floor(w / 3), 50); // at least ~3px per gen
        var startIdx = 0;
        if (n > maxVisible) startIdx = n - maxVisible;
        var visibleCount = n - startIdx;

        var xScale = visibleCount > 1 ? w / (visibleCount - 1) : w;

        // Draw three stacked areas from bottom: aa, then Aa, then AA on top
        // aa area (bottom)
        ctx.fillStyle = COLORS.aa;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        for (var i = 0; i < visibleCount; i++) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            var py = y + h - entry.freqaa * h;
            if (i === 0) ctx.lineTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.lineTo(x + (visibleCount - 1) * xScale, y + h);
        ctx.closePath();
        ctx.fill();

        // Aa area (middle, stacked on aa)
        ctx.fillStyle = COLORS.Aa;
        ctx.beginPath();
        ctx.moveTo(x, y + h - history[startIdx].freqaa * h);
        for (var i = 0; i < visibleCount; i++) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            var py = y + h - (entry.freqaa + entry.freqAa) * h;
            ctx.lineTo(px, py);
        }
        // Come back along the top of aa
        for (var i = visibleCount - 1; i >= 0; i--) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            var py = y + h - entry.freqaa * h;
            ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // AA area (top, stacked on Aa + aa)
        ctx.fillStyle = COLORS.AA;
        ctx.beginPath();
        ctx.moveTo(x, y + h - (history[startIdx].freqaa + history[startIdx].freqAa) * h);
        for (var i = 0; i < visibleCount; i++) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            // AA stacks on top of Aa + aa, so top of stack = freqaa + freqAa + freqAA = 1.0
            var py = y + h - (entry.freqaa + entry.freqAa + entry.freqAA) * h;
            ctx.lineTo(px, py);
        }
        // Come back along the top of Aa
        for (var i = visibleCount - 1; i >= 0; i--) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            var py = y + h - (entry.freqaa + entry.freqAa) * h;
            ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    _drawExpectedLines(ctx, x, y, w, h) {
        var history = this.environment.history;
        var n = history.length;
        if (n < 2) return;

        var maxVisible = Math.max(Math.floor(w / 3), 50);
        var startIdx = n > maxVisible ? n - maxVisible : 0;
        var visibleCount = n - startIdx;
        var xScale = visibleCount > 1 ? w / (visibleCount - 1) : w;

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = COLORS.expected;
        ctx.lineWidth = 1.5;

        // Expected q² line (boundary between aa and Aa)
        ctx.beginPath();
        for (var i = 0; i < visibleCount; i++) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            var expectedAa = entry.q * entry.q; // q² = expected aa
            var py = y + h - expectedAa * h;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Expected q² + 2pq line (boundary between Aa and AA)
        ctx.beginPath();
        for (var i = 0; i < visibleCount; i++) {
            var entry = history[startIdx + i];
            var px = x + i * xScale;
            var boundary = entry.q * entry.q + 2 * entry.p * entry.q;
            var py = y + h - boundary * h;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.setLineDash([]);
    }

    _drawAxes(ctx, x, y, w, h) {
        var history = this.environment.history;
        var n = history.length;
        var maxVisible = Math.max(Math.floor(w / 3), 50);
        var startIdx = n > maxVisible ? n - maxVisible : 0;

        ctx.strokeStyle = '#2b2b2b'; // ink
        ctx.lineWidth = 1;
        ctx.fillStyle = '#555'; // ink-light
        ctx.font = '11px Consolas, "Fira Code", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();

        // Y-axis labels
        for (var i = 0; i <= 4; i++) {
            var val = i * 0.25;
            var ly = y + h - val * h;
            ctx.fillText(val.toFixed(2), x - 6, ly);
        }

        // Y-axis title
        ctx.save();
        ctx.translate(12, y + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = '12px "Source Sans 3", sans-serif';
        ctx.fillText('Frequency', 0, 0);
        ctx.restore();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();

        // X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '11px Consolas, "Fira Code", monospace';

        var visibleCount = n - startIdx;
        var tickInterval = Math.max(1, Math.ceil(visibleCount / 8));
        for (var i = 0; i < visibleCount; i += tickInterval) {
            var gen = startIdx + i;
            var px = x + (visibleCount > 1 ? i / (visibleCount - 1) * w : 0);
            ctx.fillText(gen, px, y + h + 4);
        }
        // Always label the last generation
        if (n > 1) {
            var lastPx = x + w;
            ctx.fillText(n - 1, lastPx, y + h + 4);
        }

        // X-axis title
        ctx.font = '12px "Source Sans 3", sans-serif';
        ctx.fillText('Generation', x + w / 2, y + h + 18);

    }

    _drawLegend(ctx, chartLeft, chartW) {
        // Draw legend in the dedicated space above the chart (within CHART_PAD_TOP)
        var itemSpacing = 80;
        var swatchSize = 14;
        var fontSize = 13;

        // Center the legend horizontally over the chart
        var totalLegendW = 3 * itemSpacing + 100; // 3 genotype items + HW expected
        var legendX = chartLeft + Math.max(0, (chartW - totalLegendW) / 2);
        var legendY = 22; // vertically centered in the 40px top padding

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = fontSize + 'px "Source Sans 3", sans-serif';

        var items = [
            { label: 'AA', color: COLORS.AA },
            { label: 'Aa', color: COLORS.Aa },
            { label: 'aa', color: COLORS.aa }
        ];

        var curX = legendX;
        for (var i = 0; i < items.length; i++) {
            // Color swatch
            ctx.fillStyle = items[i].color;
            ctx.fillRect(curX, legendY - swatchSize / 2, swatchSize, swatchSize);
            // Border on swatch for visibility
            ctx.strokeStyle = '#d4cec4';
            ctx.lineWidth = 1;
            ctx.strokeRect(curX, legendY - swatchSize / 2, swatchSize, swatchSize);
            // Label
            ctx.fillStyle = '#2b2b2b';
            ctx.fillText(items[i].label, curX + swatchSize + 6, legendY + 1);
            curX += itemSpacing;
        }

        // Dotted line entry for HW expected
        ctx.strokeStyle = COLORS.expected;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(curX, legendY);
        ctx.lineTo(curX + swatchSize, legendY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#555';
        ctx.fillText('HW expected', curX + swatchSize + 6, legendY + 1);
    }

    _drawProportionBar(ctx, x, y, w) {
        var state = this.environment.getAll();
        var freqAA = state.freqAA;
        var freqAa = state.freqAa;
        var freqaa = state.freqaa;
        var N = state.N;

        var barY = y;

        // Draw bar segments
        var aaW = freqaa * w;
        var AaW = freqAa * w;
        var AAW = freqAA * w;

        ctx.fillStyle = COLORS.aa;
        ctx.fillRect(x, barY, aaW, BAR_HEIGHT);

        ctx.fillStyle = COLORS.Aa;
        ctx.fillRect(x + aaW, barY, AaW, BAR_HEIGHT);

        ctx.fillStyle = COLORS.AA;
        ctx.fillRect(x + aaW + AaW, barY, AAW, BAR_HEIGHT);

        // Border
        ctx.strokeStyle = '#d4cec4'; // border color
        ctx.lineWidth = 1;
        ctx.strokeRect(x, barY, w, BAR_HEIGHT);

        // Labels below bar
        ctx.fillStyle = '#555';
        ctx.font = '11px Consolas, "Fira Code", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        var countAA = Math.round(freqAA * N);
        var countaa = Math.round(freqaa * N);
        var countAa = N - countAA - countaa;

        var label = 'AA: ' + countAA + '  |  Aa: ' + countAa + '  |  aa: ' + countaa;
        ctx.fillText(label, x + w / 2, barY + BAR_HEIGHT + 3);
    }
}
