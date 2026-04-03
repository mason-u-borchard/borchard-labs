/**
 * Hardy-Weinberg Population Model.
 * Extends Environment to track allele frequencies and apply evolutionary forces.
 *
 * State keys:
 *   p         - frequency of allele A
 *   q         - frequency of allele a
 *   freqAA    - observed frequency of genotype AA
 *   freqAa    - observed frequency of genotype Aa
 *   freqaa    - observed frequency of genotype aa
 *   N         - current population size
 */

import { Environment } from '../../engine/Environment.js';
import { binomialSample } from '../../engine/utils.js';

export class HWPopulation extends Environment {
    constructor(config) {
        super(config);

        var p = config.initialP;
        var q = 1 - p;

        this._initialState = {
            p: p,
            q: q,
            freqAA: p * p,
            freqAa: 2 * p * q,
            freqaa: q * q,
            N: config.populationSize
        };

        this._state = Object.assign({}, this._initialState);

        // History for charting — stores per-generation snapshots
        this.history = [{
            p: p,
            q: q,
            freqAA: p * p,
            freqAa: 2 * p * q,
            freqaa: q * q,
            N: config.populationSize
        }];
    }

    /**
     * Advance one generation. Applies evolutionary forces in order:
     * selection → mutation → migration → drift → non-random mating.
     */
    update(tick) {
        var cfg = this._config;
        var p = this._state.p;
        var q = this._state.q;
        var N = cfg.populationSize;

        // 1. Selection
        if (cfg.enableSelection) {
            var wAA = cfg.fitnessAA;
            var wAa = cfg.fitnessAa;
            var waa = cfg.fitnessaa;
            var wBar = p * p * wAA + 2 * p * q * wAa + q * q * waa;
            if (wBar > 0) {
                p = (p * p * wAA + p * q * wAa) / wBar;
                q = 1 - p;
            }
        }

        // 2. Mutation
        if (cfg.enableMutation) {
            var muForward = cfg.mutationForward;   // A → a
            var muReverse = cfg.mutationReverse;    // a → A
            p = p * (1 - muForward) + q * muReverse;
            q = 1 - p;
        }

        // 3. Migration
        if (cfg.enableMigration) {
            var m = cfg.migrationRate;
            var pMig = cfg.migrantP;
            p = (1 - m) * p + m * pMig;
            q = 1 - p;
        }

        // 4. Genetic drift (binomial sampling from finite population)
        if (cfg.enableDrift) {
            var countA = binomialSample(2 * N, p);
            p = countA / (2 * N);
            q = 1 - p;
        }

        // Clamp to [0, 1] to avoid floating point weirdness
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        q = 1 - p;

        // 5. Non-random mating (affects genotype freq, not allele freq)
        var freqAA, freqAa, freqaa;
        if (cfg.enableAssortativeMating) {
            var F = cfg.assortativeMatingCoeff;
            freqAA = p * p + F * p * q;
            freqAa = 2 * p * q * (1 - F);
            freqaa = q * q + F * p * q;
        } else {
            freqAA = p * p;
            freqAa = 2 * p * q;
            freqaa = q * q;
        }

        this._state.p = p;
        this._state.q = q;
        this._state.freqAA = freqAA;
        this._state.freqAa = freqAa;
        this._state.freqaa = freqaa;
        this._state.N = N;

        this.history.push({
            p: p,
            q: q,
            freqAA: freqAA,
            freqAa: freqAa,
            freqaa: freqaa,
            N: N
        });
    }

    /** Expected HW genotype frequencies from current allele frequencies. */
    getExpected() {
        var p = this._state.p;
        var q = this._state.q;
        return {
            AA: p * p,
            Aa: 2 * p * q,
            aa: q * q
        };
    }

    /** Chi-square statistic comparing observed vs expected genotype frequencies. */
    chiSquare() {
        var exp = this.getExpected();
        var obs = {
            AA: this._state.freqAA,
            Aa: this._state.freqAa,
            aa: this._state.freqaa
        };
        var chi2 = 0;
        var keys = ['AA', 'Aa', 'aa'];
        for (var i = 0; i < keys.length; i++) {
            var e = exp[keys[i]];
            if (e > 0) {
                var diff = obs[keys[i]] - e;
                chi2 += (diff * diff) / e;
            }
        }
        return chi2;
    }

    reset() {
        super.reset();
        var p = this._initialState.p;
        var q = this._initialState.q;
        this.history = [{
            p: p,
            q: q,
            freqAA: p * p,
            freqAa: 2 * p * q,
            freqaa: q * q,
            N: this._initialState.N
        }];
    }
}
