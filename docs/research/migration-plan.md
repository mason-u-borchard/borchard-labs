# Borchard Labs -- Migration Plan: Hardy-Weinberg & Batesian Mimicry

**Phase 0, Agent 7 -- Borchard Labs Game Engine Overhaul**
**Date:** 2026-04-28
**Status:** Recommendation, not yet ratified

## Executive Summary

The deterministic core of both experiments is preserved: Hardy-Weinberg's allele-frequency math (selection, mutation, migration, drift, non-random mating, chi-square) and Batesian Mimicry's full encounter-event pipeline (config tables, EventEngine, WeatherSystem, FieldNotebook persistence, AnalysisPanel statistics, and the eleven research documents) are ported as pure TypeScript modules with no behavioral change. Every Canvas 2D draw routine, hand-rolled HUD, hand-rolled config screen, and hand-rolled view manager is discarded. The visual layer is rebuilt on Three.js + React Three Fiber + drei + Rapier under Vite + Zustand + localforage. CSV outputs reproduce byte-for-byte for fixed seeds via a snapshot harness running the original logic and the ported logic against the same `Math.random` shim. Net effect: deterministic core preserved, visual layer rebuilt.

---

## 1. Public API of Each Existing Experiment

### 1.1 Engine Base Classes (parent contracts)

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/Simulation.js`
- State machine: `setup` -> `running` -> `paused` -> `complete`. Set at lines 17, 274, 315-319.
- Lifecycle methods: `init()` line 101, `start()` line 125, `pause()` line 135, `resume()` line 147, `step()` line 158, `reset()` line 175, `destroy()` line 196.
- Override hooks: `tick()` line 220, `render()` line 235.
- Event emitter: `on/off/emit` lines 66-91. Emitted events: `tick` (with tickCount), `stateChange` (`{from,to}`), `complete` (`{tickCount}`), `reset`.
- Speed: `setSpeed(multiplier)` line 258, clamped 0.5..5.
- Loop: line 273, runs at `tickRate * speed` ticks/sec via `requestAnimationFrame`.
- Public properties consumed by subclasses: `canvas`, `ctx`, `tickCount`, `maxTicks`, `tickRate`, `speed`, `environment`, `agents`.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/Environment.js`
- `get(key)` line 26, `set(key,value)` line 35, `getAll()` line 43, `update(tick)` line 53, `render(ctx,w,h)` line 62, `reset()` line 68.
- Holds `_state` and `_initialState` (line 17).

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/Agent.js`
- Auto-incrementing `id` (line 16), `traits` object, `alive` flag, `update(tick,env)` line 28, `render(ctx)` line 34, `getTrait/setTrait` lines 41/50, static `Agent.resetIds()` line 56.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/DataCollector.js`
- `record(rowData)` line 33, `getTable()` line 47, `toCSV()` line 57 (RFC 4180 compliant, CRLF line endings), `download(filename?)` line 79, `clear()` line 109, `mount(container)` line 124, `destroy()` line 205.
- CSV escaping helper line 255 (quote on `,` `"` `\n` `\r`, internal quotes doubled).

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/HUD.js`
- `mount(container)` line 35, `setStats(obj)` line 156, `update()` line 147, `destroy()` line 181.
- Subscribes to `stateChange`, `tick`, `reset` from the Simulation (lines 139-141).

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/ConfigScreen.js`
- `getParams()` line 27 (override). Returns `{key,label,type,default,min?,max?,step?,options?,description?,dependsOn?}[]`.
- `mount(container)` line 35, `getValues()` line 95, `destroy()` line 102. Constructor takes `{onStart}` callback (line 16).

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/engine/utils.js`
- `randomFloat`, `randomInt`, `clamp`, `shuffle`, `weightedChoice`, `gaussianRandom` (Box-Muller), `formatNumber`, `binomialSample` (direct Bernoulli, no normal approximation -- line 100, this is load-bearing for drift determinism).

### 1.2 Hardy-Weinberg Public API

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/hardy-weinberg/config.js`
- `DEFAULTS` (lines 5-27): populationSize 500, initialP 0.5, generations 100, plus all five force toggles and parameters.
- `COLORS` (lines 29-34): AA=`#2d6a4f`, Aa=`#457b9d`, aa=`#b8860b`, expected=`#888`.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/hardy-weinberg/HWPopulation.js`
- Constructor (line 18) builds initial state `{p, q, freqAA, freqAa, freqaa, N}` and seeds `history` array with generation-0 snapshot (lines 36-43).
- `update(tick)` line 50: applies forces in fixed order -- selection (57-66), mutation (69-74), migration (77-82), drift via `binomialSample` (85-89), allele clamp (92-94), non-random mating affecting genotype only (97-107). State is overwritten at lines 109-114. `history.push(...)` at lines 116-123.
- `getExpected()` line 127, `chiSquare()` line 138 (sum of `(obs-exp)^2/exp` across AA/Aa/aa), `reset()` line 157.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/hardy-weinberg/HWDataCollector.js`
- Columns (lines 10-15): `Generation, p, q, freq_AA, freq_Aa, freq_aa, expected_AA, expected_Aa, expected_aa, chi_square, N`.
- `recordGeneration(generation, population)` line 30. All numeric values pass through `formatNumber(_, 4)` except `Generation` and `N` (integer).

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/hardy-weinberg/HardyWeinbergSim.js`
- `init()` line 24: builds population, mounts data collector, mounts HUD, records generation 0.
- `tick()` line 47: `environment.update(tickCount)` then `recordGeneration(tickCount, environment)` then `_updateHUDStats()`.
- `render()` line 53: stacked area chart (lines 124-192) plus expected lines (194-231), axes, legend, proportion bar -- this is throwaway code.
- HUD stats (lines 94-104): `p (A)`, `q (a)`, `AA`, `Aa`, `aa`, `chi^2` formatted to 4 decimals.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/hardy-weinberg/HWConfigScreen.js`
- `getParams()` line 10: 16 parameters with `dependsOn` chains for selection/mutation/migration/assortative-mating sub-params.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/hardy-weinberg/HWOrganism.js`
- Stub class (lines 11-18). Currently unused; population works at frequency level.

### 1.3 Batesian Mimicry Public API

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/config.js`
- `SPECIES` map (lines 18-304): 8 species (NOVI, PSRU, PLCI, PLGL, DEFU, EUBI, DEMO, GYPO) with morphometric distributions (svl/tl/mass means/sd/min/max), color tokens, spotPattern, skinTexture, tailShape, costalGrooves, bodyProportions, behavior block, monthly seasonalActivity[12], habitatWeight, coverWeight, idDifficulty.
- `BASE_ENCOUNTER_RATE` 0.30 (line 312), `MAX_ENCOUNTER_RATE` 0.75 (line 315).
- `COVER_CONTENTS` (lines 318-326): empty 0.08, invertebrate 0.52, oneSalamander 0.30, twoSalamanders 0.07, threePlus 0.02, snake 0.008, otherHerp 0.002.
- `SPECIES_WEIGHTS` (lines 329-339), `MICROHABITAT_MODS` (lines 342-348).
- `SEASONAL_MULTIPLIERS[12]` (lines 355-368), `EFT_SEASONAL_MULTIPLIERS[12]` (lines 371-373).
- `MONTHLY_TEMPS[12]` (lines 381-394), `RAIN_PROBABILITY[12]` (line 397), `MID_SURVEY_RAIN[12]` (line 402).
- `WEATHER_STATES`, `CLOUD_COVER_PROBS`, `TEMP_MODIFIERS`, `HUMIDITY_MODIFIERS`, `PRECIP_HISTORY`, `TIME_MODIFIERS`, `WIND_MODIFIERS` (lines 406-469).
- `OBJECT_EVENTS`, `SURVEY_EVENTS`, `HEALTH_CONDITIONS`, `COOCCURRENCE` (lines 499-529).
- `NOTEBOOK_COLUMNS[14]` (lines 638-653) and `NOTEBOOK_HIDDEN_COLUMNS[2]` (lines 655-658).
- `ID_OPTIONS`, `SPECIES_COLOR_GROUP`, `DISTINGUISHING_FEATURES` (lines 666-741).
- Helpers: `getMimicDifficulty(svl)` line 545, `getSeason(month)` line 553.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/EventEngine.js`
- Constructor `(config, weatherSystem)` line 58. Coerces numeric configs (lines 60-64).
- `generateEncounter(coverObject)` line 84 -> returns `{type, speciesKeys[], description, event}`. Order: forced encounter check (95) -> per-object special event roll (100) -> cover contents weighted choice (110-122) -> compound salamander probability check that may downgrade to invertebrate (lines 117-122) -> dispatch by content type (124-160). Records to `encounterHistory` via `_record` (line 464).
- `getSpeciesWeights(coverType, month)` line 174: applies microhabitat modifiers and the eft-specific seasonal renormalization (lines 192-204).
- `checkSurveyEvent()` line 229: per-survey events fire at most once each.
- `getEncounterHistory()` line 255, `getSpeciesCounts()` line 262, `getMimicModelRatio()` line 281, `generateInvertebrateDescription()` line 305.
- Internal helpers: `_getSalamanderProbability` (line 317), `_pickSpecies` (line 341), `_pickMultiSpecies` (line 351 with co-occurrence rule), `_shouldForceEncounter` (line 373, threshold = 60% of objects), `_buildForcedEncounter` (line 391), `_rollObjectEvent` (line 423).

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/WeatherSystem.js`
- Constructor `(month, day)` line 35, calls `generate()` immediately.
- `generate()` line 48: temperature via `gaussianRandom`, isRaining via Bernoulli, daysSinceRain rolled, cloud state via `_rollWeatherState` (line 99), humidity via `_rollHumidity` (line 131), wind 0..25 km/h, rain coupling to temperature (lines 88-92).
- `update(elapsedMinutes)` line 179: temperature drift `gaussianRandom(0, 1.5*hours)`, mid-survey rain transitions using `MID_SURVEY_RAIN[month] * (elapsedMinutes/180)` (line 200).
- `getCurrentConditions()` line 160 -> snapshot object.
- `getEncounterModifier()` line 237: compound multiplication of weather-state, temperature, humidity, precipitation history, wind modifiers.
- `getDescription()` line 292.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/FieldNotebook.js`
- Extends `DataCollector` with notebook columns.
- `openEntryForm(animal, coverObj, speciesId, isCorrectId, surveyTime, airTemp)` line 75 -- captures hidden `trueSpecies` and `correct` flag in `_pendingTrueSpecies`/`_pendingIsCorrect`.
- `_handleSave()` line 360 reads form, calls `record(rowData)`, pushes hidden-tracking row to `_hiddenData` (line 389).
- `getSpeciesSummary()` line 143, `getMimicModelRatio()` line 159, `getTrueAccuracy()` line 184.
- `toCSV()` override line 205: appends `True Species` and `ID Correct` (Y/N) columns.
- `onSave(callback)` line 135 -- fires after each entry.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/AnalysisPanel.js`
- `load(data)` line 297 ingests `{totalObjects, checkedObjects, notebookRows[], hiddenData[], accuracy:{correct,total,bySpecies}, weather}`.
- `mount(container)` line 311, `onDownload(cb)` line 336, `onNewSurvey(cb)` line 341, `destroy()` line 346.
- `_computeStats(data)` line 362: derives speciesCounts, trueSpeciesCounts, ratioString via `formatRatio(mimic, model)` (line 260, GCD-reduced), mimicModelConfusions count.
- The chart-building section starting at line 494 produces a Canvas 2D bar chart -- the data assembly is portable, the canvas drawing is not.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/Salamander.js`
- Constructor `(speciesKey)` line 505: rolls SVL/TL/mass via `gaussianRandom` clamped to species `min/max` (lines 510-512), individual color offsets (515-516), health condition via `weightedPick(HEALTH_CONDITIONS)` (line 519). The trait set this builds is the deterministic part.
- `getFieldMeasurements()` returns `{svl, totalLength, mass}` -- consumed by `FieldNotebook.openEntryForm`.
- All the `drawSalamanderBody`, `drawSpots`, `drawLimbs`, sheen and stippling code (lines 111-494) is throwaway.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/IdentificationChallenge.js`
- Pure UI module. Builds species options from `ID_OPTIONS`/`SPECIES_COLOR_GROUP`, presents distractors, fires `onSubmit(callback)` with `{speciesId, correct}`. Replaced wholesale by HUD-framework panel and in-VR ui kit panel.

