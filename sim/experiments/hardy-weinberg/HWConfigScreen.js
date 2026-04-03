/**
 * Hardy-Weinberg Config Screen.
 * Parameter setup for the HW equilibrium simulation.
 */

import { ConfigScreen } from '../../engine/ConfigScreen.js';
import { DEFAULTS } from './config.js';

export class HWConfigScreen extends ConfigScreen {
    getParams() {
        return [
            // -- Core parameters --
            {
                key: 'populationSize',
                label: 'Population size',
                type: 'number',
                default: DEFAULTS.populationSize,
                min: 10, max: 10000, step: 10,
                description: 'Number of diploid individuals in the population'
            },
            {
                key: 'initialP',
                label: 'Initial p (freq of A)',
                type: 'range',
                default: DEFAULTS.initialP,
                min: 0.01, max: 0.99, step: 0.01,
                description: 'Starting frequency of allele A'
            },
            {
                key: 'generations',
                label: 'Generations to run',
                type: 'number',
                default: DEFAULTS.generations,
                min: 10, max: 1000, step: 10,
                description: 'Simulation stops after this many generations'
            },

            // -- Drift --
            {
                key: 'enableDrift',
                label: 'Enable genetic drift',
                type: 'checkbox',
                default: DEFAULTS.enableDrift,
                description: 'Simulate finite population sampling. Disable for deterministic (infinite population) math.'
            },

            // -- Mutation --
            {
                key: 'enableMutation',
                label: 'Enable mutation',
                type: 'checkbox',
                default: DEFAULTS.enableMutation
            },
            {
                key: 'mutationForward',
                label: 'Mutation rate A \u2192 a',
                type: 'range',
                default: DEFAULTS.mutationForward,
                min: 0.0001, max: 0.01, step: 0.0001,
                dependsOn: 'enableMutation',
                description: 'Forward mutation rate per generation'
            },
            {
                key: 'mutationReverse',
                label: 'Mutation rate a \u2192 A',
                type: 'range',
                default: DEFAULTS.mutationReverse,
                min: 0.0001, max: 0.01, step: 0.0001,
                dependsOn: 'enableMutation',
                description: 'Reverse mutation rate per generation'
            },

            // -- Selection --
            {
                key: 'enableSelection',
                label: 'Enable selection',
                type: 'checkbox',
                default: DEFAULTS.enableSelection
            },
            {
                key: 'fitnessAA',
                label: 'Fitness of AA',
                type: 'range',
                default: DEFAULTS.fitnessAA,
                min: 0, max: 1, step: 0.05,
                dependsOn: 'enableSelection',
                description: 'Relative fitness of genotype AA'
            },
            {
                key: 'fitnessAa',
                label: 'Fitness of Aa',
                type: 'range',
                default: DEFAULTS.fitnessAa,
                min: 0, max: 1, step: 0.05,
                dependsOn: 'enableSelection',
                description: 'Relative fitness of genotype Aa'
            },
            {
                key: 'fitnessaa',
                label: 'Fitness of aa',
                type: 'range',
                default: DEFAULTS.fitnessaa,
                min: 0, max: 1, step: 0.05,
                dependsOn: 'enableSelection',
                description: 'Relative fitness of genotype aa'
            },

            // -- Migration --
            {
                key: 'enableMigration',
                label: 'Enable migration',
                type: 'checkbox',
                default: DEFAULTS.enableMigration
            },
            {
                key: 'migrationRate',
                label: 'Migration rate',
                type: 'range',
                default: DEFAULTS.migrationRate,
                min: 0.001, max: 0.1, step: 0.001,
                dependsOn: 'enableMigration',
                description: 'Fraction of population replaced by migrants each generation'
            },
            {
                key: 'migrantP',
                label: 'Migrant allele freq (p)',
                type: 'range',
                default: DEFAULTS.migrantP,
                min: 0.01, max: 0.99, step: 0.01,
                dependsOn: 'enableMigration',
                description: 'Frequency of allele A in the migrant pool'
            },

            // -- Non-random mating --
            {
                key: 'enableAssortativeMating',
                label: 'Enable assortative mating',
                type: 'checkbox',
                default: DEFAULTS.enableAssortativeMating
            },
            {
                key: 'assortativeMatingCoeff',
                label: 'Assortative mating coefficient (F)',
                type: 'range',
                default: DEFAULTS.assortativeMatingCoeff,
                min: 0, max: 1, step: 0.05,
                dependsOn: 'enableAssortativeMating',
                description: '0 = random mating, 1 = fully assortative'
            }
        ];
    }
}
