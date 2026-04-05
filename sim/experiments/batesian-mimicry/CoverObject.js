/**
 * Cover Object -- Batesian Mimicry Field Simulation
 *
 * Represents a single flippable cover object on the forest transect
 * (rock, log, bark piece, or board). Each object can be clicked to
 * reveal what's underneath -- possibly a salamander, invertebrates,
 * or bare soil.
 *
 * Quality score follows a Beta(2,5) distribution and modulates
 * encounter probability -- better-quality cover (moist, embedded,
 * good contact with soil) has higher scores.
 */

import { randomFloat, randomInt } from '../../engine/utils.js';
import { COVER_SIZES, COLORS } from './config.js';


// Animation timing
var LIFT_DURATION = 250; // ms


export class CoverObject {

    constructor(id, type, x, y, qualityScore) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.qualityScore = qualityScore;

        // Dimensions from config ranges
        var sizeRange = COVER_SIZES[type];
        this.width  = randomInt(sizeRange.width[0],  sizeRange.width[1]);
        this.height = randomInt(sizeRange.height[0], sizeRange.height[1]);

        // State machine
        this.state = 'covered';
        this.checked = false;
        this.animal = null;

        // Animation
        this.liftProgress = 0;
        this.liftStartTime = null;

        // Slight rotation for a natural look
        this.rotation = randomFloat(-0.15, 0.15);

