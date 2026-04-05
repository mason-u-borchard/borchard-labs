/**
 * Batesian Mimicry Simulation -- Procedural Texture Generation
 *
 * 2D value noise and forest floor rendering for the three-view
 * camera system. Handles soil variation, leaf litter, moss patches,
 * dappled light, and vignette overlays.
 *
 * Built for offscreen canvas pre-rendering. The noise loop samples
 * at 4x4 pixel blocks to stay under 80ms on a 900x560 canvas.
 */

import { COLORS } from './config.js';
import { randomFloat, randomInt } from '../../engine/utils.js';


export class TextureGenerator {

    constructor(seed) {
        this.seed = seed || 42;
        this.perm = this._buildPermTable(this.seed);
    }

    // ---------------------------------------------------------------
    // Permutation table
    // ---------------------------------------------------------------

    _buildPermTable(seed) {
        var table = new Uint8Array(256);
        for (var i = 0; i < 256; i++) table[i] = i;

        // Seeded Fisher-Yates using a simple LCG
        var s = seed;
        for (var i = 255; i > 0; i--) {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            var j = s % (i + 1);
            var tmp = table[i];
            table[i] = table[j];
            table[j] = tmp;
        }
        return table;
    }

    // ---------------------------------------------------------------
    // 2D value noise with cosine interpolation
    // ---------------------------------------------------------------

    _hash(ix, iy) {
        return this.perm[(this.perm[ix & 255] + iy) & 255];
    }

    noise2D(x, y) {
        var ix = Math.floor(x);
        var iy = Math.floor(y);
        var fx = x - ix;
        var fy = y - iy;

        // Four corner values mapped to [-1, 1]
        var v00 = (this._hash(ix, iy) / 255) * 2 - 1;
        var v10 = (this._hash(ix + 1, iy) / 255) * 2 - 1;
        var v01 = (this._hash(ix, iy + 1) / 255) * 2 - 1;
        var v11 = (this._hash(ix + 1, iy + 1) / 255) * 2 - 1;

        // Cosine interpolation weights
        var sx = (1 - Math.cos(fx * Math.PI)) / 2;
        var sy = (1 - Math.cos(fy * Math.PI)) / 2;

        var top = v00 + sx * (v10 - v00);
        var bot = v01 + sx * (v11 - v01);
        return top + sy * (bot - top);
    }

    fractalNoise(x, y, octaves, lacunarity, persistence) {
        octaves = octaves || 3;
        lacunarity = lacunarity || 2;
        persistence = persistence || 0.5;

        var sum = 0;
        var amp = 1;
        var freq = 1;
        var maxAmp = 0;

        for (var i = 0; i < octaves; i++) {
            sum += this.noise2D(x * freq, y * freq) * amp;
            maxAmp += amp;
            amp *= persistence;
            freq *= lacunarity;
        }

        return sum / maxAmp;
    }

    // ---------------------------------------------------------------
    // Color helpers
    // ---------------------------------------------------------------