`/home/borchard/borchard-labs-workspace/borchard-labs/sim/experiments/batesian-mimicry/BatesianMimicrySim.js`
- Sub-state machine `surveying` -> `approaching` -> `flipping` -> `identifying` -> `recording` -> `surveying`, plus `analyzing`. Initialized line 35.
- All canvas/ViewManager/click-handler code (lines 178+) is rebuilt as R3F components.

---

## 2. Deterministic Core vs Discarded Layers

### 2.1 Hardy-Weinberg

**Preserved (port verbatim to TypeScript):**

| Module | Source file | Approx LOC | Role |
| --- | --- | --- | --- |
| Population math | `HWPopulation.js` | ~170 | Force application, state, history, expected/chi-square |
| Default parameters | `config.js` (DEFAULTS) | ~30 | Source of truth for config screen and tests |
| Data collection columns | `HWDataCollector.js` | ~50 | Column ordering and 4-decimal formatting |
| Binomial drift sampler | `engine/utils.js` (`binomialSample`) | ~10 | Deterministic Bernoulli loop -- DO NOT replace with normal approximation |
| Engine RNG helpers | `engine/utils.js` (`gaussianRandom`, `randomInt`, `randomFloat`, `clamp`, `weightedChoice`, `formatNumber`) | ~80 | Reused by both experiments |

