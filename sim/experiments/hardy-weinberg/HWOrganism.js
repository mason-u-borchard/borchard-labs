/**
 * Hardy-Weinberg Organism.
 * Extends Agent. In this simulation, organisms are tracked at the population
 * level via allele frequencies rather than as individual instances, so this
 * class is intentionally minimal. It exists as part of the engine architecture
 * and may be used by future extensions that model individual organisms.
 */

import { Agent } from '../../engine/Agent.js';

export class HWOrganism extends Agent {
    /**
     * @param {Object} traits - Expected keys: genotype ('AA', 'Aa', or 'aa')
     */
    constructor(traits) {
        super(traits);
    }
}
