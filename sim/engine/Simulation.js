/**
 * Simulation — the main orchestrator.
 *
 * Manages the lifecycle of an experiment: setup → running → paused → complete.
 * Owns the canvas, runs the game loop via requestAnimationFrame, and coordinates
 * updates across the environment, agents, HUD, and data collector.
 *
 * Subclasses override init(), tick(), and render() to implement experiment logic.
 */

var ASPECT_RATIO = 10 / 16; // height / width for 16:10
var MIN_SPEED = 0.5;
var MAX_SPEED = 5;

export class Simulation {
    /** @type {'setup'|'running'|'paused'|'complete'} */
    state = 'setup';

    /** @type {HTMLCanvasElement} */
    canvas = null;

    /** @type {CanvasRenderingContext2D} */
    ctx = null;

    /** @type {number} Current tick/generation count */
    tickCount = 0;

    /** @type {number} Max ticks before auto-complete (0 = unlimited) */
    maxTicks = 0;

    /** @type {number} Ticks per second */
    tickRate = 1;

    /** @type {number} Speed multiplier (0.5x – 5x) */
    speed = 1;

    /** @type {Object|null} Environment instance */
    environment = null;

    /** @type {Array} Agent instances */
    agents = [];

    /**
     * @param {HTMLElement} container - DOM element to mount the simulation into.
     * @param {Object} config - Experiment parameters from the config screen.
     */
    constructor(container, config) {
        this._container = container;
        this._config = config;
        this._listeners = {};
        this._rafId = null;
        this._lastTick = 0;
        this._resizeObserver = null;
        this._boundLoop = this._loop.bind(this);
    }

    // ----------------------------------------------------------------
    // Event emitter
    // ----------------------------------------------------------------

    /**
     * Register a listener for an event.
     * @param {string} event
     * @param {Function} fn
     */
    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }

    /**
     * Remove a listener for an event.
     * @param {string} event
     * @param {Function} fn
     */
    off(event, fn) {
        var list = this._listeners[event];
        if (!list) return;
        this._listeners[event] = list.filter(function (f) { return f !== fn; });
    }

    /**
     * Emit an event, calling all registered listeners.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
        var list = this._listeners[event];
        if (!list) return;
        for (var i = 0; i < list.length; i++) list[i](data);
    }

    // ----------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------

    /**
     * Initialize canvas, environment, agents.
     * Subclasses MUST call super.init() before their own setup.
     */
    init() {
        var canvas = document.createElement('canvas');
        canvas.className = 'sim-canvas';
        this._container.appendChild(canvas);

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this._sizeCanvas();

        var self = this;
        this._resizeObserver = new ResizeObserver(function () {
            self._sizeCanvas();
            // Re-render after resize so the canvas isn't blank when paused/complete
            if (self.state !== 'setup') {
                self.render();
            }
        });
        this._resizeObserver.observe(this._container);
    }

    /**
     * Transition from setup → running. Starts the game loop.
     */
    start() {
        if (this.state !== 'setup') return;
        this._setState('running');
        this._lastTick = performance.now();
        this._rafId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Pause the simulation. Stops the game loop.
     */
    pause() {
        if (this.state !== 'running') return;
        this._setState('paused');
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    /**
     * Resume from paused. Restarts the game loop.
     */
    resume() {
        if (this.state !== 'paused') return;
        this._setState('running');
        this._lastTick = performance.now();
        this._rafId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Advance exactly one tick while paused.
     * Does nothing if the simulation isn't paused.
     */
    step() {
        if (this.state !== 'paused') return;
        this.tickCount++;
        this.emit('tick', this.tickCount);
        this.tick();
        this.render();

        if (this.maxTicks > 0 && this.tickCount >= this.maxTicks) {
            this._setState('complete');
            this.emit('complete', { tickCount: this.tickCount });
        }
    }

    /**
     * Reset everything back to the setup state.
     * Stops the loop, clears the canvas, resets the tick counter.
     */
    reset() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        this.tickCount = 0;
        this._lastTick = 0;

        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.emit('reset');
        this._setState('setup');
    }

    /**
     * Tear down everything. Cancel animation frame, remove the canvas,
     * disconnect the resize observer, clear all listeners.
     */
    destroy() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        this.canvas = null;
        this.ctx = null;
        this._listeners = {};
    }

    /**
     * Called once per tick. Subclasses override for experiment logic.
     * Base implementation updates the environment and then all agents.
     */
    tick() {
        if (this.environment) {
            this.environment.update(this.tickCount);
        }

        for (var i = 0; i < this.agents.length; i++) {
            this.agents[i].update(this.tickCount, this.environment);
        }
    }

    /**
     * Called every animation frame. Subclasses override for rendering.
     * Base implementation clears the canvas, renders the environment,
     * then renders all agents.
     */
    render() {
        var w = this.canvas.width;
        var h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        if (this.environment) {
            this.environment.render(this.ctx, w, h);
        }

        for (var i = 0; i < this.agents.length; i++) {
            this.agents[i].render(this.ctx);
        }
    }

    // ----------------------------------------------------------------
    // Speed control
    // ----------------------------------------------------------------

    /**
     * Set the speed multiplier. Clamped between 0.5 and 5.
     * @param {number} multiplier
     */
    setSpeed(multiplier) {
        this.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, multiplier));
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    /**
     * The core game loop. Runs via requestAnimationFrame while state is running.
     * Checks whether enough time has passed for the next tick; if so, increments
     * tickCount and calls tick(). Always calls render() each frame.
     * @param {number} now - Timestamp from requestAnimationFrame.
     * @private
     */
    _loop(now) {
        if (this.state !== 'running') return;

        var msPerTick = 1000 / (this.tickRate * this.speed);

        if (now - this._lastTick >= msPerTick) {
            this._lastTick = now;
            this.tickCount++;
            this.emit('tick', this.tickCount);
            this.tick();

            if (this.maxTicks > 0 && this.tickCount >= this.maxTicks) {
                this._setState('complete');
                this.emit('complete', { tickCount: this.tickCount });
                this.render();
                return;
            }
        }

        this.render();
        this._rafId = requestAnimationFrame(this._boundLoop);
    }

    /**
     * Resize the canvas to fill the container width at a 16:10 aspect ratio.
     * @private
     */
    _sizeCanvas() {
        var width = this._container.clientWidth;
        var height = Math.round(width * ASPECT_RATIO);

        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
    }

    /**
     * Transition to a new state and emit the stateChange event.
     * @param {'setup'|'running'|'paused'|'complete'} newState
     * @private
     */
    _setState(newState) {
        var prev = this.state;
        this.state = newState;
        this.emit('stateChange', { from: prev, to: newState });
    }
}
