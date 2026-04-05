/**
 * Salamander -- individual animal for the Batesian mimicry field survey.
 *
 * Each instance is a single salamander found during a cover object survey.
 * Traits are drawn from species-level distributions (config.js) with
 * individual stochastic variation for size, color, and health.
 */

import { Agent } from '../../engine/Agent.js';
import { gaussianRandom, clamp, randomFloat } from '../../engine/utils.js';
import { SPECIES, HEALTH_CONDITIONS, PCIN_MORPHS, getMimicDifficulty } from './config.js';


// -------------------------------------------------------------------
// Color helpers
// -------------------------------------------------------------------

/**
 * Parse a hex color string to {r, g, b}.
 */
function hexToRgb(hex) {
    var n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Convert RGB to HSL. Returns {h, s, l} where h is [0,360), s and l [0,1].
 */
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
        h *= 360;
    }
    return { h: h, s: s, l: l };
}

/**
 * Convert HSL back to a CSS hex string.
 */
function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/**
 * Shift a hex color by hue degrees and saturation amount.
 */
function adjustColor(hex, hueOffset, satOffset) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hslToHex(hsl.h + hueOffset, hsl.s + satOffset, hsl.l);
}


// -------------------------------------------------------------------
// Weighted random from a { key: weight } object
// -------------------------------------------------------------------

function weightedPick(obj) {
    var keys = Object.keys(obj);
    var total = 0;
    for (var i = 0; i < keys.length; i++) total += obj[keys[i]];
    var r = Math.random() * total;
    var cum = 0;
    for (var i = 0; i < keys.length; i++) {
        cum += obj[keys[i]];
        if (r < cum) return keys[i];
    }
    return keys[keys.length - 1];
}


// -------------------------------------------------------------------
// Drawing helper -- works at any scale
// -------------------------------------------------------------------

/**
 * Draw a salamander body at the given position and length.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx       - center x
 * @param {number} cy       - center y
 * @param {number} len      - total body length in px (head to tail tip)
 * @param {Object} sp       - species config from SPECIES
 * @param {Object} traits   - individual traits from this agent
 * @param {boolean} detail  - draw extra detail (large view)
 */
