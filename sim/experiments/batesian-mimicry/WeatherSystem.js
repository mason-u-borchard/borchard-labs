/**
 * Weather System -- Batesian Mimicry Field Simulation
 *
 * Generates realistic survey-day weather from monthly normals and
 * seasonal cloud cover distributions. Provides encounter probability
 * modifiers based on temperature, humidity, precipitation history,
 * cloud cover, and wind speed.
 *
 * Weather references: NOAA Climate Normals (Appalachian VA region),
 * Burton & Likens (1975) for precipitation-activity relationships.
 */

import {
    MONTHLY_TEMPS,
    RAIN_PROBABILITY,
    MID_SURVEY_RAIN,
    WEATHER_STATES,
    CLOUD_COVER_PROBS,
    TEMP_MODIFIERS,
    HUMIDITY_MODIFIERS,
    PRECIP_HISTORY,
    WIND_MODIFIERS,
    getSeason
} from './config.js';

import {
    gaussianRandom,
    randomFloat,
    weightedChoice
} from '../../engine/utils.js';


export class WeatherSystem {

    constructor(month, day) {
        this.month = month;
        this.day = day;
        this.season = getSeason(month);
        this.elapsedMinutes = 0;

        this.generate();
    }

    /**
     * Roll initial weather conditions from the date.
     * Called once by the constructor.
     */
    generate() {
        var temps = MONTHLY_TEMPS[this.month];

        // Temperature from monthly survey-mean distribution
        this.temperature = gaussianRandom(temps.surveyMean, temps.sd);
        this.temperature = Math.round(this.temperature * 10) / 10;

        // Clamp to something physically reasonable for the month
        var floor = temps.meanLow - 4;
        var ceil  = temps.meanHigh + 4;
        if (this.temperature < floor) this.temperature = floor;
        if (this.temperature > ceil)  this.temperature = ceil;

        // Decide if it's raining at survey start
        this.isRaining = Math.random() < RAIN_PROBABILITY[this.month];

        // Days since last rain (used for precip history modifier).
        // If it's raining now, daysSinceRain = 0.
        // Otherwise roll something plausible for the month.
        if (this.isRaining) {
            this.daysSinceRain = 0;
            this.rainedRecently = true;
        } else {
            // Wetter months skew toward recent rain
            var rainProb = RAIN_PROBABILITY[this.month];
            var dryStretch = Math.floor(randomFloat(0, 14) * (1 - rainProb));
            this.daysSinceRain = Math.max(1, dryStretch);
            this.rainedRecently = this.daysSinceRain <= 2;
        }

        // Cloud cover / weather state
        this._rollWeatherState();

        // Humidity
        this._rollHumidity();

        // Wind speed (km/h)
        this.windSpeed = Math.round(randomFloat(0, 25) * 10) / 10;

        // If raining, nudge conditions
        if (this.isRaining) {
            this.temperature -= randomFloat(1, 3);
            this.temperature = Math.round(this.temperature * 10) / 10;
            if (this.windSpeed < 3) this.windSpeed = randomFloat(3, 8);
        }
    }

    /**
     * Pick a weather state from the seasonal cloud cover distribution,
     * folding in rain probability when applicable.
     */
    _rollWeatherState() {
        if (this.isRaining) {
            // Split between light and heavy rain
            this.weather = Math.random() < 0.7 ? 'lightRain' : 'heavyRain';
            this.cloudCover = randomFloat(85, 100);
        } else {
            // Use seasonal cloud cover probs
            var probs = CLOUD_COVER_PROBS[this.season]
                || CLOUD_COVER_PROBS.spring; // winter fallback

            var states  = Object.keys(probs);
            var weights = states.map(function(s) { return probs[s]; });
            this.weather = weightedChoice(states, weights);

            // Derive cloud cover % from the state
            var coverRanges = {
                clear:     [0, 20],
                partCloud: [25, 55],
                overcast:  [70, 95],
                fogMist:   [80, 100]
            };
            var range = coverRanges[this.weather] || [30, 60];
            this.cloudCover = randomFloat(range[0], range[1]);
        }

        this.cloudCover = Math.round(this.cloudCover);
    }

    /**
     * Set humidity based on weather state and precipitation history.
     * Range: roughly 45--95%.
     */
    _rollHumidity() {
        var base, spread;

        if (this.isRaining) {
            base = 90;
            spread = 5;
        } else if (this.rainedRecently) {
            base = 85;
            spread = 10;
        } else if (this.weather === 'overcast' || this.weather === 'fogMist') {
            base = 75;
            spread = 10;
        } else if (this.temperature > 24) {
            // Hot dry day
            base = 55;
            spread = 10;
        } else {
            base = 68;
            spread = 12;
        }

        this.humidity = Math.round(randomFloat(base - spread, base + spread));
        if (this.humidity < 40) this.humidity = 40;
        if (this.humidity > 99) this.humidity = 99;
    }