    _parseHex(hex) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    _lerpColor(hex1, hex2, t) {
        var c1 = this._parseHex(hex1);
        var c2 = this._parseHex(hex2);
        var r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
        var g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
        var b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    _rgba(hex, alpha) {
        var c = this._parseHex(hex);
        return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
    }

    // ---------------------------------------------------------------
    // Ground texture -- transect scale
    // ---------------------------------------------------------------

    renderGroundTexture(canvas, width, height, season) {
        var ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Soil base fill
        ctx.fillStyle = COLORS.soil;
        ctx.fillRect(0, 0, width, height);

        // Noise-based soil variation at 4x4 block resolution
        var blockSize = 4;
        for (var bx = 0; bx < width; bx += blockSize) {
            for (var by = 0; by < height; by += blockSize) {
                var n = this.fractalNoise(bx / 60, by / 60);
                var t = (n + 1) / 2; // map [-1,1] to [0,1]
                ctx.fillStyle = this._lerpColor(COLORS.soilDark, COLORS.soilLight, t);
                ctx.globalAlpha = 0.4;
                ctx.fillRect(bx, by, blockSize, blockSize);
            }
        }
        ctx.globalAlpha = 1;

        // Leaf litter
        var leafCount = randomInt(250, 350);
        var palette = COLORS[season] ? COLORS[season].litter : COLORS.fall.litter;
        this._scatterLeaves(ctx, width, height, leafCount, palette, false);

        // Pebble scatter
        var pebbleCount = randomInt(20, 40);
        for (var i = 0; i < pebbleCount; i++) {
            var px = randomFloat(0, width);
            var py = randomFloat(0, height);
            var pr = randomFloat(2, 5);
            ctx.globalAlpha = randomFloat(0.3, 0.5);
            ctx.fillStyle = COLORS.rockLight;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Twig scatter
        var twigCount = randomInt(20, 30);
        for (var i = 0; i < twigCount; i++) {
            var tx = randomFloat(0, width);
            var ty = randomFloat(0, height);
            var tLen = randomFloat(8, 25);
            var tAngle = randomFloat(0, Math.PI * 2);
            ctx.strokeStyle = COLORS.twig;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + Math.cos(tAngle) * tLen, ty + Math.sin(tAngle) * tLen);
            ctx.stroke();
        }
    }

    // ---------------------------------------------------------------
    // Detail patch -- approach scale
    // ---------------------------------------------------------------

    renderDetailPatch(canvas, width, height, season) {
        var ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Soil base
        ctx.fillStyle = COLORS.soil;
        ctx.fillRect(0, 0, width, height);

        // Finer noise variation
        var blockSize = 4;
        for (var bx = 0; bx < width; bx += blockSize) {
            for (var by = 0; by < height; by += blockSize) {
                var n = this.fractalNoise(bx / 30, by / 30);
                var t = (n + 1) / 2;
                ctx.fillStyle = this._lerpColor(COLORS.soilDark, COLORS.soilLight, t);
                ctx.globalAlpha = 0.4;
                ctx.fillRect(bx, by, blockSize, blockSize);
            }
        }
        ctx.globalAlpha = 1;

        // Denser leaf litter with irregular shapes and veins
        var leafCount = randomInt(80, 120);
        var palette = COLORS[season] ? COLORS[season].litter : COLORS.fall.litter;
        this._scatterLeaves(ctx, width, height, leafCount, palette, true);

        // Pebbles
        var pebbleCount = randomInt(8, 15);
        for (var i = 0; i < pebbleCount; i++) {
            var px = randomFloat(0, width);
            var py = randomFloat(0, height);
            var pr = randomFloat(2, 5);
            ctx.globalAlpha = randomFloat(0.3, 0.5);
            ctx.fillStyle = COLORS.rockLight;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Twigs
        var twigCount = randomInt(8, 12);
        for (var i = 0; i < twigCount; i++) {
            var tx = randomFloat(0, width);
            var ty = randomFloat(0, height);
            var tLen = randomFloat(8, 25);
            var tAngle = randomFloat(0, Math.PI * 2);
            ctx.strokeStyle = COLORS.twig;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + Math.cos(tAngle) * tLen, ty + Math.sin(tAngle) * tLen);
            ctx.stroke();
        }
    }

    // ---------------------------------------------------------------
    // Leaf rendering (shared between transect and detail)
    // ---------------------------------------------------------------

    _scatterLeaves(ctx, width, height, count, palette, detailed) {
        for (var i = 0; i < count; i++) {
            var lx = randomFloat(0, width);
            var ly = randomFloat(0, height);
            var lw = randomFloat(4, 14);
            var lh = lw * randomFloat(0.5, 0.8);
            var angle = randomFloat(0, Math.PI * 2);
            var alpha = randomFloat(0.4, 0.7);
            var color = palette[randomInt(0, palette.length - 1)];
            var hasVein = Math.random() < 0.2;

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(angle);
            ctx.globalAlpha = alpha;

            if (detailed) {
                // Irregular leaf shape with bezier bumps
                this._drawDetailedLeaf(ctx, lw, lh, color);
            } else {
                // Simple ellipse
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 0, lw / 2, lh / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Vein line
            if (hasVein) {
                var veinColor = this._darkenHex(color, 0.3);
                ctx.strokeStyle = veinColor;
                ctx.lineWidth = 0.5;
                ctx.globalAlpha = alpha * 0.8;

                if (detailed) {
                    // Multiple veins
                    var veinCount = randomInt(2, 3);
                    for (var v = 0; v < veinCount; v++) {
                        var vSpread = (v - (veinCount - 1) / 2) * (lh / (veinCount + 1));
                        ctx.beginPath();
                        ctx.moveTo(-lw / 2 + 1, vSpread);
                        ctx.lineTo(lw / 2 - 1, vSpread * 0.3);
                        ctx.stroke();
                    }
                } else {
                    ctx.beginPath();
                    ctx.moveTo(-lw / 2, 0);
                    ctx.lineTo(lw / 2, 0);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    _drawDetailedLeaf(ctx, w, h, color) {
        var hw = w / 2;
        var hh = h / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-hw, 0);

        // Top edge with random bumps
        var bumps = randomInt(2, 3);
        var segW = w / bumps;
        for (var b = 0; b < bumps; b++) {
            var sx = -hw + b * segW;
            var ex = sx + segW;
            var cy = -hh + randomFloat(-hh * 0.15, hh * 0.15);
            ctx.quadraticCurveTo((sx + ex) / 2, cy, ex, b === bumps - 1 ? 0 : -hh * 0.6);
        }

        // Bottom edge with random bumps
        for (var b = bumps - 1; b >= 0; b--) {
            var sx = -hw + (b + 1) * segW;
            var ex = sx - segW;
            var cy = hh + randomFloat(-hh * 0.15, hh * 0.15);
            ctx.quadraticCurveTo((sx + ex) / 2, cy, ex, b === 0 ? 0 : hh * 0.6);
        }

        ctx.closePath();
        ctx.fill();
    }

    _darkenHex(hex, amount) {
        var c = this._parseHex(hex);
        var r = Math.round(c[0] * (1 - amount));
        var g = Math.round(c[1] * (1 - amount));
        var b = Math.round(c[2] * (1 - amount));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    // ---------------------------------------------------------------
    // Moss patches
    // ---------------------------------------------------------------

    renderMoss(ctx, x, y, width, height, wetness) {
        wetness = wetness !== undefined ? wetness : 0.5;

        // Irregular blob outline -- 6-8 points
        var pointCount = randomInt(6, 8);
        var points = [];
        var rx = width / 2;
        var ry = height / 2;

        for (var i = 0; i < pointCount; i++) {
            var angle = (i / pointCount) * Math.PI * 2;
            var radiusJitter = randomFloat(0.7, 1.0);
            points.push({
                x: x + rx + Math.cos(angle) * rx * radiusJitter,
                y: y + ry + Math.sin(angle) * ry * radiusJitter
            });
        }

        // Fill color: interpolate between muted olive and bright moss based on wetness
        var mutedOlive = '#6b7a4a';
        var fillColor = this._lerpColor(mutedOlive, COLORS.moss, wetness);

        // Draw the blob
        ctx.save();
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < points.length; i++) {
            var prev = points[i - 1];
            var curr = points[i];
            var cpx = (prev.x + curr.x) / 2;
            var cpy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
        }
        // Close the shape smoothly
        var last = points[points.length - 1];
        var first = points[0];
        ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2);
        ctx.closePath();
        ctx.fill();

        // Lighter highlight on the top half (light from above)
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#a8e6a0';
        ctx.beginPath();
        ctx.ellipse(x + rx, y + ry * 0.6, rx * 0.6, ry * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Texture dots inside
        var dotCount = randomInt(15, 25);
        var darkGreen = this._darkenHex(COLORS.moss, 0.35);
        for (var i = 0; i < dotCount; i++) {
            var dx = x + rx + randomFloat(-rx * 0.75, rx * 0.75);
            var dy = y + ry + randomFloat(-ry * 0.75, ry * 0.75);
            ctx.fillStyle = darkGreen;
            ctx.globalAlpha = randomFloat(0.3, 0.6);
            ctx.beginPath();
            ctx.arc(dx, dy, randomFloat(0.5, 1.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Feathery edge detail at approach scale (check size as proxy)
        if (width > 20) {
            ctx.strokeStyle = fillColor;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.5;
            for (var i = 0; i < points.length; i++) {
                var p = points[i];
                var lineCount = randomInt(2, 4);
                for (var j = 0; j < lineCount; j++) {
                    var outAngle = Math.atan2(p.y - (y + ry), p.x - (x + rx));
                    outAngle += randomFloat(-0.5, 0.5);
                    var lineLen = randomFloat(2, 5);
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(
                        p.x + Math.cos(outAngle) * lineLen,
                        p.y + Math.sin(outAngle) * lineLen
                    );
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    // ---------------------------------------------------------------
    // Dappled light overlay
    // ---------------------------------------------------------------

    renderLightMap(canvas, width, height) {
        var ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Neutral gray base for soft-light blending
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, width, height);

        var step = 6;
        for (var bx = 0; bx < width; bx += step) {
            for (var by = 0; by < height; by += step) {
                var n = this.fractalNoise(bx / 80, by / 80, 2);

                if (n > 0.3) {
                    // Light dapple
                    var radius = randomFloat(15, 30);
                    var alpha = randomFloat(0.08, 0.15);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(bx, by, radius, 0, Math.PI * 2);
                    ctx.fill();
                } else if (n < -0.3) {
                    // Shadow dapple
                    var radius = randomFloat(15, 30);
                    var alpha = randomFloat(0.05, 0.10);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#1a1a1a';
                    ctx.beginPath();
                    ctx.arc(bx, by, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------
    // Vignette overlay
    // ---------------------------------------------------------------

    renderVignette(canvas, width, height, strength) {
        strength = strength !== undefined ? strength : 0.25;

        var ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        var cx = width / 2;
        var cy = height / 2;
        var radius = Math.sqrt(cx * cx + cy * cy);

        var grad = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,' + strength + ')');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }
}
