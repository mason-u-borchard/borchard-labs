/**
 * Agent — an individual entity in the simulation.
 *
 * Has a unique ID, position, traits (plain object), and alive/dead flag.
 * Subclasses override update() for experiment-specific behavior and
 * render() for visual representation on the canvas.
 */

var _nextId = 1;

export class Agent {
    /**
     * @param {Object} traits - Key-value pairs describing this agent's properties.
     */
    constructor(traits) {
        this.id = _nextId++;
        this.x = 0;
        this.y = 0;
        this.alive = true;
        this.traits = traits || {};
    }

    /**
     * Called once per tick. Override for behavior.
     * @param {number} tick
     * @param {Environment} environment
     */
    update(tick, environment) {}

    /**
     * Draw this agent on the canvas. Override for visuals.
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {}

    /**
     * Get a trait value by key.
     * @param {string} key
     * @returns {*}
     */
    getTrait(key) {
        return this.traits[key];
    }

    /**
     * Set a trait value by key.
     * @param {string} key
     * @param {*} value
     */
    setTrait(key, value) {
        this.traits[key] = value;
    }
}

/** Reset the ID counter (useful for sim reset). */
Agent.resetIds = function () {
    _nextId = 1;
};
