/**
 * ForestEnvironment -- Batesian Mimicry Field Simulation
 *
 * Extends the base Environment to model an Appalachian forest floor
 * for a cover-object transect survey. Owns the spatial layout of
 * cover objects, weather state, and the pre-rendered background
 * canvas (soil, leaf litter, moss, twigs).
 *
 * The forest floor is static per survey -- only cover objects change
 * state as the student flips them. Background is rendered once to an
 * offscreen canvas and blitted each frame for performance.
 */

import { Environment } from '../../engine/Environment.js';
import { randomFloat, randomInt, weightedChoice, shuffle } from '../../engine/utils.js';
import {
    COVER_WEIGHTS,
    COVER_TYPES,
    COLORS,
    SEASONAL_MULTIPLIERS,
    getSeason,
    DEFAULTS
} from './config.js';
import { CoverObject } from './CoverObject.js';
import { WeatherSystem } from './WeatherSystem.js';


// ---- helpers --------------------------------------------------------

/**
 * Sample from a Beta(a, b) distribution using the gamma-based method.
 * Exact for integer shape parameters.
 */
function betaSample(a, b) {
    var x = 0;
    for (var i = 0; i < a; i++) x -= Math.log(Math.random());
    var y = 0;
    for (var i = 0; i < b; i++) y -= Math.log(Math.random());
    return x / (x + y);
}

/**
 * Euclidean distance between two points.
 */
function dist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}


// ---- class ----------------------------------------------------------

export class ForestEnvironment extends Environment {

    constructor(config) {
        super(config);

        var month = config.surveyMonth != null ? parseInt(config.surveyMonth, 10) : DEFAULTS.surveyMonth;
        var day   = config.surveyDay   != null ? parseInt(config.surveyDay, 10)   : DEFAULTS.surveyDay;

        this.weatherSystem = new WeatherSystem(month, day);

        this._state.month           = month;
        this._state.day             = day;
        this._state.season          = getSeason(month);
        this._state.transectLength  = config.coverObjectCount || DEFAULTS.coverObjectCount;
        this._state.coverObjectCount = config.coverObjectCount || DEFAULTS.coverObjectCount;
        this._state.habitat         = config.habitat || DEFAULTS.habitat;

        this.coverObjects = [];
        this._bgCanvas = null;
        this._bgWidth  = 0;
        this._bgHeight = 0;
    }


    // -----------------------------------------------------------------
    // Transect generation
    // -----------------------------------------------------------------

    /**
     * Place cover objects across the canvas in a semi-regular grid
     * with random jitter and Beta-distributed quality scores.
     */
    generateTransect(canvasWidth, canvasHeight) {
        var habitat  = this._state.habitat;
        var count    = this._state.coverObjectCount;
        var season   = this._state.season;

        // Survey area margins -- leave room for HUD at top and progress bar at bottom
        var margin = {
            top:    40,
            bottom: 24,
            left:   12,
            right:  12
        };

        var areaW = canvasWidth  - margin.left - margin.right;
        var areaH = canvasHeight - margin.top  - margin.bottom;

        // Build weighted arrays for cover type selection
        var weights   = COVER_WEIGHTS[habitat] || COVER_WEIGHTS.cove;
        var typeNames = [];
        var typeWts   = [];
        for (var t = 0; t < COVER_TYPES.length; t++) {
            typeNames.push(COVER_TYPES[t]);
            typeWts.push(weights[COVER_TYPES[t]] || 0);
        }

        // Determine how many rows and objects per row
        var hSpacing = randomFloat(60, 100);
        var cols     = Math.max(1, Math.floor(areaW / hSpacing));
        var rows     = Math.max(1, Math.ceil(count / cols));
        var vSpacing = areaH / (rows + 1);

        // Place objects on a jittered grid
        var positions = [];
        var placed = 0;

        for (var r = 0; r < rows && placed < count; r++) {
            var baseY = margin.top + vSpacing * (r + 1);

            for (var c = 0; c < cols && placed < count; c++) {
                var baseX = margin.left + (areaW / (cols + 1)) * (c + 1);

                // Jitter
                var px = baseX + randomFloat(-20, 20);
                var py = baseY + randomFloat(-15, 15);

                // Clamp inside survey area
                if (px < margin.left) px = margin.left + 4;
                if (px > canvasWidth - margin.right) px = canvasWidth - margin.right - 4;
                if (py < margin.top) py = margin.top + 4;
                if (py > canvasHeight - margin.bottom) py = canvasHeight - margin.bottom - 4;

                var coverType = weightedChoice(typeNames, typeWts);

                positions.push({
                    x:    px,
                    y:    py,
                    type: coverType
                });

                placed++;
            }
        }

        // Quality scores from Beta(2, 5) -- right-skewed, most covers are poor quality
        var qualities = [];
        for (var i = 0; i < positions.length; i++) {
            qualities.push(betaSample(2, 5));
        }

        // Spatial correlation: blend quality scores for nearby objects
        var blendRadius  = 80;
        var blendWeight  = 0.30;
        var blended = qualities.slice(); // copy

        for (var i = 0; i < positions.length; i++) {
            var neighbors = 0;
            var neighborSum = 0;

            for (var j = 0; j < positions.length; j++) {
                if (i === j) continue;
                var d = dist(positions[i].x, positions[i].y, positions[j].x, positions[j].y);
                if (d < blendRadius) {
                    neighborSum += qualities[j];
                    neighbors++;
                }
            }

            if (neighbors > 0) {
                var neighborMean = neighborSum / neighbors;
                blended[i] = qualities[i] * (1 - blendWeight) + neighborMean * blendWeight;
            }
        }

        // Create CoverObject instances
        this.coverObjects = [];
        for (var i = 0; i < positions.length; i++) {
            this.coverObjects.push(new CoverObject(
                i,
                positions[i].type,
                positions[i].x,
                positions[i].y,
                blended[i]
            ));
        }
    }


