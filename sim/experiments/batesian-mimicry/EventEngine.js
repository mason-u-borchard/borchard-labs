/**
 * EventEngine -- Batesian Mimicry Field Simulation
 *
 * Determines what lives under each cover object when the player flips it.
 * Handles encounter generation, species selection, special events, forced
 * encounters for learning mode, and encounter history tracking.
 *
 * Species probabilities are modulated by season, weather, microhabitat,
 * and cover object quality. Multi-animal encounters use co-occurrence
 * rules from the empirical literature.
 */

import {
    SPECIES,
    SPECIES_WEIGHTS,
    BASE_ENCOUNTER_RATE,
    MAX_ENCOUNTER_RATE,
    COVER_CONTENTS,
    MICROHABITAT_MODS,
    SEASONAL_MULTIPLIERS,
    EFT_SEASONAL_MULTIPLIERS,
    OBJECT_EVENTS,
    SURVEY_EVENTS,
    HEALTH_CONDITIONS,
    COOCCURRENCE,
    getSeason
} from './config.js';

import {
    randomFloat,
    randomInt,
    weightedChoice,
    clamp
} from '../../engine/utils.js';


// Flavor text pools for invertebrate finds
var INVERT_DESCRIPTIONS = [
    'Several earthworms and a millipede',
    'A cluster of beetles and a centipede',
    'Slugs and pill bugs',
    'Ants and a large spider',
    'Nothing but damp soil and leaf litter',
    'A few sowbugs and a ground beetle',
    'Earthworms in moist soil',
    'A millipede curled among leaf fragments',
    'Pill bugs and a harvestman',
    'Small beetles and springtails',
    'A wolf spider and some earwigs',
    'Worms, grubs, and decaying leaves',
    'A large centipede and scattered ants',
    'Slugs tucked against the damp underside'
];


export class EventEngine {

    constructor(config, weatherSystem) {
        // Coerce numeric config values -- select inputs return strings
        this.config = Object.assign({}, config, {
            surveyMonth: parseInt(config.surveyMonth, 10) || 4,
            coverObjectCount: parseInt(config.coverObjectCount, 10) || 40,
            transectCount: parseInt(config.transectCount, 10) || 2
        });
        this.weather = weatherSystem;

        this.encounterHistory = [];
        this.forcedMimic = false;
        this.forcedModel = false;
        this.objectsFlipped = 0;
        this.totalObjects = config.coverObjectCount * config.transectCount;
        this.surveyEventsTriggered = {};
    }

    // ------------------------------------------------------------------
    // Main encounter generation
    // ------------------------------------------------------------------

    /**
     * Generate an encounter result for a flipped cover object.
     * Returns { type, speciesKeys, description, event }.
     * The caller creates Salamander instances from speciesKeys.
     */
    generateEncounter(coverObject) {
        this.objectsFlipped++;

        var result = {
            type: 'empty',
            speciesKeys: [],
            description: '',
            event: null
        };

        // -- Forced encounters for learning mode --
        if (this._shouldForceEncounter()) {
            return this._buildForcedEncounter(coverObject);
        }

        // -- Per-object special events --
        var specialEvent = this._rollObjectEvent();
        if (specialEvent) {
            result.type = specialEvent.type;
            result.description = specialEvent.label;
            result.event = specialEvent;
            this._record(result);
            return result;
        }

        // -- Roll cover contents --
        var contentKeys = Object.keys(COVER_CONTENTS);
        var contentWeights = contentKeys.map(function(k) { return COVER_CONTENTS[k]; });
        var content = weightedChoice(contentKeys, contentWeights);

        // For salamander-bearing outcomes, apply compound probability check
        if (content === 'oneSalamander' || content === 'twoSalamanders' || content === 'threePlus') {
            var salamanderProb = this._getSalamanderProbability(coverObject);

            if (Math.random() > salamanderProb) {
                // Failed the probability check -- downgrade to invertebrate
                content = 'invertebrate';
            }
        }

        switch (content) {
            case 'empty':
                result.type = 'empty';
                result.description = 'Nothing here -- bare soil.';
                break;

            case 'invertebrate':
                result.type = 'invertebrate';
                result.description = this.generateInvertebrateDescription();
                break;

            case 'oneSalamander':
                result.type = 'salamander';
                result.speciesKeys = [this._pickSpecies(coverObject)];
                break;

            case 'twoSalamanders':
                result.type = 'salamander';
                result.speciesKeys = this._pickMultiSpecies(2, coverObject);
                break;

            case 'threePlus':
                result.type = 'salamander';
                var count = randomInt(3, 4);
                result.speciesKeys = this._pickMultiSpecies(count, coverObject);
                break;

            case 'snake':
                result.type = 'snake';
                result.description = 'A small ring-necked snake slithers away.';
                break;

            case 'otherHerp':
                result.type = 'otherHerp';
                result.description = 'A five-lined skink darts off the rock.';
                break;
        }

        this._record(result);
        return result;
    }

