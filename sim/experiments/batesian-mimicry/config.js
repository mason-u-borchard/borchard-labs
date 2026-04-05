/**
 * Batesian Mimicry Simulation -- Configuration & Constants
 *
 * Species data, probability tables, measurement distributions, weather
 * parameters, and rendering colors. Single source of truth for all
 * biological constants used by the simulation.
 *
 * Sources: Howard & Brodie (1973), Petranka (1998), Spicer et al. (2018),
 * Burton & Likens (1975), Ford et al. (2002), Sanchez et al. (2020).
 * See research/ for full citations.
 */


// -------------------------------------------------------------------
// Species data
// -------------------------------------------------------------------

export var SPECIES = {
    NOVI: {
        key: 'NOVI',
        commonName: 'Red-spotted Newt (eft)',
        scientificName: 'Notophthalmus viridescens',
        role: 'model',
        toxic: true,
        family: 'Salamandridae',
        svl:  { mean: 38, sd: 4, min: 28, max: 48 },
        tl:   { mean: 72, sd: 8, min: 55, max: 90 },
        mass: { mean: 1.8, sd: 0.5, min: 0.8, max: 3.0 },
        color: {
            body: '#d4572a',
            bodyRange: [0, 20],       // hue offset range for individual variation
            satRange: [-0.05, 0.10],  // saturation offset
            spots: '#cc2200',
            spotBorder: '#111111',
            belly: '#e8b040',
            eye: '#222222'
        },
        spotPattern: 'bordered-rows',
        skinTexture: 'granular',
        tailShape: 'keeled',
        costalGrooves: 0,
        bodyProportions: { headRatio: 0.22, tailRatio: 0.45 },
        behavior: {
            freezeDuration: [0.5, 1.5],
            speed: 'very-slow',
            response: 'stand-still',
            description: 'Slow, deliberate walk. Toxic -- does not flee.'
        },
        seasonalActivity: [0.02, 0.02, 0.20, 0.80, 0.80, 1.00, 0.60, 0.60, 0.90, 0.90, 0.30, 0.05],
        habitatWeight: { cove: 0.8, mixed: 0.6, stream: 0.5 },
        coverWeight: { rock: 0.7, log: 1.2, bark: 0.5, board: 1.0 },
        idDifficulty: 'moderate'
    },

    PSRU: {
        key: 'PSRU',
        commonName: 'Red Salamander',
        scientificName: 'Pseudotriton ruber',
        role: 'mimic',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 58, sd: 10, min: 35, max: 80 },
        tl:   { mean: 125, sd: 18, min: 80, max: 180 },
        mass: { mean: 5.0, sd: 2.0, min: 1.5, max: 12.0 },
        color: {
            body: '#b83a1f',
            bodyRange: [-10, 15],
            satRange: [-0.10, 0.05],
            spots: '#222222',
            spotBorder: null,
            belly: '#e8a060',
            eye: '#c9a832'          // gold/yellow iris -- key diagnostic
        },
        spotPattern: 'scattered',
        skinTexture: 'smooth',
        tailShape: 'round',
        costalGrooves: 17,
        bodyProportions: { headRatio: 0.16, tailRatio: 0.42 },
        behavior: {
            freezeDuration: [3, 10],
            speed: 'very-slow',
            response: 'coiled-posture',
            description: 'Prolonged freeze. Curls body, raises tail, tucks head.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 0.7, mixed: 0.7, stream: 1.0 },
        coverWeight: { rock: 0.8, log: 1.1, bark: 0.4, board: 1.0 },
        idDifficulty: 'hard'
    },

    PLCI: {
        key: 'PLCI',
        commonName: 'Red-backed Salamander',
        scientificName: 'Plethodon cinereus',
        role: 'background',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 40, sd: 5, min: 28, max: 54 },
        tl:   { mean: 90, sd: 10, min: 65, max: 125 },
        mass: { mean: 1.0, sd: 0.3, min: 0.3, max: 2.0 },
        color: {
            body: '#5c3a28',
            bodyRange: [-5, 5],
            satRange: [-0.05, 0.05],
            stripe: '#b04a2a',        // dorsal stripe (striped morph)
            belly: '#888888',
            bellyPattern: 'salt-pepper',
            eye: '#222222'
        },
        spotPattern: 'none',
        skinTexture: 'smooth',
        tailShape: 'round',
        costalGrooves: 19,
        bodyProportions: { headRatio: 0.18, tailRatio: 0.50 },
        morphs: {
            striped: 0.70,
            leadback: 0.28,
            erythristic: 0.02
        },
        behavior: {
            freezeDuration: [1, 3],
            speed: 'slow',
            response: 'freeze-crawl',
            description: 'Freeze, then slow crawl away. Tail undulation.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 1.0, mixed: 0.9, stream: 0.5 },
        coverWeight: { rock: 1.0, log: 1.1, bark: 0.8, board: 1.0 },
        idDifficulty: 'easy'
    },

    PLGL: {
        key: 'PLGL',
        commonName: 'Slimy Salamander',
        scientificName: 'Plethodon glutinosus',
        role: 'background',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 65, sd: 8, min: 45, max: 85 },
        tl:   { mean: 150, sd: 18, min: 105, max: 195 },
        mass: { mean: 5.5, sd: 1.8, min: 2.5, max: 11.0 },
        color: {
            body: '#1a1a2e',
            bodyRange: [-3, 3],
            satRange: [-0.02, 0.02],
            flecks: '#c0c0c0',
            belly: '#222222',
            eye: '#333333'
        },
        spotPattern: 'flecked',
        skinTexture: 'smooth-sticky',
        tailShape: 'round',
        costalGrooves: 16,
        bodyProportions: { headRatio: 0.17, tailRatio: 0.48 },
        behavior: {
            freezeDuration: [1, 2],
            speed: 'moderate',
            response: 'freeze-crawl',
            description: 'Freeze, moderate crawl. Sticky skin secretion.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 0.9, mixed: 1.0, stream: 0.6 },
        coverWeight: { rock: 1.1, log: 0.9, bark: 1.3, board: 1.0 },
        idDifficulty: 'easy'
    },

    DEFU: {
        key: 'DEFU',
        commonName: 'Northern Dusky Salamander',
        scientificName: 'Desmognathus fuscus',
        role: 'background',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 42, sd: 6, min: 28, max: 58 },
        tl:   { mean: 85, sd: 12, min: 55, max: 115 },
        mass: { mean: 2.5, sd: 1.0, min: 0.8, max: 5.5 },
        color: {
            body: '#6b5b47',
            bodyRange: [-8, 8],
            satRange: [-0.05, 0.05],
            jawLine: '#c8b898',       // pale line from eye to jaw
            belly: '#d4cec4',
            eye: '#333333'
        },
        spotPattern: 'blotched',
        skinTexture: 'smooth',
        tailShape: 'keeled',
        costalGrooves: 14,
        bodyProportions: { headRatio: 0.20, tailRatio: 0.45 },
        behavior: {
            freezeDuration: [0.3, 0.8],
            speed: 'fast',
            response: 'rapid-escape',
            description: 'Brief freeze, then rapid escape. May jump.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 0.6, mixed: 0.6, stream: 1.0 },
        coverWeight: { rock: 1.2, log: 0.8, bark: 0.3, board: 0.7 },
        idDifficulty: 'moderate'
    },

    EUBI: {
        key: 'EUBI',
        commonName: 'Two-lined Salamander',
        scientificName: 'Eurycea bislineata',
        role: 'background',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 37, sd: 4, min: 27, max: 48 },
        tl:   { mean: 80, sd: 9, min: 58, max: 105 },
        mass: { mean: 1.2, sd: 0.4, min: 0.4, max: 2.5 },
        color: {
            body: '#c4a84a',
            bodyRange: [-5, 5],
            satRange: [-0.05, 0.05],
            lines: '#4a3a28',         // dark lateral lines
            belly: '#e8d870',
            eye: '#444444'
        },
        spotPattern: 'lined',
        skinTexture: 'smooth',
        tailShape: 'round',
        costalGrooves: 16,
        bodyProportions: { headRatio: 0.17, tailRatio: 0.52 },
        behavior: {
            freezeDuration: [0.3, 0.8],
            speed: 'fast',
            response: 'rapid-escape',
            description: 'Quick escape toward water. Enters crevices.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 0.5, mixed: 0.5, stream: 1.0 },
        coverWeight: { rock: 1.0, log: 0.7, bark: 0.3, board: 0.5 },
        idDifficulty: 'easy'
    },

    DEMO: {
        key: 'DEMO',
        commonName: 'Seal Salamander',
        scientificName: 'Desmognathus monticola',
        role: 'background',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 55, sd: 7, min: 38, max: 72 },
        tl:   { mean: 115, sd: 14, min: 80, max: 150 },
        mass: { mean: 4.0, sd: 1.5, min: 1.5, max: 8.0 },
        color: {
            body: '#7a6b5a',
            bodyRange: [-5, 5],
            satRange: [-0.03, 0.03],
            belly: '#c8b898',
            eye: '#444444'
        },
        spotPattern: 'reticulated',
        skinTexture: 'smooth',
        tailShape: 'keeled',
        costalGrooves: 14,
        bodyProportions: { headRatio: 0.20, tailRatio: 0.44 },
        behavior: {
            freezeDuration: [0.5, 1.5],
            speed: 'moderate',
            response: 'moderate-escape',
            description: 'Moderate freeze, then retreat. May bite.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 0.5, mixed: 0.5, stream: 1.0 },
        coverWeight: { rock: 1.3, log: 0.7, bark: 0.3, board: 0.6 },
        idDifficulty: 'moderate'
    },

    GYPO: {
        key: 'GYPO',
        commonName: 'Spring Salamander',
        scientificName: 'Gyrinophilus porphyriticus',
        role: 'background',
        toxic: false,
        family: 'Plethodontidae',
        svl:  { mean: 65, sd: 10, min: 40, max: 90 },
        tl:   { mean: 145, sd: 20, min: 90, max: 200 },
        mass: { mean: 6.0, sd: 2.5, min: 2.0, max: 14.0 },
        color: {
            body: '#d4907a',
            bodyRange: [-8, 8],
            satRange: [-0.05, 0.05],
            belly: '#e8c8b0',
            eye: '#555555'
        },
        spotPattern: 'faint-mottled',
        skinTexture: 'smooth',
        tailShape: 'keeled',
        costalGrooves: 18,
        bodyProportions: { headRatio: 0.18, tailRatio: 0.46 },
        behavior: {
            freezeDuration: [1, 3],
            speed: 'moderate',
            response: 'slow-retreat',
            description: 'Slow retreat. Large and sluggish.'
        },
        seasonalActivity: [0.05, 0.08, 0.40, 0.75, 1.00, 0.90, 0.45, 0.40, 0.70, 0.85, 0.50, 0.10],
        habitatWeight: { cove: 0.3, mixed: 0.3, stream: 1.0 },
        coverWeight: { rock: 1.0, log: 0.5, bark: 0.2, board: 0.4 },
        idDifficulty: 'easy'
    }
};


