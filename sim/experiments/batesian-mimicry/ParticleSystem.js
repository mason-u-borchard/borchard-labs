/**
 * Batesian Mimicry Simulation -- Ambient Particle System
 *
 * Renders falling leaves and floating dust motes to add atmosphere
 * to the forest environment. Uses a pre-allocated object pool
 * (max 20 particles) to avoid allocations during gameplay.
 *
 * Mason Borchard, 2026
 */

import { COLORS, getSeason } from './config.js';
import { randomFloat } from '../../engine/utils.js';


// Target particle counts per view mode
var VIEW_TARGETS = {
    transect:    { leaf: 10, dust: 4 },
    approach:    { leaf: 4,  dust: 2 },
    examination: { leaf: 1,  dust: 1 }
};

var MAX_POOL_SIZE = 20;


export class ParticleSystem {
    constructor(canvasWidth, canvasHeight, season) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.season = season || getSeason(new Date().getMonth());

        // Pre-allocate the full particle pool
        this.pool = [];
        for (var i = 0; i < MAX_POOL_SIZE; i++) {
            this.pool.push({
                active: false,
                type: 'leaf',
                x: 0, y: 0,
                vx: 0, vy: 0,
                rotation: 0,
                rotSpeed: 0,
                life: 0,
                maxLife: 0,
                size: 0,
                color: '#000',
                alpha: 0
            });
        }

        // Start with transect targets
        this.targets = { leaf: VIEW_TARGETS.transect.leaf, dust: VIEW_TARGETS.transect.dust };

        // Initial spawn
        this.spawn('leaf', this.targets.leaf);
        this.spawn('dust', this.targets.dust);
    }

    /**
     * Activates `count` particles of the given type from the pool.
     */
    spawn(type, count) {
        var spawned = 0;
        for (var i = 0; i < this.pool.length && spawned < count; i++) {
            var p = this.pool[i];
            if (p.active) continue;

            p.active = true;
            p.type = type;

            if (type === 'leaf') {
                p.x = randomFloat(0, this.width);
                p.y = randomFloat(-30, -10);
                p.vx = randomFloat(-8, 8);
                p.vy = randomFloat(12, 25);
                p.rotation = randomFloat(0, Math.PI * 2);
                p.rotSpeed = randomFloat(-0.5, 0.5);
                p.size = randomFloat(3, 8);
                var palette = COLORS[this.season].litter;
                p.color = palette[Math.floor(Math.random() * palette.length)];
                p.life = randomFloat(6, 14);
                p.maxLife = p.life;
                p.alpha = randomFloat(0.5, 0.75);
            } else {
                // dust mote
                p.x = randomFloat(0, this.width);
                p.y = randomFloat(0, this.height);
                p.vx = randomFloat(-2, 2);
                p.vy = randomFloat(-2, 2);
                p.rotation = 0;
                p.rotSpeed = 0;
                p.size = randomFloat(0.5, 1.5);
                p.color = 'rgba(255, 255, 240, 0.6)';
                p.life = randomFloat(4, 10);
                p.maxLife = p.life;
                p.alpha = randomFloat(0.3, 0.5);
            }

            spawned++;
        }
    }

    /**
     * Advances all active particles by dt seconds.
     * Handles movement, rotation, fading, wind wobble, and auto-respawn.
     */
    update(dt) {
        var leafCount = 0;
        var dustCount = 0;

        for (var i = 0; i < this.pool.length; i++) {
            var p = this.pool[i];
            if (!p.active) continue;

            // Move
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Rotate
            p.rotation += p.rotSpeed * dt;

            // Age
            p.life -= dt;

            // Fade near end of life
            if (p.life < 1.0 && p.life > 0) {
                p.alpha *= p.life;
            }

            // Wind wobble for leaves
            if (p.type === 'leaf') {
                p.vx += Math.sin(p.life * 2) * 0.5;
            }

            // Deactivate dead or off-screen particles
            if (p.life <= 0 || p.x < -50 || p.x > this.width + 50 || p.y > this.height + 50) {
                p.active = false;
                continue;
            }

            // Count survivors
            if (p.type === 'leaf') leafCount++;
            else dustCount++;
        }

        // Auto-respawn shortfall
        var leafDef = this.targets.leaf - leafCount;
        var dustDef = this.targets.dust - dustCount;
        if (leafDef > 0) this.spawn('leaf', leafDef);
        if (dustDef > 0) this.spawn('dust', dustDef);
    }

    /**
     * Draws all active particles onto the given canvas context.
     */
    render(ctx) {
        for (var i = 0; i < this.pool.length; i++) {
            var p = this.pool[i];
            if (!p.active) continue;

            if (p.type === 'leaf') {
                this._drawLeaf(ctx, p);
            } else {
                this._drawDust(ctx, p);
            }
        }
    }

    /**
     * Draws a single leaf particle -- organic pointed shape with center vein.
     */
    _drawLeaf(ctx, p) {
        var size = p.size;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.alpha);

        // Leaf body
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.quadraticCurveTo(-size * 0.5, -size * 0.6, 0, -size * 0.15);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.6, size, 0);
        ctx.quadraticCurveTo(size * 0.5, size * 0.6, 0, size * 0.15);
        ctx.quadraticCurveTo(-size * 0.5, size * 0.6, -size, 0);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();

        // Center vein -- slightly darker stroke down the midline
        ctx.beginPath();
        ctx.moveTo(-size * 0.85, 0);
        ctx.lineTo(size * 0.85, 0);
        ctx.strokeStyle = this._darken(p.color, 0.25);
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draws a single dust mote -- small filled circle.
     */
    _drawDust(ctx, p) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
    }

    /**
     * Darkens a hex color string by the given amount (0--1).
     * Falls back to returning the original if it can't parse.
     */
    _darken(hex, amount) {
        if (hex.charAt(0) !== '#') return hex;
        var num = parseInt(hex.slice(1), 16);
        var r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount)) | 0;
        var g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount)) | 0;
        var b = Math.max(0, (num & 0xff) * (1 - amount)) | 0;
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    /**
     * Adjusts target particle counts for the current view.
     * Deactivates excess particles immediately; shortfall is picked
     * up by the next update() call.
     */
    setViewMode(viewName) {
        var t = VIEW_TARGETS[viewName];
        if (!t) return;
        this.targets.leaf = t.leaf;
        this.targets.dust = t.dust;

        // Deactivate excess
        var leafCount = 0;
        var dustCount = 0;
        for (var i = 0; i < this.pool.length; i++) {
            var p = this.pool[i];
            if (!p.active) continue;

            if (p.type === 'leaf') {
                leafCount++;
                if (leafCount > this.targets.leaf) p.active = false;
            } else {
                dustCount++;
                if (dustCount > this.targets.dust) p.active = false;
            }
        }
    }

    /**
     * Updates canvas bounds for spawn position calculations.
     */
    resize(canvasWidth, canvasHeight) {
        this.width = canvasWidth;
        this.height = canvasHeight;
    }

    /**
     * Deactivates all particles.
     */
    clear() {
        for (var i = 0; i < this.pool.length; i++) {
            this.pool[i].active = false;
        }
    }
}