**Discarded:**
- `HardyWeinbergSim.render()` and the entire stacked-area chart code (lines 53-388 of `HardyWeinbergSim.js`).
- Canvas creation and the `requestAnimationFrame` loop in `Simulation.js`.
- The hand-rolled HUD and ConfigScreen DOM construction.
- `HWOrganism.js` (stub, never instantiated).

### 2.2 Batesian Mimicry

**Preserved (port verbatim to TypeScript):**

| Module | Source file | Approx LOC | Role |
| --- | --- | --- | --- |
| Species data, encounter tables, weather tables | `config.js` | ~743 | Single source of biological truth |
| Encounter generation | `EventEngine.js` | ~474 | Forced encounters, contents weighted choice, microhabitat, multi-animal cooccurrence, special events |
| Weather rolling and modifiers | `WeatherSystem.js` | ~309 | Temperature, humidity, rain transitions, encounter compound modifier |
| Field notebook recording, hidden truth, CSV | `FieldNotebook.js` | ~625 (UI heavy; ~230 LOC of pure logic to keep) | Row recording, accuracy tally, hidden columns appended to CSV |
| Analysis statistics | `AnalysisPanel.js` `_computeStats` family | ~120 of ~700 | Stats derivation, ratio formatting (GCD), mimic-model confusions |
| Salamander trait rolling | `Salamander.js` constructor + `weightedPick` + health roll | ~50 of ~700 | Per-individual measurements and color offsets |
| Eleven research documents | `research/*.md` | n/a | Scientific provenance, untouched |

**Discarded:**
- `BatesianMimicrySim.js` rendering, click handling, ViewManager (~700 LOC).
- `ForestEnvironment.js`, `CoverObject.js` rendering (kept: cover object data shape and `qualityScore`), `TextureGenerator.js`, `ParticleSystem.js`, `ViewManager.js`.
- `Salamander.js` drawing functions (~650 LOC of canvas).
- `IdentificationChallenge.js` DOM panel, `FieldNotebook.js` injected stylesheet and entry form DOM (~400 LOC), `AnalysisPanel.js` chart canvas drawing (~580 LOC).

**Net deterministic core to port:** ~1700 LOC of pure logic across both experiments. ~3000 LOC of canvas/HUD/style code is discarded.

---

## 3. New Hardy-Weinberg Component Shape (R3F + TypeScript)

### 3.1 File layout

```
app/
  src/
    experiments/
      hardy-weinberg/
        index.tsx                    # Entry point exported to the engine
        HardyWeinbergScene.tsx       # R3F <Canvas> contents
        StratigraphicColumn.tsx      # 3D allele-frequency strata
        AlleleField.tsx              # Optional organism field instances
        HardyWeinbergHUD.tsx         # 2D chart overlay + stats + transport
        HWConfigPanel.tsx            # Pre-launch parameter form
        useHardyWeinbergSim.ts       # Simulation hook that drives the store
        types.ts                     # Shared types
    sim/
      hardy-weinberg/
        population.ts                # Pure port of HWPopulation
        forces.ts                    # selection/mutation/migration/drift/mating, individually testable
        rng.ts                       # Re-export deterministic RNG
        csv.ts                       # Column order + row formatter
        config.ts                    # DEFAULTS and parameter metadata
```

### 3.2 Core types

```ts
// sim/hardy-weinberg/types.ts

export interface HWConfig {
  populationSize: number;
  initialP: number;
  generations: number;

  enableDrift: boolean;

  enableMutation: boolean;
  mutationForward: number;
  mutationReverse: number;

  enableSelection: boolean;
  fitnessAA: number;
  fitnessAa: number;
  fitnessaa: number;

  enableMigration: boolean;
  migrationRate: number;
  migrantP: number;

  enableAssortativeMating: boolean;
  assortativeMatingCoeff: number;
}

export interface HWGenerationSnapshot {
  generation: number;
  p: number;
  q: number;
  freqAA: number;
  freqAa: number;
  freqaa: number;
  expectedAA: number;
  expectedAa: number;
  expectedaa: number;
  chiSquare: number;
  N: number;
}

export interface HWState {
  config: HWConfig;
  history: HWGenerationSnapshot[];
  current: HWGenerationSnapshot;
  status: 'setup' | 'running' | 'paused' | 'complete';
  generation: number;
}
```

### 3.3 Pure simulation API

```ts
// sim/hardy-weinberg/population.ts

export interface HWPopulation {
  readonly snapshot: HWGenerationSnapshot;
  readonly history: readonly HWGenerationSnapshot[];
  step(): HWGenerationSnapshot;     // advance one generation
  reset(): void;
}

export function createHWPopulation(
  config: HWConfig,
  rng: Rng,                          // injected for determinism
): HWPopulation;
```

The order of force application inside `step()` is fixed: selection -> mutation -> migration -> drift -> non-random mating, exactly matching `HWPopulation.update()` lines 50-124.

### 3.4 React hook contract