// -------------------------------------------------------------------
// Encounter probabilities
// -------------------------------------------------------------------

/** Base probability of finding a salamander under any cover object */
export var BASE_ENCOUNTER_RATE = 0.30;

/** Max compound probability after all modifiers (prevent unrealistic saturation) */
export var MAX_ENCOUNTER_RATE = 0.75;

/** What's under a cover object when you flip it */
export var COVER_CONTENTS = {
    empty:        0.08,
    invertebrate: 0.52,
    oneSalamander: 0.30,
    twoSalamanders: 0.07,
    threePlus:     0.02,
    snake:         0.008,
    otherHerp:     0.002
};

/** Species weights for encounter generation (sum ~1.0) */
export var SPECIES_WEIGHTS = {
    PLCI: 0.58,
    PLGL: 0.13,
    DEFU: 0.10,
    EUBI: 0.07,
    NOVI: 0.04,
    PSRU: 0.03,
    DEMO: 0.02,
    GYPO: 0.01,
    OTHER: 0.02
};

/** Microhabitat modifiers on species composition (multipliers, renormalize after) */
export var MICROHABITAT_MODS = {
    board:       { PLCI: 1.0, PLGL: 1.0, DEFU: 1.0, EUBI: 1.0, NOVI: 1.0, PSRU: 1.0, DEMO: 1.0, GYPO: 1.0 },
    rock:        { PLCI: 1.0, PLGL: 1.1, DEFU: 0.9, EUBI: 0.8, NOVI: 0.7, PSRU: 0.8, DEMO: 0.9, GYPO: 0.5 },
    log:         { PLCI: 1.1, PLGL: 0.9, DEFU: 0.8, EUBI: 0.7, NOVI: 1.2, PSRU: 1.1, DEMO: 0.7, GYPO: 0.5 },
    bark:        { PLCI: 0.8, PLGL: 1.3, DEFU: 0.3, EUBI: 0.3, NOVI: 0.2, PSRU: 0.3, DEMO: 0.3, GYPO: 0.2 },
    streamRock:  { PLCI: 0.5, PLGL: 0.6, DEFU: 2.5, EUBI: 2.5, NOVI: 0.4, PSRU: 1.8, DEMO: 2.0, GYPO: 1.5 }
};


