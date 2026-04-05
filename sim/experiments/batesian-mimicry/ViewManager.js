/**
 * ViewManager.js -- Camera state, view transitions, and coordinate transforms
 * for the Batesian mimicry field simulation.
 *
 * Manages a three-view camera system:
 *   - Transect (wide): full transect visible, zoom = 1
 *   - Approach (medium): crouching down, zoom = 3.5, centered on cover object
 *   - Examination (close-up): leaning in, zoom = 8, centered on reveal position
 *
 * Pure math and state -- no imports, no DOM access, no engine dependencies.
 */


// ── Easing functions ────────────────────────────────────────────────────────

/**
 * Ease-out cubic -- fast start, gentle deceleration.
 * Good for zoom-in transitions where you want the destination to settle smoothly.
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased progress
 */
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-in-out cubic -- smooth acceleration and deceleration on both ends.
 * Good for zoom-out and lateral pans.
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased progress
 */
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Hermite smoothstep -- classic smooth interpolation.
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased progress
 */
export function smoothstep(t) {
    return t * t * (3 - 2 * t);
}


// ── View presets ────────────────────────────────────────────────────────────

var VIEW_PRESETS = {
    transect:    { zoom: 1,   duration: 700, easing: easeInOutCubic },
    approach:    { zoom: 3.5, duration: 900, easing: easeOutCubic },
    examination: { zoom: 8,   duration: 500, easing: easeOutCubic }
};


// ── ViewManager ─────────────────────────────────────────────────────────────

export class ViewManager {

    /**
     * @param {number} canvasWidth - Canvas width in pixels
     * @param {number} canvasHeight - Canvas height in pixels
     */
    constructor(canvasWidth, canvasHeight) {
        this._canvasWidth = canvasWidth;
        this._canvasHeight = canvasHeight;

        /** @type {{ x: number, y: number, zoom: number }} */
        this.camera = {
            x: canvasWidth / 2,
            y: canvasHeight / 2,
            zoom: 1
        };

        // Transition state
        /** @type {{ x: number, y: number, zoom: number } | null} */
        this._target = null;
        /** @type {{ x: number, y: number, zoom: number } | null} */
        this._source = null;
        /** @type {number | null} */
        this._transitionStart = null;
        /** @type {number} */
        this._transitionDuration = 0;
        /** @type {Function | null} */
        this._easingFn = null;
        /** @type {Function | null} */
        this._onComplete = null;

        /** @type {string} */
        this._currentView = 'transect';
    }

    // ── Named view shortcuts ────────────────────────────────────────────

    /**
     * Transition to a named view preset.
     *
     * @param {'transect' | 'approach' | 'examination'} viewName
     * @param {Object} [coverObj] - Cover object to center on (required for approach/examination)
     * @param {Function} [onComplete] - Called when the transition finishes
     */
    setView(viewName, coverObj, onComplete) {
        var preset = VIEW_PRESETS[viewName];
        if (!preset) return;

        var targetX, targetY;

        switch (viewName) {
            case 'transect':
                targetX = this._canvasWidth / 2;
                targetY = this._canvasHeight / 2;
                break;

            case 'approach':
                if (!coverObj) return;
                targetX = coverObj.x;
                targetY = coverObj.y;
                break;

            case 'examination':
                if (!coverObj) return;
                var revealPos = coverObj.getRevealPosition();
                targetX = revealPos.x;
                targetY = revealPos.y;
                break;
        }

        this._currentView = viewName;

        this.transitionTo(
            targetX, targetY, preset.zoom,
            preset.duration, preset.easing, onComplete
        );
    }

    // ── Transition engine ───────────────────────────────────────────────

    /**
     * Start an animated transition from the current camera position to a target.
     *
     * @param {number} targetX - World X to center on
     * @param {number} targetY - World Y to center on
     * @param {number} targetZoom - Target zoom level
     * @param {number} durationMs - Transition duration in milliseconds
     * @param {Function} easingFn - Easing function, takes t in [0,1], returns progress
     * @param {Function} [onComplete] - Called when the transition finishes
     */
    transitionTo(targetX, targetY, targetZoom, durationMs, easingFn, onComplete) {
        this._source = {
            x: this.camera.x,
            y: this.camera.y,
            zoom: this.camera.zoom
        };

        this._target = {
            x: targetX,
            y: targetY,
            zoom: targetZoom
        };

        this._transitionStart = null; // will be set on first update() call
        this._transitionDuration = durationMs;
        this._easingFn = easingFn || easeOutCubic;
        this._onComplete = onComplete || null;
    }