```ts
// experiments/hardy-weinberg/useHardyWeinbergSim.ts

export interface HardyWeinbergController {
  state: HWState;
  start(): void;
  pause(): void;
  resume(): void;
  step(): void;
  reset(): void;
  setSpeed(multiplier: number): void;
  exportCsv(): string;
  downloadCsv(filename?: string): void;
}

export function useHardyWeinbergSim(
  config: HWConfig,
  options?: { seed?: number; onComplete?(state: HWState): void },
): HardyWeinbergController;
```

The hook owns the `HWPopulation` instance and a Zustand slice. It advances the population on a configurable interval (default 4 generations/sec, matching `HardyWeinbergSim.tickRate = 4`). The hook is the single source of truth; the 3D scene and the 2D HUD both subscribe.

### 3.5 Scene composition

```tsx
// experiments/hardy-weinberg/HardyWeinbergScene.tsx

export function HardyWeinbergScene({ controller }: { controller: HardyWeinbergController }) {
  return (
    <>
      <CameraRig target={[0, controller.state.generation * STRATUM_HEIGHT, 0]} />
      <Environment preset="dawn" />
      <directionalLight castShadow position={[5, 10, 5]} intensity={1.4} />
      <StratigraphicColumn history={controller.state.history} />
      <ExpectedHWGuide history={controller.state.history} />
      <ProportionPedestal current={controller.state.current} />
      <Postprocessing />
    </>
  );
}
```

The `<HardyWeinbergHUD>` mounts as a sibling React node outside the `<Canvas>`, reading the same controller for the 2D chart, the data table, and the transport.

### 3.6 Visual translation: 3D Stratigraphic Column

Each generation contributes one ring to a vertical column. The column starts at `y=0` and grows upward by `STRATUM_HEIGHT` (~0.05 world units) per generation. Each ring is a stack of three colored slabs whose heights represent `freqaa`, `freqAa`, `freqAA`.

Scene contents:
- A central column extruded from a hex prism (cleaner radial silhouette than a cylinder), instanced so 1000-generation runs stay under one draw call. Each ring uses a per-instance `vec4` attribute holding `(freqAA, freqAa, freqaa, generation)`. A custom shader paints the three colored bands.
- Below the column, a slowly rotating "core sample" base plate stamped with the experiment name, parameters, and the generation count.
- An adjacent hovering panel (drei `<Html>` with `transform`) holds the live proportion bar synchronized to `current` -- the 3D analogue of the existing canvas proportion bar.
- Optional `<AlleleField>` (Miniplex-backed): a sparse instanced field of `populationSize / 50` low-poly organisms whose color is drawn from the genotype distribution at the current snapshot. Pure visual flair, deterministic visual seeded from the generation snapshot.
- Dotted ghost lines tracking `q^2` and `q^2 + 2pq` extrude as `<Line>` segments climbing the column, identical role to the existing dashed expected-HW overlay.
- Dust motes (drei `<Sparkles>`), volumetric god ray (`<GodRays>` from postprocessing) for atmosphere.
- Camera rig: chase-cam follows the top of the column on a smoothed spring; mouse-drag orbit and scroll-zoom enabled, but resets to chase-cam after 4 seconds of inactivity.

The 2D stacked area chart still exists -- it is mounted as a HUD overlay component (`<StackedAreaChart>` rendered to an SVG) in the bottom-right corner. Students who want the traditional reading of allele frequency over time get it; the 3D scene is the headline experience.

### 3.7 CSV export path

The pure population module emits snapshots already in the exact column order required. `csv.ts` formats with `formatNumber(_, 4)` for floats, integer for `Generation` and `N`, identical to lines 35-47 of `HWDataCollector.js`. Output uses CRLF and a trailing CRLF, identical to `DataCollector.toCSV()` line 72. Filename uses `hardy-weinberg_YYYY-MM-DD_HHMMSS.csv` per `DataCollector.download()` line 88.

---

## 4. New Batesian Mimicry Component Shape (R3F + TypeScript)

### 4.1 File layout

```
app/
  src/
    experiments/
      batesian-mimicry/
        index.tsx
        CoveScene.tsx                # R3F scene root
        Terrain.tsx                  # Phase 3 terrain with PBR materials
        Vegetation.tsx               # Instanced trees, ferns, rhododendron
        CoverObjects.tsx             # Rapier rigid bodies, grab interaction
        Salamander3D.tsx             # GLTF or procedural mesh + per-instance shader
        SalamanderInstance.tsx       # Wraps Salamander3D with the Rapier sensor
        IdChallengePanel.tsx         # @react-three/uikit panel (VR) + drei <Html> fallback
        FieldNotebookPanel.tsx       # Same dual mount
        WeatherAudio.tsx             # Maps weather state to audio buses
        AnalysisOverlay.tsx          # Post-survey results, mounts when state=analyzing
        useBatesianSim.ts
        types.ts
    sim/
      batesian-mimicry/
        eventEngine.ts               # Pure port of EventEngine.js
        weatherSystem.ts             # Pure port of WeatherSystem.js
        salamanderTraits.ts          # Trait rolling without rendering
        fieldNotebook.ts             # Pure recording + hidden tracking
        analysis.ts                  # _computeStats family
        config.ts                    # All tables from config.js
        rng.ts
        csv.ts
        types.ts
        research/                    # Eleven research docs copied verbatim
```

### 4.2 Core types