// -------------------------------------------------------------------
// Seasonal modifiers (index 0 = January)
// -------------------------------------------------------------------

export var SEASONAL_MULTIPLIERS = [
    0.05,  // Jan
    0.08,  // Feb
    0.40,  // Mar
    0.75,  // Apr
    1.00,  // May
    0.90,  // Jun
    0.45,  // Jul
    0.40,  // Aug
    0.70,  // Sep
    0.85,  // Oct
    0.50,  // Nov
    0.10   // Dec
];

/** Red eft has its own activity curve */
export var EFT_SEASONAL_MULTIPLIERS = [
    0.02, 0.02, 0.20, 0.80, 0.80, 1.00, 0.60, 0.60, 0.90, 0.90, 0.30, 0.05
];


// -------------------------------------------------------------------
// Weather
// -------------------------------------------------------------------

/** Monthly temperature normals (Appalachia, VA region) */
export var MONTHLY_TEMPS = [
    { meanHigh:  5, meanLow: -3, surveyMean:  1, sd: 3 },  // Jan
    { meanHigh:  7, meanLow: -2, surveyMean:  3, sd: 3 },  // Feb
    { meanHigh: 13, meanLow:  3, surveyMean:  8, sd: 3 },  // Mar
    { meanHigh: 19, meanLow:  8, surveyMean: 14, sd: 3 },  // Apr
    { meanHigh: 23, meanLow: 12, surveyMean: 17, sd: 3 },  // May
    { meanHigh: 27, meanLow: 16, surveyMean: 21, sd: 3 },  // Jun
    { meanHigh: 28, meanLow: 18, surveyMean: 22, sd: 3 },  // Jul
    { meanHigh: 27, meanLow: 17, surveyMean: 22, sd: 3 },  // Aug
    { meanHigh: 24, meanLow: 14, surveyMean: 18, sd: 3 },  // Sep
    { meanHigh: 19, meanLow:  8, surveyMean: 13, sd: 3 },  // Oct
    { meanHigh: 13, meanLow:  3, surveyMean:  8, sd: 3 },  // Nov
    { meanHigh:  7, meanLow: -1, surveyMean:  3, sd: 3 }   // Dec
];

