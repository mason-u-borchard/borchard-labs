/**
 * Hardy-Weinberg Equilibrium — default parameters and constants.
 */

export var DEFAULTS = {
    populationSize: 500,
    initialP: 0.5,
    generations: 100,

    enableMutation: false,
    mutationForward: 0.001,
    mutationReverse: 0.001,

    enableSelection: false,
    fitnessAA: 1.0,
    fitnessAa: 1.0,
    fitnessaa: 1.0,

    enableDrift: true,

    enableMigration: false,
    migrationRate: 0.01,
    migrantP: 0.5,

    enableAssortativeMating: false,
    assortativeMatingCoeff: 0.0
};

export var COLORS = {
    AA: '#2d6a4f',   // forest
    Aa: '#457b9d',   // ocean-light
    aa: '#b8860b',   // gold
    expected: '#888'  // ink-faint, for HW equilibrium overlay lines
};