    // ------------------------------------------------------------------
    // Species weight calculation
    // ------------------------------------------------------------------

    /**
     * Get adjusted species weights for this cover object type and month.
     * Returns { keys: [...], weights: [...] } for use with weightedChoice.
     */
    getSpeciesWeights(coverObjectType, month) {
        var baseKeys = Object.keys(SPECIES_WEIGHTS);
        var adjusted = {};

        // Start with base weights
        for (var i = 0; i < baseKeys.length; i++) {
            adjusted[baseKeys[i]] = SPECIES_WEIGHTS[baseKeys[i]];
        }

        // Apply microhabitat modifiers
        var microMods = MICROHABITAT_MODS[coverObjectType] || MICROHABITAT_MODS['board'];
        for (var key in microMods) {
            if (adjusted[key] !== undefined) {
                adjusted[key] *= microMods[key];
            }
        }

        // For NOVI (eft): apply the eft seasonal curve relative to
        // the general seasonal multiplier so efts track their own
        // phenology rather than just the global one.
        if (adjusted['NOVI'] !== undefined && month !== undefined) {
            var generalSeasonal = SEASONAL_MULTIPLIERS[month] || 1.0;
            var eftSeasonal = EFT_SEASONAL_MULTIPLIERS[month] || 0.0;

            // Avoid dividing by zero in dead-of-winter edge case
            if (generalSeasonal > 0.01) {
                adjusted['NOVI'] *= (eftSeasonal / generalSeasonal);
            } else {
                adjusted['NOVI'] *= eftSeasonal;
            }
        }

        // Renormalize to sum to 1.0
        var keys = Object.keys(adjusted);
        var total = 0;
        for (var i = 0; i < keys.length; i++) {
            total += adjusted[keys[i]];
        }

        var weights = [];
        for (var i = 0; i < keys.length; i++) {
            weights.push(total > 0 ? adjusted[keys[i]] / total : 0);
        }

        return { keys: keys, weights: weights };
    }

    // ------------------------------------------------------------------
    // Survey-level events
    // ------------------------------------------------------------------

    /**
     * Roll for a per-survey special event (GPS dying, camera fog, etc.).
     * Each event fires at most once per survey.
     */
    checkSurveyEvent() {
        var eventKeys = Object.keys(SURVEY_EVENTS);

        for (var i = 0; i < eventKeys.length; i++) {
            var key = eventKeys[i];

            if (this.surveyEventsTriggered[key]) continue;

            var evt = SURVEY_EVENTS[key];
            if (Math.random() < evt.prob) {
                this.surveyEventsTriggered[key] = true;
                return {
                    key: key,
                    label: evt.label,
                    prob: evt.prob
                };
            }
        }

        return null;
    }

    // ------------------------------------------------------------------
    // History and stats
    // ------------------------------------------------------------------

    getEncounterHistory() {
        return this.encounterHistory;
    }

    /**
     * Species key -> number of individuals encountered.
     */
    getSpeciesCounts() {
        var counts = {};

        for (var i = 0; i < this.encounterHistory.length; i++) {
            var entry = this.encounterHistory[i];
            if (!entry.speciesKeys) continue;

            for (var j = 0; j < entry.speciesKeys.length; j++) {
                var sp = entry.speciesKeys[j];
                counts[sp] = (counts[sp] || 0) + 1;
            }
        }

        return counts;
    }

    /**
     * Summarize mimic vs. model encounters.
     */
    getMimicModelRatio() {
        var counts = this.getSpeciesCounts();
        var mimics = counts['PSRU'] || 0;
        var models = counts['NOVI'] || 0;

        var ratio;
        if (models === 0 && mimics === 0) {
            ratio = 'no encounters';
        } else if (models === 0) {
            ratio = mimics + ':0';
        } else {
            ratio = mimics + ':' + models;
        }

        return {
            mimics: mimics,
            models: models,
            ratio: ratio
        };
    }