/** Probability of rain during a 3-hour survey window, by month (index 0 = Jan) */
export var RAIN_PROBABILITY = [
    0.28, 0.28, 0.32, 0.34, 0.40, 0.43, 0.44, 0.36, 0.26, 0.23, 0.26, 0.28
];

/** Probability that rain starts mid-survey (given it wasn't raining at start) */
export var MID_SURVEY_RAIN = [
    0.10, 0.10, 0.12, 0.13, 0.15, 0.16, 0.17, 0.14, 0.10, 0.09, 0.10, 0.10
];

export var WEATHER_STATES = {
    clear:     { label: 'Clear skies',  encounterMod: 0.85 },
    partCloud: { label: 'Partly cloudy', encounterMod: 1.00 },
    overcast:  { label: 'Overcast',     encounterMod: 1.15 },
    fogMist:   { label: 'Fog / mist',   encounterMod: 1.10 },
    lightRain: { label: 'Light rain',   encounterMod: 1.50 },
    heavyRain: { label: 'Heavy rain',   encounterMod: 1.30 }
};

/** Cloud cover probability by season */
export var CLOUD_COVER_PROBS = {
    spring: { clear: 0.20, partCloud: 0.35, overcast: 0.35, fogMist: 0.10 },
    summer: { clear: 0.25, partCloud: 0.35, overcast: 0.25, fogMist: 0.15 },
    fall:   { clear: 0.30, partCloud: 0.35, overcast: 0.25, fogMist: 0.10 }
};