function drawSalamanderBody(ctx, cx, cy, len, sp, traits, detail) {
    var headR = sp.bodyProportions.headRatio;
    var tailR = sp.bodyProportions.tailRatio;
    var trunkR = 1 - headR - tailR;

    var headLen = len * headR;
    var trunkLen = len * trunkR;
    var tailLen = len * tailR;

    // body width scales with length
    var bodyW = len * 0.12;
    var headW = bodyW * 1.15;
    var tailTip = bodyW * 0.15;

    // individual body color
    var bodyColor = adjustColor(sp.color.body, traits.bodyHueOffset, traits.bodySatOffset);

    // positions (head on the left, tail on the right)
    var headStart = cx - len / 2;
    var trunkStart = headStart + headLen;
    var tailStart = trunkStart + trunkLen;
    var tailEnd = tailStart + tailLen;

    ctx.save();

    // --- Costal grooves (plethodontids, detail view) ---
    if (detail && sp.costalGrooves > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 0.6;
        var grooveSpacing = trunkLen / (sp.costalGrooves + 1);
        for (var i = 1; i <= sp.costalGrooves; i++) {
            var gx = trunkStart + i * grooveSpacing;
            // Subtle curved lines that follow the body contour
            ctx.beginPath();
            ctx.moveTo(gx, cy - bodyW * 0.82);
            ctx.quadraticCurveTo(gx + 0.8, cy, gx, cy + bodyW * 0.82);
            ctx.stroke();
        }
    }

    // --- Body (trunk) ---
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(trunkStart + trunkLen / 2, cy, trunkLen / 2, bodyW, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Head ---
    ctx.beginPath();
    ctx.ellipse(headStart + headLen * 0.5, cy, headLen * 0.55, headW, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Tail ---
    ctx.beginPath();
    ctx.moveTo(tailStart, cy - bodyW * 0.8);
    ctx.quadraticCurveTo(tailStart + tailLen * 0.6, cy - bodyW * 0.5, tailEnd, cy - tailTip);
    ctx.lineTo(tailEnd, cy + tailTip);
    ctx.quadraticCurveTo(tailStart + tailLen * 0.6, cy + bodyW * 0.5, tailStart, cy + bodyW * 0.8);
    ctx.closePath();
    ctx.fill();

    // keeled tail ridge
    if (sp.tailShape === 'keeled') {
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = detail ? 1.0 : 0.5;
        ctx.beginPath();
        ctx.moveTo(tailStart + tailLen * 0.1, cy - bodyW * 0.65);
        ctx.quadraticCurveTo(tailStart + tailLen * 0.5, cy - bodyW * 0.7, tailEnd, cy - tailTip * 0.5);
        ctx.stroke();
    }

    // --- Skin texture and sheen (detail view) ---
    if (detail) {
        if (sp.skinTexture === 'granular') {
            // Dense stippling for rough newt skin -- seeded for frame consistency
            var stippleSeed = traits.svl * 1000 + traits.mass * 100;
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (var i = 0; i < 120; i++) {
                // Simple seeded pseudo-random using sine hash
                var hash = Math.sin(stippleSeed + i * 127.1) * 43758.5453;
                var hx = hash - Math.floor(hash);
                hash = Math.sin(stippleSeed + i * 269.5) * 43758.5453;
                var hy = hash - Math.floor(hash);
                var tx = headStart + hx * (tailEnd - headStart);
                var ty = cy + (hy - 0.5) * bodyW * 1.8;
                ctx.beginPath();
                ctx.arc(tx, ty, 0.4 + (hx * 0.4), 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (sp.skinTexture === 'smooth' || sp.skinTexture === 'smooth-sticky') {
            // Dorsal highlight -- radial gradient along the spine
            var dorsalGrad = ctx.createRadialGradient(
                trunkStart + trunkLen / 2, cy - bodyW * 0.1, 0,
                trunkStart + trunkLen / 2, cy - bodyW * 0.1, bodyW * 0.6
            );
            dorsalGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
            dorsalGrad.addColorStop(0.4, 'rgba(255,255,255,0.06)');
            dorsalGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = dorsalGrad;
            ctx.beginPath();
            ctx.ellipse(trunkStart + trunkLen / 2, cy, trunkLen / 2, bodyW, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ventral shadow -- darken the lower edges
            var ventralGrad = ctx.createLinearGradient(
                trunkStart, cy - bodyW, trunkStart, cy + bodyW
            );
            ventralGrad.addColorStop(0, 'rgba(0,0,0,0)');
            ventralGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
            ventralGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
            ctx.fillStyle = ventralGrad;
            ctx.beginPath();
            ctx.ellipse(trunkStart + trunkLen / 2, cy, trunkLen / 2, bodyW, 0, 0, Math.PI * 2);
            ctx.fill();

            // Specular wet spots -- 2-3 small bright ellipses, seeded positions
            var specSeed = traits.svl * 73 + traits.mass * 37;
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            for (var si = 0; si < 3; si++) {
                var sh = Math.sin(specSeed + si * 191.7) * 43758.5453;
                var sx = sh - Math.floor(sh);
                sh = Math.sin(specSeed + si * 311.3) * 43758.5453;
                var sy = sh - Math.floor(sh);
                var specX = trunkStart + sx * trunkLen;
                var specY = cy - bodyW * 0.3 + sy * bodyW * 0.4;
                ctx.beginPath();
                ctx.ellipse(specX, specY, 2.5, 1.2, sx * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // --- Belly hint (detail view, slight ventral edge) ---
    if (detail && sp.color.belly) {
        ctx.fillStyle = sp.color.belly;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(trunkStart + trunkLen / 2, cy + bodyW * 0.85, trunkLen / 2.5, bodyW * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // --- Spot patterns ---
    drawSpots(ctx, sp, traits, headStart, trunkStart, trunkLen, tailStart, tailLen, cy, bodyW, detail);

    // --- Dorsal stripe (P. cinereus striped morph) ---
    if (sp.key === 'PLCI' && traits.morph === 'striped' && sp.color.stripe) {
        ctx.fillStyle = sp.color.stripe;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(trunkStart + trunkLen / 2, cy, trunkLen / 2.2, bodyW * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // stripe continues onto tail
        ctx.beginPath();
        ctx.moveTo(tailStart, cy - bodyW * 0.28);
        ctx.quadraticCurveTo(tailStart + tailLen * 0.5, cy - bodyW * 0.2, tailEnd, cy);
        ctx.lineTo(tailEnd, cy);
        ctx.quadraticCurveTo(tailStart + tailLen * 0.5, cy + bodyW * 0.2, tailStart, cy + bodyW * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // erythristic morph -- reddish all over
    if (sp.key === 'PLCI' && traits.morph === 'erythristic') {
        ctx.fillStyle = 'rgba(180, 60, 30, 0.25)';
        ctx.beginPath();
        ctx.ellipse(trunkStart + trunkLen / 2, cy, trunkLen / 2, bodyW, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Jaw line (Desmognathus) ---
    if (detail && sp.color.jawLine) {
        ctx.strokeStyle = sp.color.jawLine;
        ctx.lineWidth = detail ? 1.2 : 0.5;
        ctx.beginPath();
        var eyeX = headStart + headLen * 0.55;
        ctx.moveTo(eyeX, cy - headW * 0.3);
        ctx.quadraticCurveTo(headStart + headLen * 0.85, cy + headW * 0.4, headStart + headLen, cy + headW * 0.6);
        ctx.stroke();
    }

    // --- Limbs ---
    drawLimbs(ctx, trunkStart, trunkLen, cy, bodyW, len, bodyColor, detail);

    // --- Eye (three-layer rendering in detail view) ---
    var eyeX = headStart + headLen * 0.55;
    var eyeY = cy - headW * 0.25;
    var eyeR = detail ? len * 0.012 : Math.max(1, len * 0.015);

    if (detail) {
        // Layer 1: iris ring (species-specific color)
        var irisColor = sp.color.eye || '#222';
        var irisR = eyeR * 1.8;
        ctx.fillStyle = irisColor;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Layer 2: dark pupil
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeR * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Layer 3: specular highlight (upper-left)
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(eyeX - eyeR * 0.4, eyeY - eyeR * 0.4, eyeR * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // For PSRU: emphasize the gold iris with a wider ring and subtle glow
        if (sp.key === 'PSRU') {
            ctx.strokeStyle = sp.color.eye;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, irisR + 0.5, 0, Math.PI * 2);
            ctx.stroke();
        }
    } else {
        // Simple dot at small scale
        ctx.fillStyle = sp.color.eye || '#222';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}


/**
 * Draw spot patterns on the body.
 */
function drawSpots(ctx, sp, traits, headStart, trunkStart, trunkLen, tailStart, tailLen, cy, bodyW, detail) {
    var pattern = sp.spotPattern;
    // morphed PLCI overrides
    if (sp.key === 'PLCI') {
        if (traits.morph === 'striped' || traits.morph === 'erythristic') pattern = 'none';
        if (traits.morph === 'leadback') pattern = 'none';
    }

    if (pattern === 'bordered-rows') {
        // NOVI: two rows of red spots with black borders
        var spotR = detail ? 3 : 1.5;
        var count = detail ? 8 : 5;
        for (var row = -1; row <= 1; row += 2) {
            for (var i = 0; i < count; i++) {
                var sx = trunkStart + (i + 0.5) * (trunkLen / count);
                var sy = cy + row * bodyW * 0.45;
                // black border
                ctx.fillStyle = sp.color.spotBorder || '#111';
                ctx.beginPath();
                ctx.arc(sx, sy, spotR + (detail ? 1 : 0.5), 0, Math.PI * 2);
                ctx.fill();
                // red center
                ctx.fillStyle = sp.color.spots || '#cc2200';
                ctx.beginPath();
                ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (pattern === 'scattered') {
        // PSRU: random black dots
        var count = detail ? 20 : 8;
        ctx.fillStyle = sp.color.spots || '#222';
        for (var i = 0; i < count; i++) {
            var sx = trunkStart + randomFloat(0, trunkLen);
            var sy = cy + randomFloat(-bodyW * 0.7, bodyW * 0.7);
            var sr = detail ? randomFloat(1, 2.5) : randomFloat(0.5, 1.2);
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (pattern === 'flecked') {
        // PLGL: white/silver flecks
        var count = detail ? 30 : 10;
        ctx.fillStyle = sp.color.flecks || '#c0c0c0';
        for (var i = 0; i < count; i++) {
            var sx = trunkStart + randomFloat(-trunkLen * 0.05, trunkLen * 1.05);
            var sy = cy + randomFloat(-bodyW * 0.8, bodyW * 0.8);
            var sr = detail ? randomFloat(0.5, 1.5) : randomFloat(0.3, 0.8);
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (pattern === 'blotched') {
        // DEFU: darker patches
        var count = detail ? 6 : 3;
        for (var i = 0; i < count; i++) {
            var sx = trunkStart + randomFloat(trunkLen * 0.1, trunkLen * 0.9);
            var sy = cy + randomFloat(-bodyW * 0.4, bodyW * 0.4);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(sx, sy, randomFloat(3, 6) * (detail ? 1.5 : 0.8), randomFloat(2, 4) * (detail ? 1.5 : 0.8), randomFloat(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (pattern === 'lined') {
        // EUBI: two parallel dark lines
        ctx.strokeStyle = sp.color.lines || '#4a3a28';
        ctx.lineWidth = detail ? 1.5 : 0.7;
        for (var row = -1; row <= 1; row += 2) {
            ctx.beginPath();
            ctx.moveTo(trunkStart, cy + row * bodyW * 0.5);
            ctx.lineTo(tailStart + tailLen * 0.6, cy + row * bodyW * 0.35);
            ctx.stroke();
        }
    } else if (pattern === 'faint-mottled') {
        // GYPO: subtle mottling
        var count = detail ? 15 : 5;
        for (var i = 0; i < count; i++) {
            var sx = trunkStart + randomFloat(0, trunkLen);
            var sy = cy + randomFloat(-bodyW * 0.6, bodyW * 0.6);
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath();
            ctx.ellipse(sx, sy, randomFloat(2, 5) * (detail ? 1.5 : 0.7), randomFloat(1.5, 3) * (detail ? 1.5 : 0.7), randomFloat(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (pattern === 'reticulated') {
        // DEMO: net-like dorsal pattern
        var count = detail ? 12 : 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = detail ? 0.8 : 0.4;
        for (var i = 0; i < count; i++) {
            var sx = trunkStart + randomFloat(0, trunkLen);
            var sy = cy + randomFloat(-bodyW * 0.5, bodyW * 0.5);
            ctx.beginPath();
            ctx.ellipse(sx, sy, randomFloat(3, 7), randomFloat(2, 5), randomFloat(0, Math.PI), 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}


/**
 * Draw four small limbs as bent lines.
 */
function drawLimbs(ctx, trunkStart, trunkLen, cy, bodyW, totalLen, color, detail) {
    var limbLen = totalLen * 0.09;
    ctx.strokeStyle = color;
    ctx.lineWidth = detail ? 2 : 1;
    ctx.lineCap = 'round';

    // front limbs near the start of trunk
    var fx = trunkStart + trunkLen * 0.12;
    // hind limbs near the end of trunk
    var hx = trunkStart + trunkLen * 0.88;

    var pairs = [
        { x: fx, dir: -1 },  // front-top
        { x: fx, dir: 1 },   // front-bottom
        { x: hx, dir: -1 },  // hind-top
        { x: hx, dir: 1 }    // hind-bottom
    ];

    for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        var baseY = cy + p.dir * bodyW * 0.7;
        var elbowX = p.x + (i < 2 ? -limbLen * 0.5 : limbLen * 0.5);
        var elbowY = baseY + p.dir * limbLen * 0.6;
        var tipX = elbowX + (i < 2 ? -limbLen * 0.3 : limbLen * 0.3);
        var tipY = elbowY + p.dir * limbLen * 0.4;

        ctx.beginPath();
        ctx.moveTo(p.x, baseY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Toe suggestions at detail scale
        if (detail) {
            var toeLen = limbLen * 0.18;
            var toeSpread = 0.4;
            ctx.lineWidth = 1;
            for (var t = -1; t <= 1; t++) {
                var angle = (i < 2 ? -0.8 : 0.8) + t * toeSpread;
                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX + Math.cos(angle) * toeLen, tipY + Math.sin(angle) * toeLen * p.dir);
                ctx.stroke();
            }
            ctx.lineWidth = detail ? 2 : 1;
        }
    }
}


// -------------------------------------------------------------------
// Salamander class
// -------------------------------------------------------------------

export class Salamander extends Agent {
    /**
     * @param {string} speciesKey - key from SPECIES (e.g. 'NOVI', 'PSRU', 'PLCI')
     */
    constructor(speciesKey) {
        var sp = SPECIES[speciesKey];
        if (!sp) throw new Error('Unknown species key: ' + speciesKey);

        // measurements from gaussian distributions, clamped to species range
        var svl = clamp(gaussianRandom(sp.svl.mean, sp.svl.sd), sp.svl.min, sp.svl.max);
        var totalLength = clamp(gaussianRandom(sp.tl.mean, sp.tl.sd), sp.tl.min, sp.tl.max);
        var mass = clamp(gaussianRandom(sp.mass.mean, sp.mass.sd), sp.mass.min, sp.mass.max);

        // individual color variation
        var bodyHueOffset = randomFloat(sp.color.bodyRange[0], sp.color.bodyRange[1]);
        var bodySatOffset = randomFloat(sp.color.satRange[0], sp.color.satRange[1]);

        // health condition
        var healthCondition = weightedPick(HEALTH_CONDITIONS);

        // morph (PLCI only)
        var morph = null;
        if (speciesKey === 'PLCI') {
            morph = weightedPick(PCIN_MORPHS);
        }

        // sex assignment: 45% M, 45% F, 10% unknown
        var sexRoll = Math.random();
        var sex = sexRoll < 0.45 ? 'M' : sexRoll < 0.90 ? 'F' : 'unknown';

        // age class from SVL relative to species range
        var svlFrac = (svl - sp.svl.min) / (sp.svl.max - sp.svl.min);
        var ageClass;
        if (svlFrac < 0.25) ageClass = 'juvenile';
        else if (svlFrac < 0.65) ageClass = 'subadult';
        else ageClass = 'adult';

        // ID difficulty -- for PSRU it depends on SVL (mimic difficulty)
        var idDifficulty = sp.idDifficulty;
        if (speciesKey === 'PSRU') {
            idDifficulty = getMimicDifficulty(svl);
        }

        // build traits
        var traits = {
            species: sp,
            speciesKey: speciesKey,
            commonName: sp.commonName,
            scientificName: sp.scientificName,
            role: sp.role,
            toxic: sp.toxic,
            svl: Math.round(svl * 10) / 10,
            totalLength: Math.round(totalLength * 10) / 10,
            mass: Math.round(mass * 100) / 100,
            sex: sex,
            ageClass: ageClass,
            bodyHueOffset: bodyHueOffset,
            bodySatOffset: bodySatOffset,
            healthCondition: healthCondition,
            morph: morph,
            idDifficulty: idDifficulty
        };

        super(traits);
    }

    /**
     * Draw the salamander at small scale (~40-60px body) at this.x, this.y.
     * Used for the field survey canvas.
     */
    render(ctx) {
        var t = this.traits;
        var sp = t.species;
        // body length in pixels: scale from SVL relative to species range
        var frac = (t.svl - sp.svl.min) / (sp.svl.max - sp.svl.min);
        var bodyLen = 40 + frac * 20; // 40 to 60px
        drawSalamanderBody(ctx, this.x, this.y, bodyLen, sp, t, false);
    }

    /**
     * Draw an enlarged view (~200-300px) for the ID challenge panel.
     * More detail visible: skin texture, costal grooves, eye color, belly hint.
     */
    renderLarge(ctx, x, y, w, h) {
        var t = this.traits;
        var sp = t.species;
        // fit body length into the provided bounds
        var bodyLen = Math.min(w * 0.85, h * 2.5);
        bodyLen = clamp(bodyLen, 200, 300);
        var cx = x + w / 2;
        var cy = y + h / 2;
        drawSalamanderBody(ctx, cx, cy, bodyLen, sp, t, true);
    }

    /**
     * Observable features for the ID challenge.
     * These are what a student would notice looking at the animal.
     */
    getIdentifyingFeatures() {
        var sp = this.traits.species;
        var sizeLabel;
        if (this.traits.totalLength < 80) sizeLabel = 'small';
        else if (this.traits.totalLength < 130) sizeLabel = 'medium';
        else sizeLabel = 'large';

        return {
            skinTexture: sp.skinTexture,
            spotPattern: sp.spotPattern,
            tailShape: sp.tailShape,
            bodyShape: sp.bodyProportions.headRatio > 0.19 ? 'compact' : 'elongated',
            eyeColor: sp.color.eye,
            size: sizeLabel,
            costalGrooves: sp.costalGrooves
        };
    }

    /**
     * True measurements for auto-populating the field notebook.
     */
    getFieldMeasurements() {
        return {
            svl: this.traits.svl,
            totalLength: this.traits.totalLength,
            mass: this.traits.mass
        };
    }
}