        // Type-specific geometry
        if (type === 'rock') {
            this._generateRockVertices();
        } else if (type === 'log') {
            this._generateLogDetails();
        }
    }

    /**
     * Pre-compute irregular polygon vertices for a rock shape.
     * 5--8 vertices around an ellipse with random radial offsets.
     */
    _generateRockVertices() {
        var count = randomInt(5, 8);
        this.rockVertices = [];

        var rx = this.width / 2;
        var ry = this.height / 2;

        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 * i) / count;
            // Radial offset: +/- 20% of the average radius
            var avgR = (rx + ry) / 2;
            var offset = randomFloat(-0.20, 0.20) * avgR;
            this.rockVertices.push({
                angle: angle,
                rx: rx + offset * Math.cos(angle),
                ry: ry + offset * Math.sin(angle)
            });
        }
    }

    /**
     * Pre-compute slight curve and knot positions for a log.
     */
    _generateLogDetails() {
        // A gentle vertical curve offset at the midpoint
        this.logCurve = randomFloat(-3, 3);

        // 1--3 knot positions along the log (0--1 normalized x)
        var knotCount = randomInt(1, 3);
        this.logKnots = [];
        for (var i = 0; i < knotCount; i++) {
            this.logKnots.push({
                pos: randomFloat(0.15, 0.85),
                radius: randomFloat(2, 4)
            });
        }
    }

    // ---------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------

    /**
     * Draw the cover object on the canvas.
     * Appearance depends on current state.
     */
    render(ctx) {
        ctx.save();

        if (this.state === 'covered') {
            this._renderCovered(ctx);
        } else if (this.state === 'lifting') {
            this._renderGround(ctx, 0);
            this._renderLifting(ctx);
        } else if (this.state === 'uncovered') {
            this._renderGround(ctx, 1);
            this._renderUncovered(ctx);
        }

        ctx.restore();
    }

    /**
     * Draw the ground / soil patch underneath, with leaf litter.
     * visibility: 0--1 (used for fade-in during lift)
     */
    _renderGround(ctx, visibility) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.6 * visibility;

        // Dark soil rectangle
        var gx = this.x - 2;
        var gy = this.y - 2;
        var gw = this.width + 4;
        var gh = this.height + 4;

        ctx.fillStyle = COLORS.soilDark;
        ctx.fillRect(gx, gy, gw, gh);

        // Scatter a few soil highlights
        ctx.fillStyle = COLORS.soilLight;
        for (var i = 0; i < 5; i++) {
            var sx = randomFloat(gx + 2, gx + gw - 4);
            var sy = randomFloat(gy + 2, gy + gh - 4);
            ctx.fillRect(sx, sy, randomFloat(2, 5), randomFloat(1, 3));
        }

        // Moisture sheen if high quality
        if (this.qualityScore > 0.5) {
            ctx.fillStyle = 'rgba(120, 160, 200, 0.12)';
            ctx.fillRect(gx, gy, gw, gh);
        }

        ctx.restore();
    }

    /**
     * Render the object in its resting (covered) position.
     */
    _renderCovered(ctx) {
        // Shadow underneath
        ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
        ctx.fillRect(this.x + 3, this.y + 3, this.width, this.height);

        // Apply rotation around center
        var cx = this.x + this.width / 2;
        var cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);
        ctx.translate(-cx, -cy);

        this._drawObject(ctx, this.x, this.y, 1.0);
    }

    /**
     * Render mid-lift: object offset up-left, with slight transparency.
     */
    _renderLifting(ctx) {
        var t = this.liftProgress;
        var offsetX = -t * 15;
        var offsetY = -t * 15;
        var alpha = 1.0 - t * 0.15;

        var cx = this.x + this.width / 2;
        var cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);
        ctx.translate(-cx, -cy);

        this._drawObject(ctx, this.x + offsetX, this.y + offsetY, alpha);
    }

    /**
     * Render after fully uncovered: object settled to the side,
     * plus checked indicator.
     */
    _renderUncovered(ctx) {
        // Draw the object offset to the upper-left (settled position)
        var settledX = this.x - 15;
        var settledY = this.y - 15;

        ctx.save();
        var cx = settledX + this.width / 2;
        var cy = settledY + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation + 0.1);
        ctx.translate(-cx, -cy);

        this._drawObject(ctx, settledX, settledY, 0.85);
        ctx.restore();

        // If there's an animal, it renders itself via the simulation loop --
        // but draw a subtle highlight around the reveal area
        if (this.animal) {
            ctx.strokeStyle = COLORS.correct;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
            ctx.setLineDash([]);
        }

        // Small green checkmark in corner
        this._drawCheckmark(ctx, this.x + this.width - 2, this.y - 2);
    }

    /**
     * Draw the actual object shape at the given position.
     */
    _drawObject(ctx, ox, oy, alpha) {
        ctx.globalAlpha = alpha;

        switch (this.type) {
            case 'rock':  this._drawRock(ctx, ox, oy);  break;
            case 'log':   this._drawLog(ctx, ox, oy);   break;
            case 'bark':  this._drawBark(ctx, ox, oy);  break;
            case 'board': this._drawBoard(ctx, ox, oy);  break;
        }

        ctx.globalAlpha = 1.0;
    }

    /**
     * Irregular polygon rock with gradient shading.
     */
    _drawRock(ctx, ox, oy) {
        var cx = ox + this.width / 2;
        var cy = oy + this.height / 2;

        // Radial gradient for 3D effect
        var grad = ctx.createRadialGradient(
            cx - this.width * 0.15, cy - this.height * 0.15,
            2,
            cx, cy,
            Math.max(this.width, this.height) * 0.6
        );
        grad.addColorStop(0, COLORS.rockLight);
        grad.addColorStop(1, COLORS.rockDark);

        ctx.beginPath();
        for (var i = 0; i < this.rockVertices.length; i++) {
            var v = this.rockVertices[i];
            var px = cx + v.rx * Math.cos(v.angle);
            var py = cy + v.ry * Math.sin(v.angle);
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();

        ctx.fillStyle = grad;
        ctx.fill();

        // Subtle dark edge
        ctx.strokeStyle = COLORS.rockShadow;
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    /**
     * Elongated rounded rectangle with bark texture and end ring.
     */
    _drawLog(ctx, ox, oy) {
        var r = Math.min(this.height / 2, 6);

        // Main bark body with slight vertical curve
        ctx.beginPath();
        ctx.moveTo(ox + r, oy);
        ctx.lineTo(ox + this.width - r, oy);
        ctx.arcTo(ox + this.width, oy, ox + this.width, oy + r, r);
        ctx.lineTo(ox + this.width, oy + this.height / 2 + this.logCurve);
        ctx.arcTo(ox + this.width, oy + this.height, ox + this.width - r, oy + this.height, r);
        ctx.lineTo(ox + r, oy + this.height);
        ctx.arcTo(ox, oy + this.height, ox, oy + this.height - r, r);
        ctx.lineTo(ox, oy + this.height / 2 + this.logCurve);
        ctx.arcTo(ox, oy, ox + r, oy, r);
        ctx.closePath();

        ctx.fillStyle = COLORS.logBark;
        ctx.fill();
        ctx.strokeStyle = '#4a2e14';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Bark grain lines
        ctx.strokeStyle = 'rgba(40, 25, 10, 0.3)';
        ctx.lineWidth = 0.5;
        for (var i = 0; i < 4; i++) {
            var ly = oy + (this.height * (i + 1)) / 5;
            ctx.beginPath();
            ctx.moveTo(ox + 3, ly);
            ctx.lineTo(ox + this.width - 3, ly + randomFloat(-1, 1));
            ctx.stroke();
        }

        // Knots
        for (var k = 0; k < this.logKnots.length; k++) {
            var knot = this.logKnots[k];
            var kx = ox + this.width * knot.pos;
            var ky = oy + this.height / 2;
            ctx.beginPath();
            ctx.arc(kx, ky, knot.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#4a2e14';
            ctx.fill();
        }

        // Cross-section ring on right end
        var ringCx = ox + this.width - r;
        var ringCy = oy + this.height / 2;
        var ringR = this.height / 2 - 2;
        if (ringR > 2) {
            ctx.beginPath();
            ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.logRing;
            ctx.fill();
            ctx.strokeStyle = '#4a2e14';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Inner ring
            ctx.beginPath();
            ctx.arc(ringCx, ringCy, ringR * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(60, 35, 15, 0.4)';
            ctx.stroke();
        }
    }

    /**
     * Thin, slightly curved bark piece.
     */
    _drawBark(ctx, ox, oy) {
        // Slight curve via quadratic bezier
        ctx.beginPath();
        ctx.moveTo(ox, oy + 2);
        ctx.quadraticCurveTo(ox + this.width * 0.5, oy - 2, ox + this.width, oy + 1);
        ctx.lineTo(ox + this.width - 1, oy + this.height - 1);
        ctx.quadraticCurveTo(ox + this.width * 0.5, oy + this.height + 2, ox + 1, oy + this.height);
        ctx.closePath();

        ctx.fillStyle = COLORS.barkPiece;
        ctx.fill();
        ctx.strokeStyle = '#6a4e2a';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Texture lines
        ctx.strokeStyle = 'rgba(50, 30, 10, 0.25)';
        ctx.lineWidth = 0.4;
        for (var i = 0; i < 3; i++) {
            var ly = oy + (this.height * (i + 1)) / 4;
            ctx.beginPath();
            ctx.moveTo(ox + 2, ly);
            ctx.lineTo(ox + this.width - 2, ly + randomFloat(-1, 1));
            ctx.stroke();
        }
    }

    /**
     * Clean rectangle with wood grain -- plywood board.
     */
    _drawBoard(ctx, ox, oy) {
        ctx.fillStyle = COLORS.boardWood;
        ctx.fillRect(ox, oy, this.width, this.height);

        // Darker edge
        ctx.strokeStyle = '#a08058';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox, oy, this.width, this.height);

        // Wood grain lines (horizontal)
        ctx.strokeStyle = 'rgba(120, 80, 40, 0.2)';
        ctx.lineWidth = 0.5;
        for (var i = 0; i < 6; i++) {
            var ly = oy + (this.height * (i + 1)) / 7;
            ctx.beginPath();
            ctx.moveTo(ox + 1, ly);
            ctx.lineTo(ox + this.width - 1, ly);
            ctx.stroke();
        }

        // Slight weathering on one corner
        ctx.fillStyle = 'rgba(80, 60, 40, 0.12)';
        ctx.fillRect(ox, oy, this.width * 0.3, this.height * 0.3);
    }

    /**
     * Small checkmark to indicate a checked object.
     */
    _drawCheckmark(ctx, x, y) {
        ctx.save();
        ctx.strokeStyle = COLORS.correct;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 3);
        ctx.lineTo(x - 3, y + 6);
        ctx.lineTo(x + 2, y - 1);
        ctx.stroke();
        ctx.restore();
    }

    // ---------------------------------------------------------------
    // Interaction
    // ---------------------------------------------------------------

    /**
     * Returns true if the point (mx, my) is inside the bounding box.
     * Uses axis-aligned rectangle test (rotation is small enough
     * that this is fine for click detection).
     */
    hitTest(mx, my) {
        return mx >= this.x
            && mx <= this.x + this.width
            && my >= this.y
            && my <= this.y + this.height;
    }

    /**
     * Begin lifting this cover object.
     * Returns true if the flip was valid (object was still covered),
     * false if it was already lifted or checked.
     */
    flip() {
        if (this.state !== 'covered') {
            return false;
        }
        this.state = 'lifting';
        this.liftStartTime = performance.now();
        return true;
    }

    /**
     * Advance the lift animation.
     * Call each frame while state is 'lifting'.
     */
    updateAnimation(now) {
        if (this.state !== 'lifting') return;

        var elapsed = now - this.liftStartTime;
        this.liftProgress = Math.min(elapsed / LIFT_DURATION, 1);

        if (this.liftProgress >= 1) {
            this.state = 'uncovered';
            this.checked = true;
            this.liftProgress = 1;
        }
    }

    // ---------------------------------------------------------------
    // Animal management
    // ---------------------------------------------------------------

    /**
     * Store a reference to the salamander found underneath.
     */
    setAnimal(salamander) {
        this.animal = salamander;
    }

    /**
     * Return the animal underneath, or null if empty.
     */
    getAnimal() {
        return this.animal;
    }

    // ---------------------------------------------------------------
    // Accessors
    // ---------------------------------------------------------------

    /**
     * Whether this object has been flipped and checked.
     */
    isChecked() {
        return this.checked;
    }

    /**
     * Axis-aligned bounding box.
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Position where a found animal should render --
     * center of the original cover area (the revealed ground).
     */
    getRevealPosition() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }
}