    /**
     * Random flavor text for invertebrate finds.
     */
    generateInvertebrateDescription() {
        return INVERT_DESCRIPTIONS[randomInt(0, INVERT_DESCRIPTIONS.length - 1)];
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Compute the effective salamander encounter probability after
     * seasonal, weather, and cover quality modifiers.
     */
    _getSalamanderProbability(coverObject) {
        var month = this.config.surveyMonth;
        var prob = BASE_ENCOUNTER_RATE;

        // Seasonal modifier
        var seasonal = SEASONAL_MULTIPLIERS[month];
        if (seasonal !== undefined) {
            prob *= seasonal;
        }

        // Weather modifier from the WeatherSystem
        prob *= this.weather.getEncounterModifier();

        // Cover object quality (property set by the cover object generator)
        if (coverObject && coverObject.qualityScore !== undefined) {
            prob *= coverObject.qualityScore;
        }

        return clamp(prob, 0, MAX_ENCOUNTER_RATE);
    }

    /**
     * Pick a single species key using adjusted weights.
     */
    _pickSpecies(coverObject) {
        var coverType = (coverObject && coverObject.type) || 'board';
        var sw = this.getSpeciesWeights(coverType, this.config.surveyMonth);
        return weightedChoice(sw.keys, sw.weights);
    }

    /**
     * Pick multiple species keys, applying co-occurrence rules.
     * Returns array of species keys.
     */
    _pickMultiSpecies(count, coverObject) {
        var keys = [];
        var first = this._pickSpecies(coverObject);
        keys.push(first);

        for (var i = 1; i < count; i++) {
            var useSame = Math.random() < COOCCURRENCE.sameSpecies;

            if (useSame) {
                keys.push(first);
            } else {
                keys.push(this._pickSpecies(coverObject));
            }
        }

        return keys;
    }

    /**
     * Should we force a mimic or model encounter?
     * Triggers after 60% of objects if the target species hasn't appeared.
     */
    _shouldForceEncounter() {
        if (!this.config.forcedEncounters) return false;

        var threshold = Math.floor(this.totalObjects * 0.6);
        if (this.objectsFlipped < threshold) return false;

        // Check if we still need either species
        var counts = this.getSpeciesCounts();
        var needModel = !this.forcedModel && !(counts['NOVI'] > 0);
        var needMimic = !this.forcedMimic && !(counts['PSRU'] > 0);

        return needModel || needMimic;
    }

    /**
     * Build a forced encounter result. Prioritizes model (NOVI) first,
     * then mimic (PSRU) on a subsequent flip.
     */
    _buildForcedEncounter(coverObject) {
        var counts = this.getSpeciesCounts();
        var speciesKey;

        if (!this.forcedModel && !(counts['NOVI'] > 0)) {
            speciesKey = 'NOVI';
            this.forcedModel = true;
        } else if (!this.forcedMimic && !(counts['PSRU'] > 0)) {
            speciesKey = 'PSRU';
            this.forcedMimic = true;
        } else {
            // Both already forced -- fall back to a normal invertebrate result
            var fallback = { type: 'invertebrate', speciesKeys: [], description: this.generateInvertebrateDescription(), event: null };
            this._record(fallback);
            return fallback;
        }

        var result = {
            type: 'salamander',
            speciesKeys: [speciesKey],
            description: '',
            event: null
        };

        this._record(result);
        return result;
    }

    /**
     * Roll for per-object special events (egg clutch, copperhead, etc.).
     * Returns an event object or null.
     */
    _rollObjectEvent() {
        var month = this.config.surveyMonth;
        var eventKeys = Object.keys(OBJECT_EVENTS);

        for (var i = 0; i < eventKeys.length; i++) {
            var key = eventKeys[i];
            var evt = OBJECT_EVENTS[key];

            // Check month restriction
            if (evt.months !== null && evt.months.indexOf(month) === -1) {
                continue;
            }

            if (Math.random() < evt.prob) {
                // Map certain events to encounter types
                var type;
                if (key === 'eggClutch') {
                    type = 'eggClutch';
                } else if (key === 'copperhead' || key === 'ringneck') {
                    type = 'snake';
                } else if (key === 'predation') {
                    type = 'predation';
                } else {
                    type = 'otherHerp';
                }

                return {
                    key: key,
                    type: type,
                    label: evt.label,
                    month: month
                };
            }
        }

        return null;
    }

    /**
     * Append an encounter to the history log.
     */
    _record(result) {
        this.encounterHistory.push({
            objectIndex: this.objectsFlipped,
            type: result.type,
            speciesKeys: result.speciesKeys || [],
            description: result.description || '',
            event: result.event || null
        });
    }
}