    // -----------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------

    getCoverObjects() {
        return this.coverObjects;
    }

    getWeather() {
        return this.weatherSystem.getCurrentConditions();
    }

    /**
     * Hit-test cover objects at the given canvas coordinates.
     * Checks in reverse order so topmost (last-rendered) objects
     * are found first. Returns the CoverObject or null.
     */
    getObjectAt(mx, my) {
        for (var i = this.coverObjects.length - 1; i >= 0; i--) {
            var obj = this.coverObjects[i];
            if (obj.checked) continue;
            if (obj.hitTest(mx, my)) return obj;
        }
        return null;
    }

    getProgress() {
        var checked = 0;
        for (var i = 0; i < this.coverObjects.length; i++) {
            if (this.coverObjects[i].checked) checked++;
        }
        return { checked: checked, total: this.coverObjects.length };
    }


    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------

    /**
     * Draw the forest floor and all cover objects.
     * The background is pre-rendered to an offscreen canvas and only
     * regenerated on the first call or when dimensions change.
     */
    render(ctx, width, height) {
        // Rebuild offscreen background if needed
        if (!this._bgCanvas || this._bgWidth !== width || this._bgHeight !== height) {
            this._prerenderBackground(width, height);
        }

        // Blit the cached background
        ctx.drawImage(this._bgCanvas, 0, 0);

        // Draw cover objects on top
        for (var i = 0; i < this.coverObjects.length; i++) {
            this.coverObjects[i].render(ctx);
        }
    }

    /**
     * Build the offscreen background canvas: soil, leaf litter,
     * moss patches, twig debris, and transect boundary lines.
     */
    _prerenderBackground(width, height) {
        this._bgCanvas = document.createElement('canvas');
        this._bgCanvas.width  = width;
        this._bgCanvas.height = height;
        this._bgWidth  = width;
        this._bgHeight = height;

        var bg = this._bgCanvas.getContext('2d');
        var season = this._state.season;

        // -- Soil base gradient (top to bottom, slight variation) --
        var gradient = bg.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0,   COLORS.soil);
        gradient.addColorStop(0.6, COLORS.soilLight);
        gradient.addColorStop(1,   COLORS.soil);
        bg.fillStyle = gradient;
        bg.fillRect(0, 0, width, height);

        // -- Leaf litter patches --
        var litterColors = COLORS[season] ? COLORS[season].litter : COLORS.spring.litter;
        var litterCount  = randomInt(80, 150);