/** Temperature-based encounter modifiers */
export var TEMP_MODIFIERS = [
    { max:  2, mod: 0.15 },
    { max:  5, mod: 0.40 },
    { max:  8, mod: 0.65 },
    { max: 12, mod: 0.90 },
    { max: 16, mod: 1.00 },
    { max: 20, mod: 0.85 },
    { max: 25, mod: 0.60 },
    { max: 30, mod: 0.35 },
    { max: 99, mod: 0.20 }
];

/** Humidity-based encounter modifiers */
export var HUMIDITY_MODIFIERS = [
    { min: 90, mod: 1.25 },
    { min: 80, mod: 1.15 },
    { min: 60, mod: 1.00 },
    { min:  0, mod: 0.75 }
];

/** Precipitation history modifiers */
export var PRECIP_HISTORY = {
    raining:    1.50,
    last24h:    1.40,
    last48h:    1.25,
    dry3:       0.80,
    dry7:       0.55,
    dry14:      0.35
};

/** Time-of-day modifiers for cover object surveys */
export var TIME_MODIFIERS = [
    { start:  5, end:  7, mod: 1.15, label: 'Dawn' },
    { start:  7, end: 10, mod: 1.10, label: 'Morning' },
    { start: 10, end: 13, mod: 0.85, label: 'Midday' },
    { start: 13, end: 16, mod: 0.80, label: 'Afternoon' },
    { start: 16, end: 18, mod: 0.95, label: 'Late afternoon' },
    { start: 18, end: 20, mod: 1.15, label: 'Dusk' }
];

/** Wind modifiers */
export var WIND_MODIFIERS = [
    { max:  5, mod: 1.00, label: 'Calm' },
    { max: 15, mod: 0.95, label: 'Light breeze' },
    { max: 30, mod: 0.90, label: 'Moderate wind' },
    { max: 99, mod: 0.80, label: 'Strong wind' }
];


// -------------------------------------------------------------------
// Cover objects
// -------------------------------------------------------------------

export var COVER_TYPES = ['rock', 'log', 'bark', 'board'];

/** Cover object type weights by habitat */
export var COVER_WEIGHTS = {
    cove:   { rock: 0.25, log: 0.35, bark: 0.25, board: 0.15 },
    mixed:  { rock: 0.30, log: 0.30, bark: 0.20, board: 0.20 },
    stream: { rock: 0.40, log: 0.25, bark: 0.15, board: 0.20 }
};

/** Size ranges for each cover object type (canvas pixels at 1x scale) */
export var COVER_SIZES = {
    rock:  { width: [25, 45], height: [20, 35] },
    log:   { width: [50, 80], height: [15, 25] },
    bark:  { width: [20, 35], height: [15, 25] },
    board: { width: [40, 55], height: [35, 50] }
};


// -------------------------------------------------------------------
// Edge cases and special events
// -------------------------------------------------------------------

