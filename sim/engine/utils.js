/**
 * Shared math and random helpers for the simulation engine.
 * No external dependencies — pure functions only.
 */

/**
 * Random float in [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Random integer in [min, max] (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Clamp a value between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Fisher-Yates shuffle (in place). Returns the array.
 * @param {Array} array
 * @returns {Array}
 */
export function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = randomInt(0, i);
        var tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
    return array;
}

/**
 * Pick an item from a weighted list.
 * @param {Array} items
 * @param {number[]} weights - Must sum to > 0.
 * @returns {*}
 */
export function weightedChoice(items, weights) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i];
    var r = Math.random() * total;
    var cumulative = 0;
    for (var i = 0; i < items.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) return items[i];
    }
    return items[items.length - 1];
}

/**
 * Gaussian random via Box-Muller transform.
 * @param {number} mean
 * @param {number} stdev
 * @returns {number}
 */
export function gaussianRandom(mean, stdev) {
    var u1 = Math.random();
    var u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdev;
}

/**
 * Format a number to a fixed number of decimal places.
 * @param {number} n
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(n, decimals) {
    return Number(n).toFixed(decimals);
}

/**
 * Sample from a Binomial(n, p) distribution.
 * Uses direct Bernoulli trials — accurate for all n, no normal approximation.
 * @param {number} n - Number of trials.
 * @param {number} p - Probability of success per trial.
 * @returns {number} Number of successes.
 */
export function binomialSample(n, p) {
    if (p <= 0) return 0;
    if (p >= 1) return n;
    var successes = 0;
    for (var i = 0; i < n; i++) {
        if (Math.random() < p) successes++;
    }
    return successes;
}
