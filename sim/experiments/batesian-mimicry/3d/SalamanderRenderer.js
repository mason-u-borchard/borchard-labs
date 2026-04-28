/**
 * SalamanderRenderer.js -- Procedural 3D salamander meshes with
 * canvas-rendered textures for the Batesian mimicry simulation.
 *
 * Each species gets a TubeGeometry body along a CatmullRomCurve3 spine,
 * four limb sub-meshes, and a pair of eye spheres. Albedo and normal
 * textures are painted onto a 512x256 canvas per individual, driven
 * by config.js species data and per-individual trait offsets.
 *
 * Mason Borchard -- 2026-04-04
 */

import * as THREE from 'three';
import { SPECIES } from '../config.js';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function lerp(a, b, t) { return a + (b - a) * t; }

function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

/** Parse a hex color into an {r,g,b} object (0-255). */
function hexToRgb(hex) {
    var n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Convert RGB to HSL (all 0-1). */
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h, s: s, l: l };
}

/** Convert HSL (0-1) to CSS rgb string. */
function hslToRgbStr(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        var hue2rgb = function (p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')';
}

/** HSL (0-1) to {r,g,b} (0-255). */
function hslToRgbObj(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        var hue2rgb = function (p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/** Adjust a hex color by hue offset (degrees) and saturation offset (0-1). */
function adjustColor(hex, hueOffset, satOffset) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + hueOffset / 360 + 1) % 1;
    hsl.s = clamp(hsl.s + satOffset, 0, 1);
    return hslToRgbStr(hsl.h, hsl.s, hsl.l);
}

/** Adjust a hex color and return the {r,g,b} object (0-255). */
function adjustColorRgb(hex, hueOffset, satOffset) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + hueOffset / 360 + 1) % 1;
    hsl.s = clamp(hsl.s + satOffset, 0, 1);
    return hslToRgbObj(hsl.h, hsl.s, hsl.l);
}


// ---------------------------------------------------------------------------
// Per-species clearcoat settings
// ---------------------------------------------------------------------------

var CLEARCOAT = {
    NOVI: { clearcoat: 0, clearcoatRoughness: 1.0 },
    PSRU: { clearcoat: 0.4, clearcoatRoughness: 0.15 },
    PLCI: { clearcoat: 0.3, clearcoatRoughness: 0.2 },
    PLGL: { clearcoat: 0.7, clearcoatRoughness: 0.08 },
    DEFU: { clearcoat: 0.3, clearcoatRoughness: 0.2 },
    EUBI: { clearcoat: 0.3, clearcoatRoughness: 0.2 },
    DEMO: { clearcoat: 0.3, clearcoatRoughness: 0.2 },
    GYPO: { clearcoat: 0.35, clearcoatRoughness: 0.2 }
};


// ---------------------------------------------------------------------------
// SalamanderRenderer
// ---------------------------------------------------------------------------

export class SalamanderRenderer {

