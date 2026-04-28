/**
 * Batesian Mimicry Simulation -- Procedural Vegetation Textures
 *
 * Runtime canvas texture generation for cross-billboard vegetation
 * meshes in the 3D forest scene. Each method returns a
 * THREE.CanvasTexture with transparent alpha for alpha-cutout
 * rendering on instanced quad geometry.
 *
 * Color palette sampled from Appalachian cove hardwood reference
 * photographs -- spring ephemeral season (April--May).
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';


// ---------------------------------------------------------------
// Seeded PRNG (Mulberry32) -- deterministic but fast
// ---------------------------------------------------------------

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}


export class VegetationTextures {

    constructor(seed) {
        this.seed = seed || 7741;
        this.rng = mulberry32(this.seed);
    }


    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    _rand(min, max) {
        return min + this.rng() * (max - min);
    }

    _randInt(min, max) {
        return Math.floor(this._rand(min, max + 1));
    }

    _pick(arr) {
        return arr[Math.floor(this.rng() * arr.length)];
    }

    _parseHex(hex) {
        return [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
        ];
    }

    _rgbaStr(r, g, b, a) {
        return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';
    }

    _hexToRgba(hex, alpha) {
        var c = this._parseHex(hex);
        return this._rgbaStr(c[0], c[1], c[2], alpha);
    }

    _varyColor(hex, hueRange, satRange, valRange) {
        var c = this._parseHex(hex);
        var r = c[0] + this._rand(hueRange[0], hueRange[1]);
        var g = c[1] + this._rand(satRange[0], satRange[1]);
        var b = c[2] + this._rand(valRange[0], valRange[1]);
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return this._rgbaStr(r, g, b, 1);
    }

    _lerpHex(hex1, hex2, t) {
        var c1 = this._parseHex(hex1);
        var c2 = this._parseHex(hex2);
        var r = c1[0] + (c2[0] - c1[0]) * t;
        var g = c1[1] + (c2[1] - c1[1]) * t;
        var b = c1[2] + (c2[2] - c1[2]) * t;
        return this._rgbaStr(r, g, b, 1);
    }

    _makeCanvas(w, h) {
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        return { canvas: canvas, ctx: ctx };
    }

    _toTexture(canvas) {
        var tex = new THREE.CanvasTexture(canvas);
        tex.premultiplyAlpha = false;
        tex.needsUpdate = true;
        return tex;
    }


    // ---------------------------------------------------------------
    // Fern frond texture
    //
    // Two overlapping Christmas fern fronds with detailed pinnae,
    // secondary veins, and subtle color variation along the rachis.
    // ---------------------------------------------------------------

    createFernTexture(width, height) {
        width = width || 512;
        height = height || 512;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        // Draw two fronds offset from each other for density
        this._drawFernFrond(ctx, width * 0.42, height * 0.95, width * 0.5, height * 0.06,
            -0.08, 18, width, height);
        this._drawFernFrond(ctx, width * 0.58, height * 0.98, width * 0.48, height * 0.1,
            0.06, 16, width, height);

        return this._toTexture(c.canvas);
    }

    _drawFernFrond(ctx, baseX, baseY, tipX, tipY, curveBias, pinnaCount, cw, ch) {
        var spineColor = '#1e4a18';
        var pinnaColors = ['#2a5a20', '#327228', '#2e6424', '#38682c', '#265c1e'];
        var lightEdge = '#4a8a3e';

        // Compute spine as a quadratic bezier
        var cpx = (baseX + tipX) / 2 + curveBias * cw;
        var cpy = (baseY + tipY) / 2;

        // Draw the central rachis (spine)
        ctx.save();
        ctx.strokeStyle = spineColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(cpx, cpy, tipX, tipY);
        ctx.stroke();

        // Draw pinnae along the spine
        for (var i = 0; i < pinnaCount; i++) {
            var t = (i + 1) / (pinnaCount + 1);
            // Position along the bezier
            var sx = (1 - t) * (1 - t) * baseX + 2 * (1 - t) * t * cpx + t * t * tipX;
            var sy = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * cpy + t * t * tipY;

            // Tangent direction for angle
            var tx = 2 * (1 - t) * (cpx - baseX) + 2 * t * (tipX - cpx);
            var ty = 2 * (1 - t) * (cpy - baseY) + 2 * t * (tipY - cpy);
            var spineAngle = Math.atan2(ty, tx);

            // Pinnae get smaller toward the tip, wider at the base
            var taper = 1 - t * 0.65;
            var pinnaLen = cw * 0.18 * taper + this._rand(-3, 3);
            var pinnaWidth = ch * 0.018 * taper + this._rand(-1, 1);

            // Draw left pinna
            this._drawPinna(ctx, sx, sy, spineAngle - Math.PI * 0.38,
                pinnaLen, pinnaWidth, this._pick(pinnaColors), lightEdge);

            // Draw right pinna
            this._drawPinna(ctx, sx, sy, spineAngle + Math.PI * 0.38,
                pinnaLen, pinnaWidth, this._pick(pinnaColors), lightEdge);
        }

        ctx.restore();
    }

    _drawPinna(ctx, ox, oy, angle, len, width, fillColor, edgeColor) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(angle);

        // Main pinna shape -- tapered elongated leaf
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
            len * 0.3, -width * 1.2,
            len * 0.7, -width * 0.9,
            len, 0
        );
        ctx.bezierCurveTo(
            len * 0.7, width * 0.9,
            len * 0.3, width * 1.2,
            0, 0
        );
        ctx.fill();

        // Lighter edge highlight
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(len * 0.1, -width * 0.8);
        ctx.bezierCurveTo(
            len * 0.4, -width * 1.0,
            len * 0.7, -width * 0.6,
            len * 0.95, 0
        );
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Central vein
        ctx.strokeStyle = '#1a4215';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(1, 0);
        ctx.lineTo(len * 0.92, 0);
        ctx.stroke();

        // Secondary veins (3--5 per pinna)
        var veinCount = Math.max(2, Math.floor(len / 12));
        ctx.strokeStyle = '#1e4a18';
        ctx.lineWidth = 0.3;
        ctx.globalAlpha = 0.6;
        for (var v = 0; v < veinCount; v++) {
            var vt = (v + 1) / (veinCount + 1);
            var vx = len * vt;
            ctx.beginPath();
            ctx.moveTo(vx, 0);
            ctx.lineTo(vx + len * 0.06, -width * 0.6 * (1 - vt * 0.3));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(vx, 0);
            ctx.lineTo(vx + len * 0.06, width * 0.6 * (1 - vt * 0.3));
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Serration bumps along the edge (for Christmas fern look)
        ctx.fillStyle = fillColor;
        var serrations = Math.max(3, Math.floor(len / 8));
        for (var s = 0; s < serrations; s++) {
            var st = (s + 0.5) / serrations;
            var sx = len * st;
            var halfWidth = width * (1 - Math.abs(st - 0.5) * 1.2);
            if (halfWidth < 1) continue;
            ctx.beginPath();
            ctx.arc(sx, -halfWidth * 0.7, halfWidth * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(sx, halfWidth * 0.7, halfWidth * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }


    // ---------------------------------------------------------------
    // Herb patch texture
    //
    // Dense cluster of small ovate leaves in varied greens with
    // scattered tiny white flowers -- matches the dense ground cover
    // in the wide-angle reference photograph.
    // ---------------------------------------------------------------

    createHerbPatchTexture(width, height) {
        width = width || 512;
        height = height || 256;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        var leafColors = ['#3a6a30', '#4a7a40', '#2a5a20', '#3e7236', '#2f6328',
                          '#467a3a', '#366830', '#508848', '#2c5e22', '#44763c'];
        var stemColor = '#2a5020';

        // Draw stems first (thin lines radiating from cluster centers)
        var clusterCount = this._randInt(4, 7);
        var clusters = [];
        for (var cl = 0; cl < clusterCount; cl++) {
            clusters.push({
                x: this._rand(width * 0.1, width * 0.9),
                y: this._rand(height * 0.2, height * 0.85)
            });
        }

        // Stems from cluster centers
        for (var cl = 0; cl < clusters.length; cl++) {
            var stemCount = this._randInt(4, 8);
            ctx.strokeStyle = stemColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.7;
            for (var s = 0; s < stemCount; s++) {
                var angle = this._rand(0, Math.PI * 2);
                var len = this._rand(15, 40);
                ctx.beginPath();
                ctx.moveTo(clusters[cl].x, clusters[cl].y);
                var endX = clusters[cl].x + Math.cos(angle) * len;
                var endY = clusters[cl].y + Math.sin(angle) * len;
                // Slight curve
                var cpx = (clusters[cl].x + endX) / 2 + this._rand(-8, 8);
                var cpy = (clusters[cl].y + endY) / 2 + this._rand(-8, 8);
                ctx.quadraticCurveTo(cpx, cpy, endX, endY);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // Draw leaves -- dense overlapping ellipses
        var leafCount = this._randInt(55, 75);
        for (var i = 0; i < leafCount; i++) {
            // Bias leaves toward cluster centers
            var cluster = clusters[Math.floor(this.rng() * clusters.length)];
            var lx = cluster.x + this._rand(-35, 35);
            var ly = cluster.y + this._rand(-25, 25);

            // Keep inside canvas
            if (lx < 2 || lx > width - 2 || ly < 2 || ly > height - 2) continue;

            var lw = this._rand(6, 16);
            var lh = lw * this._rand(0.45, 0.75);
            var angle = this._rand(0, Math.PI * 2);
            var color = this._pick(leafColors);

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(angle);

            // Leaf body -- ovate shape via bezier
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(-lw / 2, 0);
            ctx.bezierCurveTo(-lw / 4, -lh, lw / 4, -lh, lw / 2, 0);
            ctx.bezierCurveTo(lw / 4, lh * 0.8, -lw / 4, lh * 0.8, -lw / 2, 0);
            ctx.fill();

            // Central vein
            if (lw > 9) {
                ctx.strokeStyle = '#1e4a18';
                ctx.lineWidth = 0.4;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(-lw / 2 + 1, 0);
                ctx.lineTo(lw / 2 - 1, 0);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // Lighter highlight on one side
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#6aaa58';
            ctx.beginPath();
            ctx.ellipse(0, -lh * 0.2, lw * 0.25, lh * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            ctx.restore();
        }

        // Scatter tiny white flowers (like phacelia or spring beauty)
        var flowerCount = this._randInt(6, 12);
        for (var i = 0; i < flowerCount; i++) {
            var fx = this._rand(width * 0.05, width * 0.95);
            var fy = this._rand(height * 0.05, height * 0.95);
            var fr = this._rand(2.5, 4.5);

            // Petals
            ctx.fillStyle = '#f0f0e8';
            var petals = this._randInt(4, 6);
            for (var p = 0; p < petals; p++) {
                var pa = (p / petals) * Math.PI * 2 + this._rand(-0.15, 0.15);
                var px = fx + Math.cos(pa) * fr * 0.6;
                var py = fy + Math.sin(pa) * fr * 0.6;
                ctx.beginPath();
                ctx.ellipse(px, py, fr * 0.5, fr * 0.3, pa, 0, Math.PI * 2);
                ctx.fill();
            }

            // Center dot
            ctx.fillStyle = '#d4c858';
            ctx.beginPath();
            ctx.arc(fx, fy, fr * 0.25, 0, Math.PI * 2);
            ctx.fill();
        }

        return this._toTexture(c.canvas);
    }


    // ---------------------------------------------------------------
    // Wildflower texture
    //
    // 3--5 flowers with realistic petal shapes, veining, and green
    // foliage behind them. Supports any petal color -- purple phlox,
    // yellow trillium, white phacelia, etc.
    // ---------------------------------------------------------------

    createWildflowerTexture(flowerColor, width, height) {
        flowerColor = flowerColor || '#9b72cf';
        width = width || 256;
        height = height || 256;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        var cx = width / 2;
        var cy = height / 2;

        // Background foliage leaves behind the flowers
        var bgLeafColors = ['#2e6424', '#3a6a30', '#3e7236', '#2a5a20'];
        var bgLeafCount = this._randInt(8, 14);
        for (var i = 0; i < bgLeafCount; i++) {
            var lx = cx + this._rand(-width * 0.38, width * 0.38);
            var ly = cy + this._rand(-height * 0.35, height * 0.35);
            var lw = this._rand(12, 28);
            var lh = lw * this._rand(0.55, 0.8);
            var la = this._rand(0, Math.PI * 2);

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(la);
            ctx.fillStyle = this._pick(bgLeafColors);
            ctx.beginPath();
            ctx.moveTo(-lw / 2, 0);
            ctx.bezierCurveTo(-lw / 3, -lh, lw / 3, -lh, lw / 2, 0);
            ctx.bezierCurveTo(lw / 3, lh * 0.7, -lw / 3, lh * 0.7, -lw / 2, 0);
            ctx.fill();

            // Leaf vein
            ctx.strokeStyle = '#1a4215';
            ctx.lineWidth = 0.4;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(-lw / 2 + 2, 0);
            ctx.lineTo(lw / 2 - 2, 0);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // Green stems
        var stemColor = '#2a5a1e';
        var flowerCount = this._randInt(3, 5);
        var flowerPositions = [];

        for (var f = 0; f < flowerCount; f++) {
            var fx = cx + this._rand(-width * 0.28, width * 0.28);
            var fy = cy + this._rand(-height * 0.25, height * 0.25);
            flowerPositions.push({ x: fx, y: fy });

            // Stem from bottom
            ctx.strokeStyle = stemColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(fx + this._rand(-3, 3), height * 0.95);
            ctx.quadraticCurveTo(
                fx + this._rand(-10, 10), (fy + height) / 2,
                fx, fy + 12
            );
            ctx.stroke();
        }

        // Draw each flower
        var pc = this._parseHex(flowerColor);
        var darkerCenter = this._rgbaStr(
            Math.max(0, pc[0] * 0.4), Math.max(0, pc[1] * 0.4), Math.max(0, pc[2] * 0.4), 1
        );

        for (var f = 0; f < flowerPositions.length; f++) {
            var pos = flowerPositions[f];
            var petalCount = this._randInt(5, 6);
            var petalLen = this._rand(12, 22);
            var petalWidth = petalLen * this._rand(0.35, 0.55);
            var rotOffset = this._rand(0, Math.PI * 2);

            for (var p = 0; p < petalCount; p++) {
                var pa = rotOffset + (p / petalCount) * Math.PI * 2;
                var px = pos.x + Math.cos(pa) * petalLen * 0.35;
                var py = pos.y + Math.sin(pa) * petalLen * 0.35;

                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(pa);

                // Petal base color with slight variation
                var pr = pc[0] + this._rand(-12, 12);
                var pg = pc[1] + this._rand(-8, 8);
                var pb = pc[2] + this._rand(-12, 12);
                ctx.fillStyle = this._rgbaStr(
                    Math.max(0, Math.min(255, pr)),
                    Math.max(0, Math.min(255, pg)),
                    Math.max(0, Math.min(255, pb)), 1
                );

                // Petal shape -- elongated oval with slight asymmetry
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(
                    petalLen * 0.25, -petalWidth * 0.8,
                    petalLen * 0.75, -petalWidth * 0.6,
                    petalLen, 0
                );
                ctx.bezierCurveTo(
                    petalLen * 0.75, petalWidth * 0.6,
                    petalLen * 0.25, petalWidth * 0.8,
                    0, 0
                );
                ctx.fill();

                // Petal vein lines (lighter streaks toward tip)
                ctx.strokeStyle = this._rgbaStr(
                    Math.min(255, pr + 30),
                    Math.min(255, pg + 20),
                    Math.min(255, pb + 30), 0.3
                );
                ctx.lineWidth = 0.5;
                for (var v = 0; v < 3; v++) {
                    var vy = (v - 1) * petalWidth * 0.2;
                    ctx.beginPath();
                    ctx.moveTo(petalLen * 0.15, vy * 0.5);
                    ctx.lineTo(petalLen * 0.85, vy * 0.3);
                    ctx.stroke();
                }

                ctx.restore();
            }

            // Flower center -- darker circle with stamens
            ctx.fillStyle = darkerCenter;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, petalLen * 0.15, 0, Math.PI * 2);
            ctx.fill();

            // Stamen dots
            ctx.fillStyle = '#d4b840';
            var stamenCount = this._randInt(4, 7);
            for (var s = 0; s < stamenCount; s++) {
                var sa = (s / stamenCount) * Math.PI * 2;
                var sr = petalLen * 0.08;
                ctx.beginPath();
                ctx.arc(
                    pos.x + Math.cos(sa) * sr,
                    pos.y + Math.sin(sa) * sr,
                    1, 0, Math.PI * 2
                );
                ctx.fill();
            }
        }

        return this._toTexture(c.canvas);
    }


    // ---------------------------------------------------------------
    // Moss carpet texture
    //
    // Dense, carpet-like acrocarp moss similar to what covers the
    // fallen logs and rocks in the reference photos. Built from many
    // tiny overlapping circles in varied greens with lighter upper
    // highlights for a rounded-cushion look.
    // ---------------------------------------------------------------

    createMossTexture(width, height) {
        width = width || 512;
        height = height || 512;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        // Base fill -- dark humus/moss base
        ctx.fillStyle = '#1a3a15';
        ctx.fillRect(0, 0, width, height);

        var mossColors = ['#3a8a30', '#4a9a40', '#2a6a20', '#5aaa50',
                          '#348a2c', '#449838', '#2e7a24', '#56a84a',
                          '#388830', '#3c9232'];

        // Layer 1: medium base circles -- fill the canvas
        var baseCount = 600;
        for (var i = 0; i < baseCount; i++) {
            var x = this._rand(-5, width + 5);
            var y = this._rand(-5, height + 5);
            var r = this._rand(2, 6);
            ctx.fillStyle = this._pick(mossColors);
            ctx.globalAlpha = this._rand(0.3, 0.6);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 2: smaller, denser circles on top
        var detailCount = 400;
        for (var i = 0; i < detailCount; i++) {
            var x = this._rand(0, width);
            var y = this._rand(0, height);
            var r = this._rand(1, 3);
            ctx.fillStyle = this._pick(mossColors);
            ctx.globalAlpha = this._rand(0.4, 0.7);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 3: tiny bright highlights -- upper portions of moss cushions
        // Light comes from above so upper half of each "cushion" is brighter
        var highlightColors = ['#6aba58', '#78c866', '#84d474', '#5eae4c'];
        var highlightCount = 250;
        for (var i = 0; i < highlightCount; i++) {
            var x = this._rand(0, width);
            var y = this._rand(0, height);
            var r = this._rand(0.8, 2.2);

            // Bias highlights toward the upper half of "cushions" --
            // simulate with a brightness ramp based on y-position within
            // local sine-modulated clusters
            var brightnessBias = 0.5 + 0.5 * Math.sin(x * 0.08) * Math.cos(y * 0.06);
            if (this.rng() > brightnessBias * 0.7) continue;

            ctx.fillStyle = this._pick(highlightColors);
            ctx.globalAlpha = this._rand(0.25, 0.5);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 4: dark crevice shadows for depth
        var shadowCount = 120;
        for (var i = 0; i < shadowCount; i++) {
            var x = this._rand(0, width);
            var y = this._rand(0, height);
            var r = this._rand(0.5, 1.5);
            ctx.fillStyle = '#0e2a0a';
            ctx.globalAlpha = this._rand(0.2, 0.4);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 5: occasional tiny sporophyte stalks
        ctx.globalAlpha = 0.6;
        var sporoCount = this._randInt(15, 30);
        for (var i = 0; i < sporoCount; i++) {
            var sx = this._rand(5, width - 5);
            var sy = this._rand(5, height - 5);
            var sLen = this._rand(4, 10);

            ctx.strokeStyle = '#5a8a3a';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + this._rand(-2, 2), sy - sLen);
            ctx.stroke();

            // Tiny capsule at top
            ctx.fillStyle = '#7a6a3a';
            ctx.beginPath();
            ctx.arc(sx + this._rand(-2, 2), sy - sLen, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        return this._toTexture(c.canvas);
    }


    // ---------------------------------------------------------------
    // Leaf litter ground texture
    //
    // Realistic forest floor with oak, maple, and tulip poplar leaves
    // at various decay stages on a dark humus base. Includes twig
    // scatter and vein details on larger leaves.
    // ---------------------------------------------------------------

    createLeafLitterTexture(width, height) {
        width = width || 1024;
        height = height || 1024;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        // Opaque humus base
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(0, 0, width, height);

        // Soil color variation -- noise-like patches
        var patchCount = 80;
        for (var i = 0; i < patchCount; i++) {
            var px = this._rand(0, width);
            var py = this._rand(0, height);
            var pr = this._rand(20, 60);
            var patchColors = ['#453525', '#3e2e1e', '#4a3a28', '#352818', '#2e2014'];
            ctx.fillStyle = this._pick(patchColors);
            ctx.globalAlpha = this._rand(0.2, 0.5);
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Draw leaves in layers -- back to front, larger first
        var leafCount = this._randInt(200, 260);
        for (var i = 0; i < leafCount; i++) {
            var lx = this._rand(-20, width + 20);
            var ly = this._rand(-20, height + 20);
            var angle = this._rand(0, Math.PI * 2);
            var leafType = this.rng();

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(angle);
            ctx.globalAlpha = this._rand(0.5, 0.85);

            if (leafType < 0.4) {
                // Oak leaf -- lobed
                this._drawOakLeaf(ctx);
            } else if (leafType < 0.65) {
                // Maple leaf -- palmate
                this._drawMapleLeaf(ctx);
            } else if (leafType < 0.85) {
                // Tulip poplar -- large, simple, broad
                this._drawTulipPoplarLeaf(ctx);
            } else {
                // Generic small decomposed leaf
                this._drawDecomposedLeaf(ctx);
            }

            ctx.restore();
        }

        // Twig scatter on top of leaves
        ctx.globalAlpha = 1;
        var twigCount = this._randInt(30, 55);
        for (var i = 0; i < twigCount; i++) {
            var tx = this._rand(0, width);
            var ty = this._rand(0, height);
            var tLen = this._rand(10, 35);
            var tAngle = this._rand(0, Math.PI * 2);
            var twigColors = ['#4a3020', '#5a4030', '#3a2518', '#6b4a35'];

            ctx.strokeStyle = this._pick(twigColors);
            ctx.lineWidth = this._rand(0.8, 2);
            ctx.lineCap = 'round';
            ctx.globalAlpha = this._rand(0.5, 0.8);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            var endX = tx + Math.cos(tAngle) * tLen;
            var endY = ty + Math.sin(tAngle) * tLen;
            // Slight bend
            ctx.quadraticCurveTo(
                (tx + endX) / 2 + this._rand(-3, 3),
                (ty + endY) / 2 + this._rand(-3, 3),
                endX, endY
            );
            ctx.stroke();

            // Occasional small branch off the main twig
            if (this.rng() < 0.3) {
                var branchT = this._rand(0.3, 0.7);
                var bx = tx + (endX - tx) * branchT;
                var by = ty + (endY - ty) * branchT;
                var bAngle = tAngle + this._rand(-0.8, 0.8);
                var bLen = tLen * this._rand(0.2, 0.4);
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(bAngle) * bLen, by + Math.sin(bAngle) * bLen);
                ctx.stroke();
            }
        }

        // Small pebbles/grit
        var gritCount = this._randInt(40, 70);
        for (var i = 0; i < gritCount; i++) {
            var gx = this._rand(0, width);
            var gy = this._rand(0, height);
            var gr = this._rand(1, 3.5);
            var gritColors = ['#8a8a80', '#7a7a70', '#9a9a90', '#6a6a60'];
            ctx.fillStyle = this._pick(gritColors);
            ctx.globalAlpha = this._rand(0.2, 0.4);
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        return this._toTexture(c.canvas);
    }

    _drawOakLeaf(ctx) {
        var size = this._rand(20, 40);
        var hw = size * 0.4;
        var colors = ['#a08058', '#b89068', '#8a6848', '#c4a078', '#7a5838'];
        ctx.fillStyle = this._pick(colors);

        // 5-lobed oak shape via bezier curves
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);

        // Right side lobes
        for (var l = 0; l < 3; l++) {
            var ly = -size * 0.5 + (size / 3) * (l + 0.5);
            var lobeW = hw * (0.6 + this._rand(0, 0.4));
            ctx.bezierCurveTo(
                lobeW * 0.3, ly - size * 0.05,
                lobeW, ly - size * 0.08,
                lobeW * 0.8, ly
            );
            // Sinus (indent between lobes)
            ctx.bezierCurveTo(
                lobeW * 0.9, ly + size * 0.03,
                hw * 0.25, ly + size * 0.06,
                hw * 0.15, ly + size * 0.08
            );
        }

        // Tip
        ctx.lineTo(0, size * 0.5);

        // Left side lobes (mirror)
        for (var l = 2; l >= 0; l--) {
            var ly = -size * 0.5 + (size / 3) * (l + 0.5);
            var lobeW = hw * (0.6 + this._rand(0, 0.4));
            ctx.bezierCurveTo(
                -hw * 0.15, ly + size * 0.08,
                -hw * 0.25, ly + size * 0.06,
                -lobeW * 0.8, ly
            );
            ctx.bezierCurveTo(
                -lobeW, ly - size * 0.08,
                -lobeW * 0.3, ly - size * 0.05,
                0, ly - size * 0.1
            );
        }

        ctx.closePath();
        ctx.fill();

        // Veins on larger leaves
        if (size > 28) {
            this._drawLeafVeins(ctx, size);
        }
    }

    _drawMapleLeaf(ctx) {
        var size = this._rand(15, 30);
        var colors = ['#6a4a28', '#7a5a38', '#5a3a18', '#8a6a48', '#4a3018'];
        ctx.fillStyle = this._pick(colors);

        // 5-pointed palmate shape
        ctx.beginPath();
        var points = 5;
        for (var p = 0; p < points; p++) {
            var angle = (p / points) * Math.PI * 2 - Math.PI / 2;
            var nextAngle = ((p + 1) / points) * Math.PI * 2 - Math.PI / 2;
            var midAngle = (angle + nextAngle) / 2;

            // Point tip
            var tipR = size * (0.4 + this._rand(0, 0.15));
            var sinusR = size * 0.2;

            if (p === 0) {
                ctx.moveTo(Math.cos(angle) * tipR, Math.sin(angle) * tipR);
            } else {
                ctx.lineTo(Math.cos(angle) * tipR, Math.sin(angle) * tipR);
            }
            // Sinus between points
            ctx.lineTo(Math.cos(midAngle) * sinusR, Math.sin(midAngle) * sinusR);
        }
        ctx.closePath();
        ctx.fill();

        // Veins radiating from center
        if (size > 20) {
            ctx.strokeStyle = this._rgbaStr(40, 28, 12, 0.4);
            ctx.lineWidth = 0.4;
            for (var v = 0; v < points; v++) {
                var va = (v / points) * Math.PI * 2 - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(va) * size * 0.35, Math.sin(va) * size * 0.35);
                ctx.stroke();
            }
        }
    }

    _drawTulipPoplarLeaf(ctx) {
        var size = this._rand(30, 50);
        var hw = size * 0.45;
        var colors = ['#c4a878', '#b89860', '#d4b888', '#a88850', '#bea070'];
        ctx.fillStyle = this._pick(colors);

        // Tulip poplar: broad with flat or notched tip, 4 main lobes
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.45);

        // Right upper lobe
        ctx.bezierCurveTo(hw * 0.5, -size * 0.4, hw, -size * 0.15, hw * 0.85, size * 0.05);
        // Right lower lobe
        ctx.bezierCurveTo(hw * 0.9, size * 0.2, hw * 0.6, size * 0.35, hw * 0.3, size * 0.4);
        // Flat/notched bottom
        ctx.bezierCurveTo(hw * 0.15, size * 0.45, 0, size * 0.42, 0, size * 0.38);
        ctx.bezierCurveTo(0, size * 0.42, -hw * 0.15, size * 0.45, -hw * 0.3, size * 0.4);
        // Left lower lobe
        ctx.bezierCurveTo(-hw * 0.6, size * 0.35, -hw * 0.9, size * 0.2, -hw * 0.85, size * 0.05);
        // Left upper lobe
        ctx.bezierCurveTo(-hw, -size * 0.15, -hw * 0.5, -size * 0.4, 0, -size * 0.45);

        ctx.closePath();
        ctx.fill();

        // Veins
        if (size > 35) {
            this._drawLeafVeins(ctx, size);
        }
    }

    _drawDecomposedLeaf(ctx) {
        // Small, irregular, partially decomposed leaf
        var size = this._rand(8, 18);
        var colors = ['#5a4a38', '#4a3a28', '#6a5a48', '#3a2a18', '#7a6a58'];
        ctx.fillStyle = this._pick(colors);

        // Irregular blob shape
        ctx.beginPath();
        var pointCount = this._randInt(5, 8);
        for (var p = 0; p < pointCount; p++) {
            var angle = (p / pointCount) * Math.PI * 2;
            var r = size * (0.3 + this.rng() * 0.7);
            var px = Math.cos(angle) * r;
            var py = Math.sin(angle) * r;
            if (p === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Decomposition holes (small transparent circles)
        if (this.rng() < 0.4) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            var holeCount = this._randInt(1, 3);
            for (var h = 0; h < holeCount; h++) {
                var hx = this._rand(-size * 0.3, size * 0.3);
                var hy = this._rand(-size * 0.3, size * 0.3);
                var hr = this._rand(1, 3);
                ctx.beginPath();
                ctx.arc(hx, hy, hr, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    _drawLeafVeins(ctx, size) {
        ctx.save();
        ctx.strokeStyle = this._rgbaStr(50, 35, 15, 0.35);
        ctx.lineWidth = 0.5;

        // Central midrib
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.4);
        ctx.lineTo(0, size * 0.4);
        ctx.stroke();

        // Lateral veins branching from midrib
        var veinPairs = this._randInt(3, 5);
        for (var v = 0; v < veinPairs; v++) {
            var vy = -size * 0.3 + (size * 0.6 / (veinPairs + 1)) * (v + 1);
            var spread = size * 0.25 * (1 - Math.abs(vy) / (size * 0.5));

            ctx.beginPath();
            ctx.moveTo(0, vy);
            ctx.lineTo(spread, vy - size * 0.06);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, vy);
            ctx.lineTo(-spread, vy - size * 0.06);
            ctx.stroke();
        }

        ctx.restore();
    }


    // ---------------------------------------------------------------
    // Trillium texture
    //
    // Yellow trillium (Trillium luteum) -- three broad mottled leaves
    // in a whorl with an upright yellow flower. Matches the reference
    // photograph from the cove hardwood trail.
    // ---------------------------------------------------------------

    createTrilliumTexture(width, height) {
        width = width || 256;
        height = height || 256;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        var cx = width * 0.5;
        var cy = height * 0.55;

        // Three broad leaves in a whorl (120 deg apart)
        var leafLen = width * 0.32;
        var leafColors = ['#3a6a30', '#2e5a26', '#356832'];

        for (var l = 0; l < 3; l++) {
            var angle = (l / 3) * Math.PI * 2 + Math.PI * 0.5;
            var tipX = cx + Math.cos(angle) * leafLen;
            var tipY = cy + Math.sin(angle) * leafLen;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle - Math.PI / 2);

            // Broad ovate leaf
            ctx.fillStyle = leafColors[l];
            var lw = leafLen * 0.55;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(lw, -leafLen * 0.15, lw * 0.9, -leafLen * 0.7, 0, -leafLen);
            ctx.bezierCurveTo(-lw * 0.9, -leafLen * 0.7, -lw, -leafLen * 0.15, 0, 0);
            ctx.fill();

            // Mottled pattern on leaves (lighter patches)
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#5a9a48';
            var mottleCount = this._randInt(5, 9);
            for (var m = 0; m < mottleCount; m++) {
                var mx = this._rand(-lw * 0.5, lw * 0.5);
                var my = this._rand(-leafLen * 0.8, -leafLen * 0.1);
                var mr = this._rand(3, 8);
                ctx.beginPath();
                ctx.arc(mx, my, mr, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Central vein
            ctx.strokeStyle = '#1e4a18';
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(0, -leafLen * 0.9);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.restore();
        }

        // Yellow flower at center -- erect petals
        var petalColor = '#d4c832';
        var petalLen = width * 0.09;
        for (var p = 0; p < 3; p++) {
            var pa = (p / 3) * Math.PI * 2 - Math.PI / 6;
            ctx.save();
            ctx.translate(cx, cy - height * 0.04);
            ctx.rotate(pa);

            ctx.fillStyle = petalColor;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(
                petalLen * 0.4, -petalLen * 0.2,
                petalLen * 0.3, -petalLen * 0.8,
                0, -petalLen
            );
            ctx.bezierCurveTo(
                -petalLen * 0.3, -petalLen * 0.8,
                -petalLen * 0.4, -petalLen * 0.2,
                0, 0
            );
            ctx.fill();
            ctx.restore();
        }

        // Center
        ctx.fillStyle = '#8a7a20';
        ctx.beginPath();
        ctx.arc(cx, cy - height * 0.04, 3, 0, Math.PI * 2);
        ctx.fill();

        // Short stem visible below the whorl
        ctx.strokeStyle = '#2a5020';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 3);
        ctx.lineTo(cx, height * 0.95);
        ctx.stroke();

        return this._toTexture(c.canvas);
    }


    // ---------------------------------------------------------------
    // Tall grass / sedge clump texture
    //
    // Multiple thin grass blades curving outward from a base point.
    // Good for filling gaps between other vegetation billboards.
    // ---------------------------------------------------------------

    createGrassClumpTexture(width, height) {
        width = width || 256;
        height = height || 512;
        var c = this._makeCanvas(width, height);
        var ctx = c.ctx;

        var baseX = width * 0.5;
        var baseY = height * 0.95;
        var bladeCount = this._randInt(12, 20);

        var bladeColors = ['#3a7a2e', '#4a8a3c', '#2e6a24', '#468836',
                           '#367230', '#528c44', '#2c6420', '#3e7a34'];

        for (var b = 0; b < bladeCount; b++) {
            var spread = this._rand(-width * 0.35, width * 0.35);
            var bladeHeight = this._rand(height * 0.4, height * 0.85);
            var bladeWidth = this._rand(2, 5);
            var curve = spread * this._rand(0.5, 1.5);

            // Tip coordinates
            var tipX = baseX + spread;
            var tipY = baseY - bladeHeight;

            ctx.save();
            ctx.strokeStyle = this._pick(bladeColors);
            ctx.lineWidth = bladeWidth;
            ctx.lineCap = 'round';

            // Blade as a curved stroke tapering to a point
            ctx.beginPath();
            ctx.moveTo(baseX + this._rand(-3, 3), baseY);
            ctx.bezierCurveTo(
                baseX + curve * 0.3, baseY - bladeHeight * 0.3,
                tipX - curve * 0.1, tipY + bladeHeight * 0.2,
                tipX, tipY
            );
            ctx.stroke();

            // Lighter center line (grass blade midrib)
            ctx.strokeStyle = '#5aaa48';
            ctx.lineWidth = bladeWidth * 0.25;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(baseX + this._rand(-2, 2), baseY - 5);
            ctx.bezierCurveTo(
                baseX + curve * 0.3, baseY - bladeHeight * 0.3,
                tipX - curve * 0.1, tipY + bladeHeight * 0.2,
                tipX, tipY
            );
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.restore();
        }

        return this._toTexture(c.canvas);
    }


    // ---------------------------------------------------------------
    // Convenience: get all textures at once
    // ---------------------------------------------------------------

    generateAll() {
        return {
            fern:           this.createFernTexture(),
            herbPatch:      this.createHerbPatchTexture(),
            phlox:          this.createWildflowerTexture('#9b72cf'),
            trillium:       this.createTrilliumTexture(),
            whiteFlowers:   this.createWildflowerTexture('#e8e8e0'),
            moss:           this.createMossTexture(),
            leafLitter:     this.createLeafLitterTexture(),
            grassClump:     this.createGrassClumpTexture()
        };
    }
}