    /**
     * Return a snapshot of current conditions.
     */
    getCurrentConditions() {
        return {
            weather:        this.weather,
            weatherLabel:   WEATHER_STATES[this.weather].label,
            temperature:    this.temperature,
            humidity:       this.humidity,
            windSpeed:      this.windSpeed,
            cloudCover:     this.cloudCover,
            isRaining:      this.isRaining,
            rainedRecently: this.rainedRecently,
            daysSinceRain:  this.daysSinceRain
        };
    }

    /**
     * Advance the weather by some number of elapsed minutes.
     * Applies small temperature drift and a chance of rain starting
     * or stopping mid-survey.
     */
    update(elapsedMinutes) {
        this.elapsedMinutes += elapsedMinutes;

        // Temperature drift: ~1.5 deg/hour via gaussian noise
        var hours = elapsedMinutes / 60;
        var drift = gaussianRandom(0, 1.5 * hours);
        this.temperature += drift;
        this.temperature = Math.round(this.temperature * 10) / 10;

        // Keep temperature sane
        var temps = MONTHLY_TEMPS[this.month];
        if (this.temperature < temps.meanLow - 5) {
            this.temperature = temps.meanLow - 5;
        }
        if (this.temperature > temps.meanHigh + 5) {
            this.temperature = temps.meanHigh + 5;
        }

        // Mid-survey rain transitions
        var midProb = MID_SURVEY_RAIN[this.month];
        // Scale probability by time chunk (the table values assume ~3hr survey)
        var chunkProb = midProb * (elapsedMinutes / 180);

        if (!this.isRaining) {
            // Chance rain starts
            if (Math.random() < chunkProb) {
                this.isRaining = true;
                this.daysSinceRain = 0;
                this.rainedRecently = true;
                this.weather = Math.random() < 0.75 ? 'lightRain' : 'heavyRain';
                this.cloudCover = Math.round(randomFloat(85, 100));
                this.humidity = Math.round(randomFloat(85, 95));
                this.temperature -= randomFloat(0.5, 1.5);
                this.temperature = Math.round(this.temperature * 10) / 10;
            }
        } else {
            // Chance rain stops (slightly higher probability than starting)
            if (Math.random() < chunkProb * 1.3) {
                this.isRaining = false;
                this.rainedRecently = true;
                this.weather = 'overcast';
                this.cloudCover = Math.round(randomFloat(70, 95));
                // Humidity stays high after rain
                this.humidity = Math.round(randomFloat(82, 95));
            }
        }

        // Slow humidity drift toward equilibrium
        if (!this.isRaining && this.humidity > 80 && !this.rainedRecently) {
            this.humidity -= Math.round(randomFloat(0, 2));
        }
    }

    /**
     * Compute the compound encounter modifier from current conditions.
     * Multiplies applicable temperature, humidity, precipitation,
     * cloud/weather state, and wind modifiers together.
     */
    getEncounterModifier() {
        var mod = 1.0;

        // Weather state modifier
        var stateInfo = WEATHER_STATES[this.weather];
        if (stateInfo) {
            mod *= stateInfo.encounterMod;
        }

        // Temperature modifier
        for (var i = 0; i < TEMP_MODIFIERS.length; i++) {
            if (this.temperature <= TEMP_MODIFIERS[i].max) {
                mod *= TEMP_MODIFIERS[i].mod;
                break;
            }
        }

        // Humidity modifier
        for (var i = 0; i < HUMIDITY_MODIFIERS.length; i++) {
            if (this.humidity >= HUMIDITY_MODIFIERS[i].min) {
                mod *= HUMIDITY_MODIFIERS[i].mod;
                break;
            }
        }

        // Precipitation history modifier
        if (this.isRaining) {
            mod *= PRECIP_HISTORY.raining;
        } else if (this.daysSinceRain <= 1) {
            mod *= PRECIP_HISTORY.last24h;
        } else if (this.daysSinceRain <= 2) {
            mod *= PRECIP_HISTORY.last48h;
        } else if (this.daysSinceRain <= 6) {
            mod *= PRECIP_HISTORY.dry3;
        } else if (this.daysSinceRain <= 13) {
            mod *= PRECIP_HISTORY.dry7;
        } else {
            mod *= PRECIP_HISTORY.dry14;
        }

        // Wind modifier
        for (var i = 0; i < WIND_MODIFIERS.length; i++) {
            if (this.windSpeed <= WIND_MODIFIERS[i].max) {
                mod *= WIND_MODIFIERS[i].mod;
                break;
            }
        }

        return mod;
    }

    /**
     * Human-readable summary of current conditions.
     * e.g. "Overcast, 14.2C, 82% humidity, light breeze"
     */
    getDescription() {
        var label = WEATHER_STATES[this.weather].label;
        var temp  = this.temperature + '\u00B0C';
        var hum   = this.humidity + '% humidity';

        // Wind description from the WIND_MODIFIERS table
        var windLabel = 'calm';
        for (var i = 0; i < WIND_MODIFIERS.length; i++) {
            if (this.windSpeed <= WIND_MODIFIERS[i].max) {
                windLabel = WIND_MODIFIERS[i].label.toLowerCase();
                break;
            }
        }

        return label + ', ' + temp + ', ' + hum + ', ' + windLabel;
    }
}
