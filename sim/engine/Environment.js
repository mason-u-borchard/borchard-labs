/**
 * Environment — the world.
 *
 * Holds shared state accessible to all agents (allele pools, resource levels,
 * spatial boundaries, etc). Provides getter/setter interface for global state
 * and an update() hook called once per tick for environment-level changes.
 *
 * Subclasses override to model specific environments.
 */

export class Environment {
    /**
     * @param {Object} config - Environment parameters from experiment config.
     */
    constructor(config) {
        this._config = config || {};
        this._initialState = {};
        this._state = {};
    }

    /**
     * Get a shared state value.
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Set a shared state value.
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        this._state[key] = value;
    }

    /**
     * Returns a shallow copy of the full state object.
     * @returns {Object}
     */
    getAll() {
        return Object.assign({}, this._state);
    }

    /**
     * Called once per tick by the Simulation. Base is a no-op.
     * Subclasses override for environment-level changes per generation
     * (e.g., adjusting allele frequencies, shifting resources).
     * @param {number} tick
     */
    update(tick) {}

    /**
     * Optional rendering hook. Called by Simulation to draw background.
     * Override if the environment has a visual representation.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     * @param {number} height
     */
    render(ctx, width, height) {}

    /**
     * Reset all state back to initial values.
     * Subclasses should override and call super.reset().
     */
    reset() {
        this._state = Object.assign({}, this._initialState);
    }
}