/** Per-cover-object event probabilities */
export var OBJECT_EVENTS = {
    eggClutch:    { prob: 0.008, months: [5, 6, 7],        label: 'Egg clutch' },
    copperhead:   { prob: 0.005, months: [3, 4, 5, 6, 7, 8, 9], label: 'Copperhead' },
    ringneck:     { prob: 0.015, months: [2, 3, 4, 5, 6, 7, 8, 9], label: 'Ring-necked snake' },
    predation:    { prob: 0.001, months: null,              label: 'Predation event' },
    deadAnimal:   { prob: 0.005, months: null,              label: 'Dead salamander' }
};

/** Per-survey event probabilities */
export var SURVEY_EVENTS = {
    gpsDies:       { prob: 0.02,  label: 'GPS battery died' },
    cameraFog:     { prob: 0.05,  label: 'Camera lens fogged' },
    animalEscapes: { prob: 0.03,  label: 'Animal escaped before ID' },
    unexpectedSp:  { prob: 0.005, label: 'Unexpected species' }
};

/** Animal health conditions */
export var HEALTH_CONDITIONS = {
    healthy:        0.85,
    regeneratingTail: 0.10,
    oldInjury:      0.03,
    freshInjury:    0.01,
    dead:           0.005,
    abnormality:    0.005
};

/** Multi-animal cover object co-occurrence */
export var COOCCURRENCE = {
    sameSpecies: 0.65,
    diffSpecies: 0.35
};


// -------------------------------------------------------------------
// Morphometric helpers
// -------------------------------------------------------------------

/** P. cinereus morph probabilities */
export var PCIN_MORPHS = {
    striped: 0.70,
    leadback: 0.28,
    erythristic: 0.02
};

/** Relationship between SVL and ID difficulty for mimic/model pair.
 *  Young P. ruber (low SVL) are hardest to distinguish from efts. */
export function getMimicDifficulty(svl) {
    if (svl < 45) return 'very-hard';
    if (svl < 55) return 'hard';
    if (svl < 65) return 'moderate';
    return 'easy';
}

/** Map month (0-indexed) to season string */
export function getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
}


// -------------------------------------------------------------------
// Rendering colors
// -------------------------------------------------------------------

export var COLORS = {
    // Forest floor
    soil:        '#8B7355',
    soilDark:    '#6b4226',
    soilLight:   '#a08868',
    leafGreen:   '#7c9a5e',
    leafBrown:   '#8B6914',
    leafFall:    '#c4713b',
    leafGold:    '#b8860b',
    moss:        '#52b788',
    twig:        '#6b4226',

    // Cover objects
    rockLight:   '#999999',
    rockDark:    '#666666',
    rockShadow:  '#444444',
    logBark:     '#6b4226',
    logRing:     '#8B6914',
    boardWood:   '#c4a87a',
    barkPiece:   '#8a6b42',

    // Water
    water:       '#a8dadc',
    waterDark:   '#457b9d',

    // UI
    transect:    '#bc4749',
    checked:     'rgba(45, 106, 79, 0.3)',
    highlight:   'rgba(184, 134, 11, 0.4)',
    correct:     '#2d6a4f',
    incorrect:   '#bc4749',

    // Seasonal forest floor palettes
    spring: {
        litter: ['#7c9a5e', '#8a7a52', '#6b8a48', '#9a8a62'],
        accent: '#7ec88a'
    },
    summer: {
        litter: ['#4a6b3a', '#5a7a4a', '#6b7548', '#3a5a2a'],
        accent: '#52b788'
    },
    fall: {
        litter: ['#c4713b', '#b8860b', '#a06030', '#d4924a', '#8a5a28'],
        accent: '#d4924a'
    },
    winter: {
        litter: ['#8a7a68', '#7a6a58', '#6a5a48', '#9a8a78'],
        accent: '#999999'
    }
};


// -------------------------------------------------------------------
// Simulation defaults
// -------------------------------------------------------------------

export var DEFAULTS = {
    surveyMonth: 4,          // May (0-indexed)
    surveyDay: 15,
    habitat: 'cove',
    coverObjectCount: 40,
    transectCount: 2,
    idFeedback: 'deferred',
    tutorial: true,
    forcedEncounters: true,
    surveyStartHour: 8       // 8am
};