        for (var i = 0; i < litterCount; i++) {
            var lx = randomFloat(0, width);
            var ly = randomFloat(0, height);
            var lr = randomFloat(4, 12);
            var la = randomFloat(0.3, 0.6);
            var angle = randomFloat(0, Math.PI * 2);

            bg.save();
            bg.translate(lx, ly);
            bg.rotate(angle);
            bg.globalAlpha = la;
            bg.fillStyle = litterColors[randomInt(0, litterColors.length - 1)];
            bg.beginPath();
            bg.ellipse(0, 0, lr, lr * randomFloat(0.4, 0.8), 0, 0, Math.PI * 2);
            bg.fill();
            bg.restore();
        }

        // -- Moss patches (near lower / wetter portion of canvas) --
        var mossCount = randomInt(5, 10);
        for (var i = 0; i < mossCount; i++) {
            var mx = randomFloat(0, width);
            // Bias toward lower half for wetness
            var my = randomFloat(height * 0.5, height);
            var mr = randomFloat(12, 30);

            bg.save();
            bg.globalAlpha = randomFloat(0.15, 0.25);
            bg.fillStyle = COLORS.moss;
            bg.beginPath();
            bg.arc(mx, my, mr, 0, Math.PI * 2);
            bg.fill();
            bg.restore();
        }

        // -- Twig debris --
        var twigCount = randomInt(15, 25);
        bg.strokeStyle = COLORS.twig;
        bg.lineWidth = 1.5;

        for (var i = 0; i < twigCount; i++) {
            var tx = randomFloat(0, width);
            var ty = randomFloat(0, height);
            var tAngle = randomFloat(0, Math.PI * 2);
            var tLen   = randomFloat(10, 30);

            bg.save();
            bg.globalAlpha = randomFloat(0.4, 0.7);
            bg.beginPath();
            bg.moveTo(tx, ty);
            bg.lineTo(tx + Math.cos(tAngle) * tLen, ty + Math.sin(tAngle) * tLen);
            bg.stroke();
            bg.restore();
        }

        // -- Transect boundary (subtle dashed lines on left/right edges of survey area) --
        var surveyLeft  = 12;
        var surveyRight = width - 12;

        bg.save();
        bg.globalAlpha = 0.2;
        bg.strokeStyle = COLORS.transect;
        bg.lineWidth = 1;
        bg.setLineDash([6, 4]);

        bg.beginPath();
        bg.moveTo(surveyLeft, 40);
        bg.lineTo(surveyLeft, height - 24);
        bg.stroke();

        bg.beginPath();
        bg.moveTo(surveyRight, 40);
        bg.lineTo(surveyRight, height - 24);
        bg.stroke();

        bg.restore();
    }

    /**
     * Thin progress strip along the bottom edge showing cover object
     * check status as colored dots.
     */
    renderProgressBar(ctx, width, height) {
        var barHeight = 12;
        var barY = height - barHeight;

        // Background strip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, barY, width, barHeight);

        if (this.coverObjects.length === 0) return;

        var dotSpacing = width / (this.coverObjects.length + 1);

        for (var i = 0; i < this.coverObjects.length; i++) {
            var obj = this.coverObjects[i];
            var dx  = dotSpacing * (i + 1);
            var dy  = barY + barHeight / 2;

            var radius = obj.highlighted ? 4 : 2.5;

            ctx.beginPath();
            ctx.arc(dx, dy, radius, 0, Math.PI * 2);
            ctx.fillStyle = obj.checked ? '#2d6a4f' : '#ffffff';
            ctx.fill();
        }
    }


    // -----------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------

    /**
     * Per-tick update. Advance weather if doing mid-survey changes.
     */
    update(tick) {
        this.weatherSystem.update(1);
    }

    /**
     * Full reset: regenerate weather, clear objects, invalidate cache.
     */
    reset() {
        super.reset();

        var month = this._config.surveyMonth != null ? this._config.surveyMonth : DEFAULTS.surveyMonth;
        var day   = this._config.surveyDay   != null ? this._config.surveyDay   : DEFAULTS.surveyDay;

        this.weatherSystem = new WeatherSystem(month, day);
        this.coverObjects  = [];
        this._bgCanvas     = null;
        this._bgWidth      = 0;
        this._bgHeight     = 0;
    }
}