    /**
     * Advance the transition interpolation. Call once per frame.
     *
     * @param {number} now - Current timestamp (performance.now())
     * @returns {boolean} True if still transitioning, false if idle
     */
    update(now) {
        if (!this._target) return false;

        // Lazy-set the start time on the first frame of the transition.
        // This avoids stale timestamps if there's a gap between transitionTo()
        // and the first render frame.
        if (this._transitionStart === null) {
            this._transitionStart = now;
        }

        var elapsed = now - this._transitionStart;
        var t = this._transitionDuration > 0
            ? Math.min(elapsed / this._transitionDuration, 1)
            : 1;

        var progress = this._easingFn(t);

        // Interpolate camera
        this.camera.x = this._source.x + (this._target.x - this._source.x) * progress;
        this.camera.y = this._source.y + (this._target.y - this._source.y) * progress;
        this.camera.zoom = this._source.zoom + (this._target.zoom - this._source.zoom) * progress;

        // Transition complete
        if (t >= 1) {
            this.camera.x = this._target.x;
            this.camera.y = this._target.y;
            this.camera.zoom = this._target.zoom;

            var cb = this._onComplete;

            this._target = null;
            this._source = null;
            this._transitionStart = null;
            this._transitionDuration = 0;
            this._easingFn = null;
            this._onComplete = null;

            if (cb) cb();

            return false;
        }

        return true;
    }

    // ── Canvas transform ────────────────────────────────────────────────

    /**
     * Apply the current camera state as a canvas 2D transform.
     * After this call, drawing in world coordinates will render correctly
     * on screen with the camera's pan and zoom applied.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    applyTransform(ctx) {
        ctx.setTransform(
            this.camera.zoom, 0,
            0, this.camera.zoom,
            -this.camera.x * this.camera.zoom + this._canvasWidth / 2,
            -this.camera.y * this.camera.zoom + this._canvasHeight / 2
        );
    }

    /**
     * Reset the canvas transform back to the identity matrix.
     * Call this before drawing HUD elements or other screen-space overlays.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    resetTransform(ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ── Coordinate conversion ───────────────────────────────────────────

    /**
     * Convert screen (pixel) coordinates to world coordinates.
     * Use this to translate click/mouse positions into the simulation space.
     *
     * @param {number} sx - Screen X (pixels from left edge of canvas)
     * @param {number} sy - Screen Y (pixels from top edge of canvas)
     * @returns {{ x: number, y: number }} World coordinates
     */
    screenToWorld(sx, sy) {
        return {
            x: (sx - this._canvasWidth / 2) / this.camera.zoom + this.camera.x,
            y: (sy - this._canvasHeight / 2) / this.camera.zoom + this.camera.y
        };
    }

    /**
     * Convert world coordinates to screen (pixel) coordinates.
     * Inverse of screenToWorld.
     *
     * @param {number} wx - World X
     * @param {number} wy - World Y
     * @returns {{ x: number, y: number }} Screen coordinates
     */
    worldToScreen(wx, wy) {
        return {
            x: (wx - this.camera.x) * this.camera.zoom + this._canvasWidth / 2,
            y: (wy - this.camera.y) * this.camera.zoom + this._canvasHeight / 2
        };
    }

    // ── Query methods ───────────────────────────────────────────────────

    /**
     * @returns {boolean} True if a transition is currently in progress
     */
    isTransitioning() {
        return this._target !== null;
    }

    /**
     * @returns {string} The current view name ('transect', 'approach', or 'examination')
     */
    getCurrentView() {
        return this._currentView;
    }

    /**
     * @returns {{ x: number, y: number, zoom: number }} A copy of the current camera state
     */
    getCamera() {
        return {
            x: this.camera.x,
            y: this.camera.y,
            zoom: this.camera.zoom
        };
    }

    // ── Resize handling ─────────────────────────────────────────────────

    /**
     * Update stored canvas dimensions. If currently in transect view
     * (and not transitioning), re-center the camera on the new canvas center.
     *
     * @param {number} canvasWidth - New canvas width
     * @param {number} canvasHeight - New canvas height
     */
    resize(canvasWidth, canvasHeight) {
        this._canvasWidth = canvasWidth;
        this._canvasHeight = canvasHeight;

        if (this._currentView === 'transect' && !this.isTransitioning()) {
            this.camera.x = canvasWidth / 2;
            this.camera.y = canvasHeight / 2;
        }
    }
}