// -------------------------------------------------------------------
// Field notebook columns
// -------------------------------------------------------------------

export var NOTEBOOK_COLUMNS = [
    'Entry #',
    'Time',
    'Cover Obj #',
    'Obj Type',
    'Species ID',
    'ID Confidence',
    'SVL (mm)',
    'Total Length (mm)',
    'Mass (g)',
    'Sex',
    'Age Class',
    'Substrate Moisture',
    'Air Temp (C)',
    'Notes'
];

export var NOTEBOOK_HIDDEN_COLUMNS = [
    'True Species',
    'ID Correct'
];


// -------------------------------------------------------------------
// ID challenge species groupings
// -------------------------------------------------------------------

/** Which species to show as options based on the animal's color group */
export var ID_OPTIONS = {
    redOrange: ['NOVI', 'PSRU', 'GYPO'],
    dark:      ['PLCI', 'PLGL', 'DEFU', 'EUBI', 'DEMO'],
    yellow:    ['EUBI', 'PLCI'],
    all:       ['NOVI', 'PSRU', 'PLCI', 'PLGL', 'DEFU', 'EUBI', 'DEMO', 'GYPO']
};

/** Map species to their color group for ID challenge */
export var SPECIES_COLOR_GROUP = {
    NOVI: 'redOrange',
    PSRU: 'redOrange',
    GYPO: 'redOrange',
    PLCI: 'dark',
    PLGL: 'dark',
    DEFU: 'dark',
    EUBI: 'yellow',
    DEMO: 'dark'
};


// -------------------------------------------------------------------
// Distinguishing features for ID feedback
// -------------------------------------------------------------------

export var DISTINGUISHING_FEATURES = {
    NOVI: {
        skin: 'Rough, granular texture -- feels like fine sandpaper',
        costalGrooves: 'None (newts lack costal grooves)',
        tail: 'Laterally compressed with slight dorsal keel',
        spots: 'Black-bordered red spots arranged in two dorsolateral rows',
        eye: 'Dark iris',
        body: 'Compact body, relatively large head',
        size: 'Small: 35--85mm total length'
    },
    PSRU: {
        skin: 'Smooth, moist, slightly glossy',
        costalGrooves: '16--18 clearly visible costal grooves',
        tail: 'Round in cross-section, no keel',
        spots: 'Irregular black spots scattered randomly, no border pattern',
        eye: 'Gold/yellow iris with dark horizontal bar',
        body: 'Elongated body, small head relative to body',
        size: 'Large: 110--180mm total length'
    },
    PLCI: {
        skin: 'Smooth',
        stripe: 'Red-orange dorsal stripe (striped morph) or uniformly dark (lead-backed)',
        belly: 'Distinctive salt-and-pepper mottled belly',
        size: 'Small: 65--125mm total length'
    },
    PLGL: {
        skin: 'Glossy black with white/silver flecks',
        secretion: 'Produces thick, sticky skin secretion',
        size: 'Large: 105--175mm total length'
    },
    DEFU: {
        jawLine: 'Pale line from eye to angle of jaw (diagnostic)',
        tail: 'Keeled, triangular cross-section',
        habitat: 'Usually found near streams',
        size: 'Small to medium: 55--115mm total length'
    },
    EUBI: {
        lines: 'Two dark dorsolateral lines bordering a yellow-green dorsal stripe',
        belly: 'Bright yellow-orange underside of tail',
        size: 'Small and slender: 58--105mm total length'
    },
    DEMO: {
        body: 'Robust build with large head',
        pattern: 'Reticulated (net-like) dorsal pattern',
        habitat: 'Stream margins, rocky areas',
        size: 'Medium: 80--150mm total length'
    },
    GYPO: {
        color: 'Salmon-pink to reddish, unlike the bright orange of efts',
        size: 'Large: 90--200mm total length',
        habitat: 'Found near springs and seeps'
    }
};