```ts
// sim/batesian-mimicry/types.ts

export type SpeciesKey =
  | 'NOVI' | 'PSRU' | 'PLCI' | 'PLGL'
  | 'DEFU' | 'EUBI' | 'DEMO' | 'GYPO';

export type CoverType = 'rock' | 'log' | 'bark' | 'board';

export interface CoverObject {
  id: number;
  type: CoverType;
  position: [number, number, number];
  rotation: [number, number, number];
  qualityScore: number;
  state: 'covered' | 'flipping' | 'uncovered';
}

export interface SalamanderTraits {
  speciesKey: SpeciesKey;
  svl: number;
  totalLength: number;
  mass: number;
  bodyHueOffset: number;
  bodySatOffset: number;
  health: 'healthy' | 'regeneratingTail' | 'oldInjury' | 'freshInjury' | 'dead' | 'abnormality';
  morph?: 'striped' | 'leadback' | 'erythristic';
}

export type EncounterResult =
  | { type: 'empty'; description: string }
  | { type: 'invertebrate'; description: string }
  | { type: 'salamander'; speciesKeys: SpeciesKey[] }
  | { type: 'snake' | 'otherHerp' | 'eggClutch' | 'predation';
      description: string; event: SpecialEvent };

export interface WeatherSnapshot {
  weather: keyof typeof WEATHER_STATES;
  weatherLabel: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  isRaining: boolean;
  rainedRecently: boolean;
  daysSinceRain: number;
}

export interface NotebookRow {
  entryNum: number;
  time: string;
  coverObjId: number;
  objType: CoverType;
  speciesId: SpeciesKey;
  idConfidence: string;
  svl: number;
  totalLength: number;
  mass: number;
  sex: 'Male' | 'Female' | 'Unknown';
  ageClass: 'Adult' | 'Subadult' | 'Juvenile';
  substrateMoisture: 'Dry' | 'Damp' | 'Wet' | 'Saturated';
  airTempC: number;
  notes: string;
  // Hidden:
  trueSpecies: SpeciesKey;
  idCorrect: boolean;
}

export type SubState =
  | 'surveying' | 'approaching' | 'flipping'
  | 'identifying' | 'recording' | 'analyzing';
```

### 4.3 Hook and store

```ts
// experiments/batesian-mimicry/useBatesianSim.ts

export interface BatesianController {
  subState: SubState;
  weather: WeatherSnapshot;
  coverObjects: CoverObject[];
  encounterHistory: EncounterRecord[];
  notebookRows: NotebookRow[];
  pendingEncounter: EncounterResult | null;
  pendingAnimal: SalamanderTraits | null;
  pendingCoverObj: CoverObject | null;
  surveyElapsedMin: number;

  flipCoverObject(id: number): EncounterResult;
  identifySpecies(speciesKey: SpeciesKey): { correct: boolean };
  saveEntry(input: NotebookEntryInput): void;
  cancelEntry(): void;
  finishSurvey(): void;
  exportCsv(): string;
}

export function useBatesianSim(
  config: BatesianConfig,
  options?: { seed?: number },
): BatesianController;
```

The Zustand store holds all of the above. The R3F scene reads `coverObjects` and `subState`; the HUD reads notebook rows, weather, progress. The hook injects a deterministic RNG into the EventEngine and WeatherSystem so the encounter log is reproducible.

### 4.4 Scene composition

```tsx
// experiments/batesian-mimicry/CoveScene.tsx

export function CoveScene({ controller }: { controller: BatesianController }) {
  return (
    <>
      <SkyAndSun weather={controller.weather} />
      <FogVolumetric weather={controller.weather} />
      <Environment files="hdri/cove-overcast.exr" background={false} />
      <Terrain habitat={controller.config.habitat} />
      <Vegetation seed={controller.config.seed} />
      <Stream visible={controller.config.habitat === 'stream'} />
      <Physics gravity={[0, -9.81, 0]}>
        <Player />                          {/* first-person controller from Phase 4 */}
        <CoverObjects
          objects={controller.coverObjects}
          onFlip={(id) => controller.flipCoverObject(id)}
        />
        {controller.pendingAnimal && controller.pendingCoverObj && (
          <SalamanderInstance
            traits={controller.pendingAnimal}
            position={controller.pendingCoverObj.position}
          />
        )}
      </Physics>
      <ParticleAtmospherics season={getSeason(controller.config.surveyMonth)} />
      <WeatherAudio weather={controller.weather} />
      <PositionalAudio source="audio/stream.opus" position={STREAM_POS} loop autoplay
                       distance={6} />
    </>
  );
}
```

### 4.5 Encounter loop driving Rapier interactions

1. Player walks the transect (Phase 4 character controller, capsule collider).
2. Cover objects are Rapier rigid bodies. Each `<CoverObjects>` member has a sensor collider on top so the rim-light hover shader fires when the player ray (or VR controller ray) hits it.
3. On grab (mouse click and hold, or VR grip), the body switches from kinematic to dynamic; mass is set per type so logs feel heavier than bark. On release, gravity does the rest.
4. The instant the cover body's local-up clears 90 degrees, the controller calls `flipCoverObject(id)` -- this is the one and only place `EventEngine.generateEncounter` runs. The result goes into `pendingEncounter`.
5. If `result.type === 'salamander'`, a `<SalamanderInstance>` renders at the cover object's reveal position. Camera dollies inward (drei `<CameraControls>` smoothDamp). After `SPECIES[key].behavior.freezeDuration` elapses, the species-specific behavior animation plays.
6. The ID challenge panel mounts. In VR it is an `@react-three/uikit` floating panel; on desktop it slides in as a drei `<Html>` portal. Both submit to the same `controller.identifySpecies`.
7. On submit, `pendingAnimal` is preserved long enough for `<FieldNotebookPanel>` to take over recording. Notebook submit calls `controller.saveEntry`. Sub-state returns to `surveying`.
8. Once `coverObjects` are exhausted or the player chooses to stop, `controller.finishSurvey()` advances to `analyzing` and `<AnalysisOverlay>` mounts.

### 4.6 Weather state synced to audio buses

```ts
// experiments/batesian-mimicry/WeatherAudio.tsx

const WEATHER_BED_MAP: Record<WeatherState, BedConfig> = {
  clear:     { bed: 'forest-ambience-clear',    rainGain: 0,    windGain: 0.2 },
  partCloud: { bed: 'forest-ambience-clear',    rainGain: 0,    windGain: 0.3 },
  overcast:  { bed: 'forest-ambience-overcast', rainGain: 0,    windGain: 0.4 },
  fogMist:   { bed: 'forest-ambience-fog',      rainGain: 0,    windGain: 0.25 },
  lightRain: { bed: 'forest-ambience-overcast', rainGain: 0.55, windGain: 0.5 },
  heavyRain: { bed: 'forest-ambience-overcast', rainGain: 0.95, windGain: 0.7 },
};
```

`<WeatherAudio>` watches `controller.weather` and crossfades the ambience bed via Howler (1.5 sec exponential ramp). Rain layer and wind layer ride on the same bus with their own gains. `controller.weather.windSpeed` modulates the wind gain. Rain transitions inside `WeatherSystem.update` automatically propagate because the controller re-emits the snapshot on every tick.