    constructor() {
        this._geoCache = {};
        this._texCache = {};
        this._normalCache = {};
        this._breathPhase = 0;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Build a complete salamander Group for the given species + traits.
     * @param {string} speciesKey  -- 'NOVI', 'PSRU', 'PLCI', etc.
     * @param {object} traits      -- { svl, totalLength, mass, bodyHueOffset,
     *                                  bodySatOffset, morph, ... }
     * @returns {THREE.Group}
     */
    createSalamander(speciesKey, traits) {
        var sp = SPECIES[speciesKey];
        if (!sp) {
            console.warn('SalamanderRenderer: unknown species key "' + speciesKey + '"');
            return new THREE.Group();
        }

        traits = traits || {};
        var svl = traits.svl || sp.svl.mean;
        var totalLength = traits.totalLength || (sp.tl ? sp.tl.mean : svl * 2);
        var hueOff = traits.bodyHueOffset || 0;
        var satOff = traits.bodySatOffset || 0;
        var morph = traits.morph || null;

        // Geometry
        var bodyGeo = this._getBodyGeometry(speciesKey, sp, svl, totalLength);

        // Textures
        var albedoCanvas = this.generateTexture(speciesKey, traits);
        var normalCanvas = this.generateNormalMap(speciesKey);

        // Material
        var mat = this.createMaterial(albedoCanvas, normalCanvas, sp, speciesKey);

        // Assemble group
        var group = new THREE.Group();
        group.name = 'salamander_' + speciesKey;

        var bodyMesh = new THREE.Mesh(bodyGeo, mat);
        bodyMesh.name = 'body';
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // Limbs
        var totalLen = totalLength * 0.001;
        var limbRadius = totalLen * 0.012;
        var limbLength = totalLen * 0.08;
        this._addLimbs(group, sp, totalLen, limbRadius, limbLength, mat);

        // Eyes
        var eyes = this.createEyes(sp, totalLen);
        group.add(eyes);

        // Store references for disposal
        group.userData.salamanderMats = [mat];
        group.userData.salamanderGeos = [bodyGeo];
        group.userData.speciesKey = speciesKey;
        group.userData.breathPhase = Math.random() * Math.PI * 2;

        return group;
    }

    /**
     * Per-frame animation update.
     * @param {THREE.Group} group        -- salamander group from createSalamander
     * @param {number}      dt           -- delta time in seconds
     * @param {string}      behaviorType -- 'stand-still', 'coiled-posture', etc.
     */
    animate(group, dt, behaviorType) {
        if (!group.userData) return;
        group.userData.breathPhase = (group.userData.breathPhase || 0) + dt * Math.PI; // 0.5Hz
        var breathScale = 1.0 + 0.015 * Math.sin(group.userData.breathPhase);
        group.scale.y = breathScale;
    }

    /**
     * Dispose all GPU resources owned by a salamander group.
     */
    dispose(group) {
        group.traverse(function (child) {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    if (child.material.normalMap) child.material.normalMap.dispose();
                    child.material.dispose();
                }
            }
        });
    }

    // -----------------------------------------------------------------------
    // Body geometry
    // -----------------------------------------------------------------------

    buildBodyGeometry(speciesConfig, svl, totalLength) {
        var totalLen = totalLength * 0.001; // mm to meters
        var svlM = svl * 0.001;
        var headRatio = speciesConfig.bodyProportions.headRatio;
        var tailRatio = speciesConfig.bodyProportions.tailRatio;

        // Spine control points
        var points = [];
        points.push(new THREE.Vector3(0, 0, 0));                             // snout tip
        points.push(new THREE.Vector3(totalLen * headRatio * 0.5, 0, 0));    // mid-head
        points.push(new THREE.Vector3(totalLen * headRatio, 0, 0));          // neck
        points.push(new THREE.Vector3(totalLen * 0.35, 0, 0));               // forelimb
        points.push(new THREE.Vector3(totalLen * 0.55, 0, 0));               // mid-trunk
        points.push(new THREE.Vector3(totalLen * (1 - tailRatio), 0, 0));    // hindlimb / vent
        points.push(new THREE.Vector3(totalLen * (1 - tailRatio * 0.4), 0, 0)); // mid-tail
        points.push(new THREE.Vector3(totalLen, 0, 0));                       // tail tip

        var curve = new THREE.CatmullRomCurve3(points);

        // Body radius -- varies along the spine via a custom tube radius function
        var maxRadius = totalLen * 0.035;
        var headBulge = maxRadius * (headRatio > 0.20 ? 1.1 : 0.9);

        var radiusFn = function (t) {
            // t: 0 (snout) to 1 (tail tip)
            if (t < 0.05) {
                // snout taper
                return lerp(maxRadius * 0.3, headBulge, t / 0.05);
            } else if (t < headRatio) {
                // head bulge -> neck
                return lerp(headBulge, maxRadius * 0.85, (t - 0.05) / (headRatio - 0.05));
            } else if (t < 1 - tailRatio) {
                // trunk
                return maxRadius;
            } else {
                // tail taper to tip
                var tailT = (t - (1 - tailRatio)) / tailRatio;
                return lerp(maxRadius, maxRadius * 0.05, tailT * tailT);
            }
        };

        var tubularSegments = 32;
        var radialSegments = 8;
        var geo = new THREE.TubeGeometry(curve, tubularSegments, maxRadius, radialSegments, false);

        // Apply species-specific radius profile
        var pos = geo.attributes.position;
        var count = pos.count;
        var segVerts = radialSegments + 1;

        for (var seg = 0; seg <= tubularSegments; seg++) {
            var t = seg / tubularSegments;
            var desiredR = radiusFn(t);
            var scaleR = desiredR / maxRadius;

            // Get the center point on the curve at this t
            var center = curve.getPointAt(t);

            for (var r = 0; r < segVerts; r++) {
                var idx = seg * segVerts + r;
                if (idx >= count) break;

                var vx = pos.getX(idx);
                var vy = pos.getY(idx);
                var vz = pos.getZ(idx);

                // Offset from center, scale, put back
                var dy = vy - center.y;
                var dz = vz - center.z;
                pos.setY(idx, center.y + dy * scaleR);
                pos.setZ(idx, center.z + dz * scaleR);

                // Keeled tail: flatten Y, extend Z on dorsal side
                if (speciesConfig.tailShape === 'keeled' && t > (1 - tailRatio)) {
                    var tailT = (t - (1 - tailRatio)) / tailRatio;
                    var keelAmount = tailT * 0.5;
                    var curY = pos.getY(idx) - center.y;
                    var curZ = pos.getZ(idx) - center.z;
                    pos.setY(idx, center.y + curY * (1 - keelAmount * 0.4));
                    // Add a slight dorsal ridge for the keel
                    if (curZ > 0) {
                        pos.setZ(idx, center.z + curZ * (1 + keelAmount * 0.3));
                    }
                }
            }
        }

        pos.needsUpdate = true;
        geo.computeVertexNormals();
        return geo;
    }

    // -----------------------------------------------------------------------
    // Texture generation
    // -----------------------------------------------------------------------

    /**
     * Paint species albedo texture on a 512x256 canvas.
     */
    generateTexture(speciesKey, traits) {
        traits = traits || {};
        var sp = SPECIES[speciesKey];
        var w = 512, h = 256;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');

        var hueOff = traits.bodyHueOffset || 0;
        var satOff = traits.bodySatOffset || 0;

        // ---- Gradient body color (dorsal lighter, sides slightly darker) ----
        var bodyRgb = adjustColorRgb(sp.color.body, hueOff, satOff);
        var bodyHsl = rgbToHsl(bodyRgb.r, bodyRgb.g, bodyRgb.b);

        // Dorsal = slightly lighter, sides = base
        var dorsalColor = hslToRgbStr(bodyHsl.h, bodyHsl.s, clamp(bodyHsl.l + 0.06, 0, 1));
        var sideColor = hslToRgbStr(bodyHsl.h, bodyHsl.s, clamp(bodyHsl.l - 0.03, 0, 1));
        var bodyColor = adjustColor(sp.color.body, hueOff, satOff);

        var bodyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.67);
        bodyGrad.addColorStop(0, dorsalColor);
        bodyGrad.addColorStop(0.4, bodyColor);
        bodyGrad.addColorStop(1.0, sideColor);
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(0, 0, w, h);

        // ---- Subtle mottling: random darker patches for organic variation ----
        var mottleCount = Math.floor(randRange(30, 50));
        for (var m = 0; m < mottleCount; m++) {
            var mx = randRange(0, w);
            var my = randRange(0, h * 0.65);
            var mr = randRange(8, 22);
            ctx.beginPath();
            ctx.arc(mx, my, mr, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, ' + randRange(0.05, 0.08).toFixed(3) + ')';
            ctx.fill();
        }

        // ---- Belly region with smooth gradient transition ----
        var bellyColor = sp.color.belly ? adjustColor(sp.color.belly, hueOff * 0.3, satOff * 0.5) : bodyColor;

        // Smooth belly transition over 20% of canvas height
        var transitionTop = Math.floor(h * 0.55);
        var transitionBot = Math.floor(h * 0.75);
        var bellyGrad = ctx.createLinearGradient(0, transitionTop, 0, transitionBot);
        bellyGrad.addColorStop(0, 'rgba(0,0,0,0)');
        bellyGrad.addColorStop(1, bellyColor);
        // First fill belly solid below the transition zone
        ctx.fillStyle = bellyColor;
        ctx.fillRect(0, transitionBot, w, h - transitionBot);
        // Then blend with gradient
        ctx.fillStyle = bellyGrad;
        ctx.fillRect(0, transitionTop, w, transitionBot - transitionTop);

        // ---- Species-specific patterns ----
        var pattern = sp.spotPattern;

        if (pattern === 'bordered-rows') {
            // NOVI: red-bordered spots with radial gradient and anti-aliased borders
            var spotColor = sp.color.spots || '#cc2200';
            var borderColor = sp.color.spotBorder || '#111111';
            var spotCount = Math.floor(randRange(6, 10));
            var spotRgb = adjustColorRgb(spotColor, hueOff, satOff);

            for (var row = 0; row < 2; row++) {
                var rowY = h * (0.28 + row * 0.18);
                for (var i = 0; i < spotCount; i++) {
                    var sx = w * 0.08 + (w * 0.84) * (i / (spotCount - 1)) + randRange(-8, 8);
                    var sy = rowY + randRange(-6, 6);
                    var sr = randRange(6, 12);

                    // Anti-aliased black border (2px wide)
                    ctx.beginPath();
                    ctx.arc(sx, sy, sr + 2, 0, Math.PI * 2);
                    ctx.fillStyle = borderColor;
                    ctx.fill();

                    // Radial gradient fill -- lighter center fading to the red fill
                    var spotGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                    var centerR = clamp(spotRgb.r + 40, 0, 255);
                    var centerG = clamp(spotRgb.g + 20, 0, 255);
                    var centerB = clamp(spotRgb.b + 10, 0, 255);
                    spotGrad.addColorStop(0, 'rgb(' + centerR + ',' + centerG + ',' + centerB + ')');
                    spotGrad.addColorStop(1, 'rgb(' + spotRgb.r + ',' + spotRgb.g + ',' + spotRgb.b + ')');

                    ctx.beginPath();
                    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                    ctx.fillStyle = spotGrad;
                    ctx.fill();
                }
            }

        } else if (pattern === 'scattered') {
            // PSRU: irregular elliptical spots, some overlapping for larger animals
            var dotColor = sp.color.spots || '#222222';
            var svl = traits.svl || sp.svl.mean;
            // More spots and more overlap for older/larger animals
            var dotCount = Math.floor(randRange(15, 25) + (svl > 60 ? 8 : 0));

            for (var i = 0; i < dotCount; i++) {
                var dx = randRange(w * 0.05, w * 0.95);
                var dy = randRange(h * 0.08, h * 0.60);
                // Randomized ellipses instead of circles
                var drx = randRange(3, 9);
                var dry = randRange(2, 7);
                var angle = randRange(-0.5, 0.5);

                ctx.save();
                ctx.translate(dx, dy);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.ellipse(0, 0, drx, dry, 0, 0, Math.PI * 2);
                ctx.fillStyle = dotColor;
                ctx.fill();
                ctx.restore();
            }

        } else if (pattern === 'flecked') {
            // PLGL: dense flecks varying from white to silver-gold
            var fleckColors = ['#ffffff', '#e0e0e0', '#c0c0c0', '#d4c480', '#c8b870', '#b0b0b0'];
            var fleckCount = Math.floor(randRange(60, 100));

            for (var i = 0; i < fleckCount; i++) {
                var fx = randRange(w * 0.03, w * 0.97);
                var fy = randRange(h * 0.05, h * 0.62);
                var fr = randRange(1, 3);
                var fleckColor = fleckColors[Math.floor(Math.random() * fleckColors.length)];

                ctx.beginPath();
                ctx.arc(fx, fy, fr, 0, Math.PI * 2);
                ctx.fillStyle = fleckColor;
                ctx.globalAlpha = randRange(0.4, 0.9);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;

        } else if (pattern === 'lined') {
            // EUBI: two dark dorsolateral lines
            var lineColor = sp.color.lines || '#4a3a28';
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 4;
            for (var row = 0; row < 2; row++) {
                var ly = h * (0.30 + row * 0.14);
                ctx.beginPath();
                ctx.moveTo(w * 0.05, ly + randRange(-2, 2));
                for (var x = 0.15; x <= 1.0; x += 0.1) {
                    ctx.lineTo(w * x, ly + randRange(-3, 3));
                }
                ctx.stroke();
            }

        } else if (pattern === 'blotched') {
            // DEFU: darker irregular patches
            var blotchCount = Math.floor(randRange(5, 9));
            for (var i = 0; i < blotchCount; i++) {
                var bx = randRange(w * 0.08, w * 0.92);
                var by = randRange(h * 0.15, h * 0.55);
                var bw = randRange(20, 45);
                var bh = randRange(15, 30);
                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(randRange(-0.3, 0.3));
                ctx.beginPath();
                ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
                ctx.fill();
                ctx.restore();
            }
            // Jaw line (DEFU diagnostic)
            if (sp.color.jawLine) {
                ctx.strokeStyle = sp.color.jawLine;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(w * 0.02, h * 0.40);
                ctx.quadraticCurveTo(w * 0.06, h * 0.45, w * 0.12, h * 0.42);
                ctx.stroke();
            }

        } else if (pattern === 'none') {
            // PLCI: dorsal stripe for striped morph
            var morph = traits.morph || 'striped';
            if (morph === 'striped' || morph === 'erythristic') {
                var stripeColor = sp.color.stripe || '#b04a2a';
                if (morph === 'erythristic') stripeColor = '#d45a30';
                ctx.fillStyle = adjustColor(stripeColor, hueOff, satOff);
                ctx.beginPath();
                ctx.moveTo(w * 0.03, h * 0.35);
                ctx.lineTo(w * 0.97, h * 0.35);
                ctx.lineTo(w * 0.97, h * 0.50);
                ctx.lineTo(w * 0.03, h * 0.50);
                ctx.closePath();
                ctx.fill();
            }
            // Leadback morph: no stripe, leave the dark base color as-is

            // Salt-and-pepper belly for PLCI
            if (sp.color.bellyPattern === 'salt-pepper') {
                var speckCount = Math.floor(randRange(40, 70));
                for (var i = 0; i < speckCount; i++) {
                    var px = randRange(0, w);
                    var py = randRange(h * 0.68, h);
                    var pr = randRange(1, 3);
                    ctx.beginPath();
                    ctx.arc(px, py, pr, 0, Math.PI * 2);
                    ctx.fillStyle = Math.random() > 0.5 ? '#333333' : '#aaaaaa';
                    ctx.fill();
                }
            }

        } else if (pattern === 'faint-mottled') {
            // GYPO: subtle darker mottling
            var mottleCount2 = Math.floor(randRange(20, 35));
            for (var i = 0; i < mottleCount2; i++) {
                var mx2 = randRange(w * 0.05, w * 0.95);
                var my2 = randRange(h * 0.10, h * 0.60);
                var mr2 = randRange(8, 18);
                ctx.beginPath();
                ctx.arc(mx2, my2, mr2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(80, 50, 40, 0.15)';
                ctx.fill();
            }

        } else if (pattern === 'reticulated') {
            // DEMO: net-like darker pattern
            ctx.strokeStyle = 'rgba(40, 30, 20, 0.30)';
            ctx.lineWidth = 2;
            var nodeCount = Math.floor(randRange(12, 20));
            var nodes = [];
            for (var i = 0; i < nodeCount; i++) {
                nodes.push({
                    x: randRange(w * 0.05, w * 0.95),
                    y: randRange(h * 0.10, h * 0.58)
                });
            }
            for (var i = 0; i < nodes.length; i++) {
                for (var j = i + 1; j < nodes.length; j++) {
                    var dx = nodes[j].x - nodes[i].x;
                    var dy = nodes[j].y - nodes[i].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < w * 0.2) {
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }
        }

        // ---- Wet skin highlight band across the upper third ----
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        var highlightGrad = ctx.createLinearGradient(0, h * 0.12, 0, h * 0.38);
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        highlightGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.08)');
        highlightGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)');
        highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGrad;
        ctx.fillRect(0, Math.floor(h * 0.12), w, Math.ceil(h * 0.26));

        return canvas;
    }

    /**
     * Paint a normal map on a 512x256 canvas.
     */
    generateNormalMap(speciesKey) {
        var sp = SPECIES[speciesKey];
        var w = 512, h = 256;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');

        // Fill with neutral normal (128, 128, 255) -- flat surface
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, w, h);

        if (sp.skinTexture === 'granular') {
            // NOVI: dense small bumps for granular skin (300+ stipples)
            var bumpCount = Math.floor(randRange(350, 550));
            for (var i = 0; i < bumpCount; i++) {
                var bx = randRange(0, w);
                var by = randRange(0, h * 0.67);
                var br = randRange(1, 3);
                // Perturb the normal by varying RGB channels
                var blueVal = Math.floor(randRange(215, 255));
                var redVal = Math.floor(randRange(110, 145));
                var greenVal = Math.floor(randRange(110, 145));
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, Math.PI * 2);
                ctx.fillStyle = 'rgb(' + redVal + ',' + greenVal + ',' + blueVal + ')';
                ctx.fill();
            }

        } else {
            // Smooth species: costal groove indentations
            var grooveCount = sp.costalGrooves || 0;
            if (grooveCount > 0) {
                var trunkStart = w * 0.15;
                var trunkEnd = w * (1 - (sp.bodyProportions.tailRatio || 0.45));
                var trunkLen = trunkEnd - trunkStart;
                ctx.strokeStyle = 'rgb(120, 120, 245)';
                ctx.lineWidth = 1.5;
                for (var g = 0; g < grooveCount; g++) {
                    var gx = trunkStart + trunkLen * ((g + 0.5) / grooveCount);
                    ctx.beginPath();
                    ctx.moveTo(gx, h * 0.15);
                    ctx.lineTo(gx, h * 0.60);
                    ctx.stroke();
                }
            }

            // Subtle low-amplitude noise for smooth species --
            // real skin has tiny irregularities even on "smooth" species
            var noiseCount = Math.floor(randRange(120, 200));
            for (var i = 0; i < noiseCount; i++) {
                var nx = randRange(0, w);
                var ny = randRange(0, h * 0.70);
                var nr = randRange(1, 2);
                // Very slight perturbation from neutral
                var nRed = 128 + Math.floor(randRange(-4, 4));
                var nGreen = 128 + Math.floor(randRange(-4, 4));
                var nBlue = 255 + Math.floor(randRange(-4, 0));
                ctx.beginPath();
                ctx.arc(nx, ny, nr, 0, Math.PI * 2);
                ctx.fillStyle = 'rgb(' + nRed + ',' + nGreen + ',' + nBlue + ')';
                ctx.fill();
            }
        }

        return canvas;
    }

    // -----------------------------------------------------------------------
    // Eyes
    // -----------------------------------------------------------------------

    createEyes(speciesConfig, bodyLength) {
        var eyeGroup = new THREE.Group();
        eyeGroup.name = 'eyes';

        var eyeRadius = bodyLength * 0.018;
        var eyeGeo = new THREE.SphereGeometry(eyeRadius, 8, 8);

        // Determine eye material
        var eyeColor = speciesConfig.color.eye || '#222222';
        var isGoldEye = (speciesConfig.key === 'PSRU');

        var eyeMat = new THREE.MeshStandardMaterial({
            color: eyeColor,
            emissive: isGoldEye ? '#C9A832' : eyeColor,
            emissiveIntensity: isGoldEye ? 0.5 : 0.08,
            roughness: 0.2,
            metalness: 0.1
        });

        var headLen = bodyLength * (speciesConfig.bodyProportions.headRatio || 0.18);
        var eyeX = headLen * 0.55;
        var eyeSpread = bodyLength * 0.022;
        var eyeY = bodyLength * 0.025;

        // Left eye
        var leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(eyeX, eyeY, -eyeSpread);
        eyeGroup.add(leftEye);

        // Right eye
        var rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(eyeX, eyeY, eyeSpread);
        eyeGroup.add(rightEye);

        // Specular highlights -- tiny white dots
        var specRadius = eyeRadius * 0.3;
        var specGeo = new THREE.SphereGeometry(specRadius, 4, 4);
        var specMat = new THREE.MeshStandardMaterial({
            color: '#ffffff',
            emissive: '#ffffff',
            emissiveIntensity: 0.6,
            roughness: 0.0,
            metalness: 0.0
        });

        var lSpec = new THREE.Mesh(specGeo, specMat);
        lSpec.position.set(eyeX - eyeRadius * 0.2, eyeY + eyeRadius * 0.4, -eyeSpread + eyeRadius * 0.3);
        eyeGroup.add(lSpec);

        var rSpec = new THREE.Mesh(specGeo, specMat);
        rSpec.position.set(eyeX - eyeRadius * 0.2, eyeY + eyeRadius * 0.4, eyeSpread + eyeRadius * 0.3);
        eyeGroup.add(rSpec);

        return eyeGroup;
    }

    // -----------------------------------------------------------------------
    // Material
    // -----------------------------------------------------------------------

    createMaterial(albedoCanvas, normalCanvas, speciesConfig, speciesKey) {
        var albedoTex = new THREE.CanvasTexture(albedoCanvas);
        albedoTex.colorSpace = THREE.SRGBColorSpace;

        var normalTex = new THREE.CanvasTexture(normalCanvas);

        var isGranular = (speciesConfig.skinTexture === 'granular');
        var isSlimy = (speciesConfig.skinTexture === 'smooth-sticky');

        var roughness = 0.35;
        if (isGranular) roughness = 0.85;
        if (isSlimy) roughness = 0.2;

        // Normal map strength: stronger for granular skin, subtle for smooth
        var normalStrength = isGranular
            ? new THREE.Vector2(1.5, 1.5)
            : new THREE.Vector2(0.5, 0.5);

        // Per-species clearcoat from lookup table
        var cc = CLEARCOAT[speciesKey] || { clearcoat: 0.3, clearcoatRoughness: 0.2 };

        var mat = new THREE.MeshPhysicalMaterial({
            map: albedoTex,
            normalMap: normalTex,
            normalScale: normalStrength,
            roughness: roughness,
            metalness: 0,
            clearcoat: cc.clearcoat,
            clearcoatRoughness: cc.clearcoatRoughness,
            side: THREE.DoubleSide
        });

        return mat;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    _getBodyGeometry(speciesKey, speciesConfig, svl, totalLength) {
        var cacheKey = speciesKey + '_' + Math.round(svl) + '_' + Math.round(totalLength);
        if (this._geoCache[cacheKey]) {
            return this._geoCache[cacheKey].clone();
        }
        var geo = this.buildBodyGeometry(speciesConfig, svl, totalLength);
        this._geoCache[cacheKey] = geo;
        return geo.clone();
    }

    _addLimbs(group, speciesConfig, totalLen, limbRadius, limbLength, bodyMat) {
        var headRatio = speciesConfig.bodyProportions.headRatio || 0.18;
        var tailRatio = speciesConfig.bodyProportions.tailRatio || 0.45;

        // Forelimb X ~ 25% of body, hindlimb X ~ 75% of body (measured from snout)
        var foreLimbX = totalLen * (headRatio + 0.08);
        var hindLimbX = totalLen * (1 - tailRatio - 0.02);

        var limbGeo = new THREE.CylinderGeometry(limbRadius, limbRadius * 0.4, limbLength, 6, 1);

        var positions = [
            { x: foreLimbX, z: -1, label: 'limb_fl' },
            { x: foreLimbX, z:  1, label: 'limb_fr' },
            { x: hindLimbX, z: -1, label: 'limb_hl' },
            { x: hindLimbX, z:  1, label: 'limb_hr' }
        ];

        for (var i = 0; i < positions.length; i++) {
            var p = positions[i];
            var limb = new THREE.Mesh(limbGeo, bodyMat);
            limb.name = p.label;
            limb.castShadow = true;

            var spread = totalLen * 0.04;
            limb.position.set(p.x, -limbLength * 0.35, p.z * spread);

            // Angle limbs downward and slightly outward
            limb.rotation.z = p.z * 0.6;  // splay outward
            limb.rotation.x = 0.3;        // angle forward slightly

            group.add(limb);
        }
    }
}
