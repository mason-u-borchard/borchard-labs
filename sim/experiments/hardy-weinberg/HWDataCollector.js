/**
 * Hardy-Weinberg Data Collector.
 * Records per-generation data: allele frequencies, genotype frequencies,
 * expected HW frequencies, chi-square, and population size.
 */

import { DataCollector } from '../../engine/DataCollector.js';
import { formatNumber } from '../../engine/utils.js';

var COLUMNS = [
    'Generation', 'p', 'q',
    'freq_AA', 'freq_Aa', 'freq_aa',
    'expected_AA', 'expected_Aa', 'expected_aa',
    'chi_square', 'N'
];

export class HWDataCollector extends DataCollector {
    constructor() {
        super({
            columns: COLUMNS,
            experimentName: 'hardy-weinberg'
        });
    }

    /**
     * Record a generation snapshot from the population model.
     * @param {number} generation
     * @param {HWPopulation} population
     */
    recordGeneration(generation, population) {
        var state = population.getAll();
        var expected = population.getExpected();
        var chi2 = population.chiSquare();

        this.record({
            'Generation': generation,
            'p': formatNumber(state.p, 4),
            'q': formatNumber(state.q, 4),
            'freq_AA': formatNumber(state.freqAA, 4),
            'freq_Aa': formatNumber(state.freqAa, 4),
            'freq_aa': formatNumber(state.freqaa, 4),
            'expected_AA': formatNumber(expected.AA, 4),
            'expected_Aa': formatNumber(expected.Aa, 4),
            'expected_aa': formatNumber(expected.aa, 4),
            'chi_square': formatNumber(chi2, 4),
            'N': state.N
        });
    }
}