### 4.7 Field notebook mounted via Phase 2 HUD framework

`<FieldNotebookPanel>` is a HUD-framework component. It is the React analogue of `FieldNotebook.openEntryForm`: same auto-populated readout (entry #, time, cover obj #, obj type, species ID), same student inputs (SVL, TL, mass, sex, age class, substrate moisture, air temp, notes), same save/cancel buttons. In VR it mounts inside `@react-three/uikit` with the same field tokens. The pure-logic side -- recording, hidden truth tracking, accuracy stats -- is the ported `fieldNotebook.ts` module. The DOM markup is rebuilt; the row format is byte-identical.

### 4.8 Visual translation: cove-hardwood-forest beats

**Camera path on entry:** establishing pull-back from canopy, 6 seconds, GSAP timeline. Camera starts looking up through tulip-poplar canopy into morning sun (ACESFilmic exposure 1.1, sun warmth `#FFF5E0`). Camera glides down and forward, ending at the player's standing height at the start of the transect. Hand off to first-person controller. A diegetic clipboard fade-in shows the survey month, habitat, and conditions string from `WeatherSystem.getDescription()`.

**Salamander reveal beat:** player flips the cover body. As soon as Rapier reports the flip, time-of-day is unchanged but the camera does a soft inward dolly (0.6 sec). One-shot positional audio from the cover material (rock scrape, log roll, board lift, bark crack). If a salamander is present, ambient bus ducks 4dB, a soft musical sting plays from a non-positional bus (a single low cello sustained tone, 1.2 sec), and the salamander idle animation begins. The first-time-this-survey reveal triggers a stamp animation on the field notebook -- "Specimen logged" stamps over the entry slot, just for flavor.

**Cover-object grab beat:** rim-light shader on hover, controller rumble (gamepad/VR), grip-and-lift physics with mass-aware feel. The cover object follows the controller transform with a critically damped spring. Letting go drops it. Each cover material has its own collision sound bank (rocks ring slightly, logs thud, boards clatter, bark crackles).

**ID challenge surface:** floats in front of the player at chest height in VR, slides in from the right on desktop. Dual-mount component reads from `ID_OPTIONS[SPECIES_COLOR_GROUP[trueSpecies]]` and renders option cards with diagnostic feature pills. After submit, it shows the ground-truth panel with `DISTINGUISHING_FEATURES` for the actual species.

---

## 5. Determinism Strategy

### 5.1 Determinism contract

Both experiments must produce byte-identical CSV outputs against fixed seeds. The only sources of nondeterminism in the existing code are calls to `Math.random` inside `engine/utils.js` and `Salamander.js`'s constructor. The new TypeScript ports replace `Math.random` with an injected `Rng` interface backed by Mulberry32 (32-bit state, period 2^32, fast, well-distributed):

```ts
// sim/rng.ts
export interface Rng { next(): number; }
export function mulberry32(seed: number): Rng;
```

Every consumer of randomness (RNG helpers, `gaussianRandom`, `binomialSample`, `weightedChoice`, salamander trait rolling, EventEngine, WeatherSystem) takes `Rng` as a constructor argument or function parameter. No module calls `Math.random` directly.

To prove determinism against the existing JS code, the snapshot harness shims `Math.random` in the legacy modules to pull from a Mulberry32 with the same seed as the TypeScript port. Output streams are then compared.

### 5.2 Snapshot test harness

Location: `app/test/determinism/`. Vitest-driven. Two test files:

- `hardy-weinberg.snapshot.test.ts`
- `batesian-mimicry.snapshot.test.ts`

Each test loads `fixtures/<experiment>/<seed>/expected.csv`, runs the new TypeScript simulation with the same seed, and asserts exact string equality (CRLF preserved, trailing CRLF preserved). Fixtures are produced once by a script that runs the legacy modules with `Math.random` shimmed to Mulberry32, captures the CSV, and writes it to disk. Subsequent runs assert the new ports match.

### 5.3 Hardy-Weinberg seeds and columns

Seeds (chosen to exercise every code path):

| Seed | Config preset | What it tests |
| --- | --- | --- |
| 1 | All forces off, infinite-pop math (drift off) | Pure HW equilibrium, p stays put |
| 7 | Drift only, N=20, 200 generations | Drift sampling, fixation/loss outcomes |
| 13 | Selection only, w_aa=0.5 | Allele change under directional selection |
| 17 | Mutation only | Slow drift toward equilibrium ratio |
| 23 | Migration only, m=0.05, p_mig=0.9 | Convergence toward migrant frequency |
| 31 | Assortative mating only, F=1.0 | Genotype redistribution at fixed allele freq |
| 47 | All five forces on, N=500 | Compound interaction, 500 generations |

Asserted columns (every column of every row):
`Generation, p, q, freq_AA, freq_Aa, freq_aa, expected_AA, expected_Aa, expected_aa, chi_square, N`. All decimal-formatted to 4 places via shared `formatNumber`.

### 5.4 Batesian Mimicry seeds and columns

Seeds:

| Seed | Config preset | What it tests |
| --- | --- | --- |
| 101 | May, cove, 40 obj, 1 transect, forced encounters on | Full happy path including forced model and mimic |
| 103 | March, stream, 30 obj, 2 transects | Stream microhabitat weights, cooler weather modifiers |
| 107 | August, mixed, 50 obj, 1 transect | Hot/dry season, lower seasonal multipliers |
| 109 | June, cove, 60 obj, 3 transects, forced off | Stress test of cooccurrence and special events |
| 113 | October, cove, 25 obj, 2 transects | Eft seasonal curve dominates |

The test does NOT exercise the student-input fields (Sex, Age Class, Substrate Moisture, Notes) because those are user-driven. The harness instead simulates the deterministic side: it walks the encounter sequence, calls `identifySpecies(trueSpecies)` so accuracy is 100%, and saves entries with fixed measurements pre-filled by the salamander trait rolls.

Asserted columns: all 14 visible plus the 2 hidden columns:
`Entry #, Time, Cover Obj #, Obj Type, Species ID, ID Confidence, SVL (mm), Total Length (mm), Mass (g), Sex, Age Class, Substrate Moisture, Air Temp (C), Notes, True Species, ID Correct`.

The harness also asserts the encounter event log produced by EventEngine -- a richer signal than the notebook because it includes empty/invertebrate/special events that never reach the notebook.

### 5.5 Test command

```
npm run test:determinism
```

Wired into CI as a required check on every PR that touches `sim/`. Failure means semantic drift; the responsible change must be reverted or the fixtures regenerated with a documented justification.

---

## 6. Risk Register

| ID | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R-01 | Replacing `Math.random` with seeded RNG changes `gaussianRandom` outputs (Box-Muller pulls two values per call) | High | The port preserves the exact two-pull pattern. Snapshot tests catch any drift. The RNG interface is identical; the consumers are unchanged. |
| R-02 | `binomialSample` uses a Bernoulli loop. A future "optimization" could substitute the normal approximation for large N, breaking determinism | High | Lock the implementation behind an `assertExactBinomial` unit test that runs `binomialSample(10000, 0.5)` and asserts the exact integer for seed 42. Comment `DO NOT REPLACE WITH NORMAL APPROXIMATION` at the top of `rng.ts`. |
| R-03 | TypeScript number formatting differs subtly from `Number.toFixed` (it does not) | Low | The CSV layer uses `formatNumber(_, 4)` which calls `Number.toFixed(4)` -- identical in both runtimes. Snapshot tests catch any drift. |
| R-04 | Floating-point order-of-operations changes between modules during the port (e.g., extracting selection into its own function alters intermediate rounding) | High | Port `HWPopulation.update` as a single function whose statement order mirrors the original line-by-line. Unit tests against fixed inputs assert outputs to 15 significant figures. |
| R-05 | Eft seasonal renormalization in `EventEngine.getSpeciesWeights` (lines 192-204) has a fragile divide-by-near-zero guard | Medium | Port the guard verbatim. Snapshot tests cover January/December months where the guard matters. |
| R-06 | `_shouldForceEncounter` threshold uses `Math.floor(totalObjects * 0.6)` -- changing config coercion could shift the threshold | Medium | Coerce config integers in the same place (constructor lines 60-64) and write a unit test that asserts the threshold for representative configs. |
| R-07 | Weather mid-survey transition probability is scaled by `elapsedMinutes / 180` -- moving from one update-per-tick to a continuous frame loop could change the elapsed-minute resolution | High | Keep `WeatherSystem.update` driven by discrete "minute chunks" that the controller emits at fixed intervals (e.g., one chunk per cover object flipped, or a fixed 3-minute timer). Snapshot tests assert weather at known elapsed-minute checkpoints. |
| R-08 | `_pickMultiSpecies` cooccurrence uses `Math.random() < COOCCURRENCE.sameSpecies` per additional animal -- if the new code uses a different ordering of species rolls, encounters drift | High | Port the function literally. Add a focused unit test that runs `_pickMultiSpecies(3, mockCover)` 1000 times under seed 42 and asserts the exact joint species distribution. |
| R-09 | CSV escaping helpers exist in two places (`DataCollector.escapeCSVField` line 255 and `FieldNotebook.escapeCSV` line 618) that are textually identical but separately defined | Low | Consolidate into one helper in `sim/csv.ts`, write a unit test against RFC 4180 cases (quotes, commas, CRLF, plain). |
| R-10 | Hidden columns (`True Species`, `ID Correct`) appear at end of CSV -- order matters | Medium | Snapshot test asserts column order including hidden columns. Document the order in `csv.ts` with a comment. |
| R-11 | The legacy `BatesianMimicrySim` couples sub-state transitions to canvas clicks. Porting to Rapier flip events changes the trigger but must not change the encounter sequence | High | The encounter is generated only on cover flip completion. Snapshot tests run the encounter pipeline programmatically with no rendering attached, matching the old behavior. |
| R-12 | R3F's StrictMode double-invokes effects in development, which could double-roll RNG | High | The simulation hook stores the RNG and population/event-engine instances in `useRef`, not state. Verify with a unit test that `StrictMode` wrapping yields the same CSV as production. |
| R-13 | Zustand subscriptions firing mid-tick could cause partial state reads in HUD | Medium | All snapshot mutations go through a single `setState` per generation. Selectors use shallow equality. |
| R-14 | Browser locale changes how numbers stringify in some edge environments | Low | All numeric formatting goes through a single `formatNumber` that uses `Number.prototype.toFixed` -- locale-independent. |
| R-15 | localforage save/load round-tripping a population mid-run could corrupt RNG state if the seeded RNG is not serialized | High | The save schema includes the current RNG state (Mulberry32 is one 32-bit integer). On load, the RNG is reconstructed exactly. A round-trip test runs 50 generations, saves, reloads, runs 50 more, and compares to a 100-generation reference. |
| R-16 | Three.js / R3F version churn during the build phase could land breaking changes between research and implementation | Low | Pin versions in `package.json`. Note the pinned versions in `ENGINE-DESIGN.md`. |
| R-17 | The new `<Salamander3D>` model uses GLTF morph targets for behavior animation -- if morph weights are uninitialized, the freeze duration logic could trigger nothing visible | Medium | Smoke test asserts the species-specific behavior animation actually plays for at least the freeze duration. |
| R-18 | First-time loading of HDRI and KTX2 assets can take seconds; if the simulation starts before the cove is rendered, students see encounter events with no visual reveal | Medium | Block `controller.start()` behind a `useProgress()` gate. Loading screen shows progress; survey only begins when assets are ready. |
| R-19 | VR mode and desktop mode must produce identical encounter logs | High | The simulation hook is mode-agnostic; rendering is the only difference. Snapshot test runs in node (no rendering), so passing the test means both modes are equivalent on the data side. |
| R-20 | Switching from `setInterval`/RAF tick rate (Hardy-Weinberg) to a hook-driven scheduler under React StrictMode could miss generations | Medium | Use a leading-edge interval inside `useEffect` with a ref-tracked accumulator; under StrictMode the effect still fires once per real mount because the cleanup tears it down. Unit test asserts exactly N generations elapse for N "ticks of wall time" at speed 1.0. |

---

## 7. Proposed Beads Issues for Phase 1

Each item below is a title plus a tag and suggested priority. None are filed by this research pass.

**Foundation (engine layer, prerequisites for both ports):**
- `[migration][P1]` Define migration test harness directory layout under app/test/determinism
- `[migration][P1]` Build Mulberry32 seeded RNG and Math.random shim for legacy fixture capture
- `[migration][P1]` Capture legacy CSV fixtures for Hardy-Weinberg seeds 1, 7, 13, 17, 23, 31, 47
- `[migration][P1]` Capture legacy CSV and event-log fixtures for Batesian Mimicry seeds 101, 103, 107, 109, 113

**Hardy-Weinberg port:**
- `[migration][P1]` Port HWPopulation math to TypeScript module sim/hardy-weinberg/population.ts
- `[migration][P1]` Port engine RNG helpers (gaussianRandom, binomialSample, weightedChoice) to TypeScript with injected Rng
- `[migration][P1]` Port HW config defaults and parameter metadata to sim/hardy-weinberg/config.ts
- `[migration][P1]` Port HW CSV column ordering and number formatting to sim/hardy-weinberg/csv.ts
- `[migration][P1]` Hardy-Weinberg determinism snapshot tests
- `[migration][P2]` useHardyWeinbergSim hook with Zustand integration
- `[render][P2]` Implement StratigraphicColumn instanced shader
- `[render][P2]` Implement ExpectedHWGuide line overlay in 3D scene
- `[render][P2]` Implement ProportionPedestal component
- `[render][P3]` Implement AlleleField organism instances (optional flair)
- `[ui][P2]` Hardy-Weinberg HUD overlay: 2D stacked area chart, stats, transport
- `[ui][P2]` Hardy-Weinberg pre-launch config panel using HUD framework
- `[migration][P2]` Hardy-Weinberg save/load round-trip test
- `[migration][P3]` Hardy-Weinberg mobile/responsive smoke pass

**Batesian Mimicry port:**
- `[migration][P1]` Port Batesian config tables (SPECIES, weights, weather tables, etc.) to sim/batesian-mimicry/config.ts
- `[migration][P1]` Port EventEngine to TypeScript module
- `[migration][P1]` Port WeatherSystem to TypeScript module
- `[migration][P1]` Port Salamander trait rolling to sim/batesian-mimicry/salamanderTraits.ts
- `[migration][P1]` Port FieldNotebook recording, hidden truth, CSV export
- `[migration][P1]` Port AnalysisPanel _computeStats family to pure analysis.ts
- `[migration][P1]` Batesian Mimicry determinism snapshot tests (CSV plus encounter event log)
- `[migration][P2]` useBatesianSim hook orchestrating sub-state machine
- `[render][P2]` Build CoveScene root with sky, sun, fog, HDRI integration
- `[render][P2]` Build Terrain component using Phase 3 leaf-litter material
- `[render][P2]` Build Vegetation component with instanced trees, ferns, rhododendron
- `[render][P2]` Build Stream component for stream-corridor habitat
- `[render][P2]` Build CoverObjects with Rapier rigid bodies and grab interaction
- `[render][P2]` Build Salamander3D base mesh and species-specific texture variants
- `[render][P2]` Implement species behavior animations (freeze, defensive coil, escape)
- `[ui][P2]` IdChallengePanel dual mount (uikit for VR, drei Html for desktop)
- `[ui][P2]` FieldNotebookPanel dual mount
- `[ui][P2]` AnalysisOverlay rebuilt as React component
- `[audio][P2]` WeatherAudio crossfade buses tied to weather state
- `[audio][P2]` Cover-object impact sound bank tied to material
- `[audio][P3]` Salamander reveal musical sting bus
- `[migration][P2]` Batesian Mimicry save/load round-trip test
- `[migration][P3]` Batesian Mimicry VR end-to-end smoke test on Quest 3

**Cross-experiment:**
- `[migration][P1]` Consolidated CSV escape helper with RFC 4180 unit tests
- `[migration][P2]` Document determinism contract in docs/determinism.md
- `[infra][P2]` CI gate: determinism tests required on every sim/ change

Total proposed: 39 beads issues.

---

## Open Questions

1. **Where does the simulation hook own its tick scheduler -- inside R3F's `useFrame`, or outside the canvas in a `useEffect` interval?** Inside `useFrame` couples simulation cadence to render frames (and pauses when the tab is backgrounded), which changes wall-time semantics for Hardy-Weinberg's 4 gen/sec default. Outside-the-canvas interval keeps simulation cadence wall-clock, but then the simulation can advance while the scene is unmounted. Phase 2 should pick one and document it.

2. **Does the new engine maintain the existing experiment-page mount contract, or do experiment HTML pages become full-page React mounts?** The existing `/experiments/<slug>/index.html` includes the page header, breadcrumb, methods narrative, and questions. The simulation currently mounts inside a `<div>` on that page. The new engine could either preserve that pattern (R3F mounts inside a container) or take over the full viewport (cinematic full-screen). The visual bar argues for full-screen with a subtle "Field Notes" tab to expose the methods text; this needs design buy-in.

3. **Should we adopt a fixed-timestep pattern for both simulations, or keep Hardy-Weinberg variable-rate and Batesian Mimicry event-driven?** Fixed-timestep is the orthodoxy for deterministic physics, but Hardy-Weinberg currently advances generations on a wall-clock cadence and Batesian Mimicry has no per-frame simulation tick at all. Probably keep both as-is, but call this out in `ENGINE-DESIGN.md` so future experiments do not inherit the wrong assumption.

4. **Eleven research documents -- copy verbatim into the new tree, or link from the existing `sim/experiments/batesian-mimicry/research/` path?** The new layout assumes a copy. If we leave them at the old path, build-time copying is required so they ship in `dist/`. A single canonical location avoids drift; the migration commit should pick one.

5. **Salamander 3D model source: GLTF assets sourced from Sketchfab CC0, or one base mesh sculpted in Blender with eight texture variants?** The VR-realism prompt's research phase landed on the latter; this migration plan assumes that decision holds, but Phase 5 implementation should confirm.

6. **The legacy AnalysisPanel renders an in-canvas species frequency chart with expected-frequency markers.** The new analysis overlay can use Recharts or a custom drei-mounted SVG. Either is fine; the data path (`_computeStats`) does not care.

7. **Should the Hardy-Weinberg 3D scene include the optional `<AlleleField>` for the MVP, or is the Stratigraphic Column the sole 3D affordance?** The column is the headline; the field is flair. If the build budget is tight, ship the column first and add the field as a Phase 7 polish item.
