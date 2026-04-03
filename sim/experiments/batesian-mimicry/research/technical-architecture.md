# Batesian Mimicry Field Simulation -- Technical Architecture

**Date:** 2026-04-03
**Author:** Mason Borchard
**Status:** Research / Pre-implementation

---

## 1. Engine Fit Analysis

The simulation engine (`sim/engine/`) was built for the Hardy-Weinberg sim -- a generation-based, auto-advancing model. The Batesian mimicry sim is fundamentally different: it's an interactive field survey where the player clicks cover objects, identifies animals, and records data. Every engine base class needs to be evaluated against this new interaction model.

### 1.1 Simulation.js

**What works as-is:**
- Canvas creation and lifecycle management (`init()`, `destroy()`)
- `ResizeObserver`-based responsive canvas sizing at 16:10 aspect ratio
- Event emitter system (`on`, `off`, `emit`) -- essential for decoupling UI components
- State machine with `stateChange` events
- `_sizeCanvas()` and container mounting

**What needs to be extended/overridden:**
- `tick()` -- the HW sim runs one generation per tick. The mimicry sim has no equivalent. Ticks here are player actions (clicking a cover object, submitting an ID, recording data). Override to be a no-op or to advance ambient animations (weather particles, leaf drift)
- `render()` -- complete override. The HW sim renders a stacked area chart. The mimicry sim renders a top-down forest floor with interactive objects
- `start()` -- needs to transition into the `surveying` sub-state instead of launching an auto-advancing loop
- `reset()` -- override to clear survey state, regenerate the transect, and reset the field notebook

**What doesn't fit:**
- The auto-advancing game loop (`_loop()`). The loop runs `tick()` on a timer based on `tickRate` and `speed`. The mimicry sim should NOT auto-advance -- it waits for player input. Two options:
  1. Set `tickRate` to something very high and only do visual updates in the loop (ambient animation), never calling meaningful logic in `tick()`
  2. Better: override `start()` to enter `running` state but run a render-only animation loop. Player actions call methods directly on the sim, not through the tick system

- `speed` / `setSpeed()` / speed slider -- irrelevant. There's nothing to speed up. The sim runs at the pace the player clicks
- `maxTicks` / `tickCount` -- these map to cover objects checked, not time-based generations. Repurpose: `tickCount` = number of cover objects flipped, `maxTicks` = total cover objects on the transect
- The `step()` method (advance one tick while paused) -- no equivalent in a player-driven sim

**Recommended approach:** Extend `Simulation`. Override `start()` to enter `running` state and begin a render-only `requestAnimationFrame` loop for ambient visuals. All meaningful state transitions happen through explicit method calls triggered by player interaction, not through `tick()`.

### 1.2 Environment.js

**What works as-is:**
- Key-value state store (`get()`, `set()`, `getAll()`)
- `reset()` with initial state snapshot
- `render()` hook for drawing the environment background
- Config passthrough via constructor

**What needs to be extended/overridden:**
- `render()` -- will draw the forest floor: leaf litter texture, moss patches, fallen logs, transect boundary markers. This is the bulk of the visual work
- `update()` -- in HW this runs allele frequency math. Here it could update weather state, time-of-day lighting, or moisture levels. But these don't change per-tick in the auto-advance sense -- they're set once at survey start and remain stable (weather might shift mid-survey as a difficulty mechanic)

**What doesn't fit:**
- Nothing fundamentally wrong. The key-value store is flexible enough to hold forest state: `temperature`, `humidity`, `canopyDensity`, `leafLitterDepth`, `season`, `weather`, `timeOfDay`. The store pattern works fine

**State keys for the mimicry environment:**
```
date              -- survey date (affects species activity)
season            -- spring/summer/fall (derived from date)
temperature       -- degrees C, affects encounter probability
humidity          -- percentage, affects salamander surface activity
weather           -- clear/overcast/light-rain/heavy-rain
canopyDensity     -- affects light level on forest floor
leafLitterDepth   -- affects how hidden animals are
transectLength    -- meters
coverObjectCount  -- total number of cover objects placed
```

### 1.3 Agent.js

**What works as-is:**
- Unique ID via auto-incrementing counter
- `x`, `y` position
- `traits` key-value store (`getTrait()`, `setTrait()`)
- `alive` flag
- `render()` hook
- `Agent.resetIds()` for sim reset

**What needs to be extended/overridden:**
- `render()` -- needs to draw species-specific salamander illustrations on the canvas. Key distinguishing features: body color, spot pattern, body proportions, tail shape. These need to be visually distinct enough for the ID challenge but similar enough between mimics and models to make it challenging
- `update()` -- minimal. Animals don't move during a survey (they're found under cover objects). But could animate a brief "scurry" when the cover is lifted

**Multiple agent types needed:**
- `Salamander` extends `Agent` -- represents an individual animal found under a cover object. Traits: `species`, `svl` (snout-vent length), `totalLength`, `mass`, `coloration`, `spotPattern`, `sex`, `age`, `isModel` (boolean -- is this the toxic model species or the harmless mimic?)
- `CoverObject` -- this is a stretch for `Agent`. Cover objects (rocks, logs, bark, boards) are inanimate. But they have position, visual state (covered/uncovered), and render on the canvas. Options:
  1. Extend `Agent` -- abuse the class a bit, but it works. Set `alive` to always `true`, use `traits` for `type` (rock/log/bark/board), `isFlipped`, `animalUnderneath`
  2. Don't extend `Agent` -- make it a standalone class with its own `x`, `y`, `render()`. Cleaner semantically but loses the engine's automatic rendering loop (Simulation.render iterates over `this.agents`)

**Recommended approach:** Make `CoverObject` its own class, not extending `Agent`. It's not an agent -- it's part of the environment. The `ForestEnvironment` owns and renders cover objects. `Salamander` extends `Agent` and lives in `this.agents`, but agents are only added to the array when an animal is found (they're generated probabilistically at flip time, not pre-placed).

Actually, rethinking: cover objects DO need click detection, position, and rendering. And `Simulation.render()` iterates `this.agents` for rendering. If `CoverObject` doesn't extend `Agent`, the sim's `render()` override needs to handle cover object rendering separately. That's fine -- we're overriding `render()` anyway. Keep `CoverObject` standalone.

### 1.4 DataCollector.js

**What works as-is:**
- Column-based data recording via `record(rowData)`
- Scrollable table UI with `mount()`
- CSV export with proper escaping (RFC 4180)
- Download with timestamped filename
- Clear functionality
- Counter display ("N observations recorded")

**What needs to be extended/overridden:**
- Column definitions -- the field notebook needs very different columns than the HW sim:
  ```
  Cover Object #, Object Type, Species, SVL (mm), Total Length (mm),
  Mass (g), Sex, Age Class, GPS Lat, GPS Lon, Microhabitat, Notes
  ```
- The table UI needs richer formatting -- the field notebook isn't just a data table, it's an interactive form the player fills in. But the underlying `record()` / `toCSV()` / `download()` plumbing is solid

**What doesn't fit:**
- The UI assumptions. `DataCollector` renders a simple read-only table with header, rows, and action buttons. The field notebook is an interactive form: some fields auto-populate (cover object number, GPS coords), some are entered by the player (measurements, notes), and some come from the ID challenge (species). The `_appendRowToDOM()` method creates static `<td>` elements -- the notebook needs input fields

**Recommended approach:** Extend `DataCollector` for the data storage and CSV export. Override `mount()` entirely to build a custom field notebook UI. The notebook has two modes:
1. **Read mode** -- shows completed entries as rows (uses the inherited table structure)
2. **Entry mode** -- shows a form for the current observation with editable fields

The `record()` method still works as the commit point -- when the player finishes filling in the form, their entries get passed to `record()` and appear in the read-only table.

### 1.5 HUD.js

**What works as-is:**
- Stats panel with key-value display (`setStats()`)
- State indicator
- Event-driven updates via simulation event listeners
- Mount/destroy lifecycle

**What doesn't fit:**
- Transport controls (play/pause/step/speed) -- irrelevant for a player-driven sim. No play button, no speed slider, no step button
- "Generation" counter -- should be "Cover Objects: 5 / 24" or similar progress indicator
- The entire control paradigm. The HW HUD controls a time-based simulation. The mimicry HUD displays field conditions and survey progress

**Recommended approach:** Don't extend `HUD`. Build a custom `FieldHUD` from scratch that displays:
- Current weather conditions (icon + text)
- Temperature / humidity readings
- Survey progress (objects checked / total)
- Timer (elapsed time in the field)
- Current transect section
- A "Return to Camp" button (end survey early)

This is a composition case, not an inheritance case. The `HUD` class is too tightly coupled to the transport-control paradigm.

### 1.6 ConfigScreen.js

**What works as-is:**
- Parameter definition format (`getParams()` returning typed descriptors)
- Input rendering for number, range, select, and checkbox types
- `dependsOn` conditional visibility
- `getValues()` and the `onStart` callback pattern
- Description text for parameters

**What needs to be extended/overridden:**
- `getParams()` -- completely different parameter set. Survey date, transect length, habitat type, weather conditions, difficulty level
- Possibly needs a multi-step config wizard rather than a single form (step 1: choose date/location, step 2: review transect layout, step 3: confirm and begin)

**Recommended approach:** Extend `ConfigScreen` for the single-page version. Override `getParams()` with survey setup parameters. If we need the multi-step wizard, extend further or build a custom `FieldSetup` that uses `ConfigScreen` as one step in a sequence.

### 1.7 utils.js

**What works as-is -- all of it:**
- `randomFloat()`, `randomInt()` -- encounter probability calculations
- `gaussianRandom()` -- generating realistic body measurement distributions (SVL, mass)
- `weightedChoice()` -- species encounter probabilities weighted by habitat, season, weather
- `shuffle()` -- randomizing cover object placement along the transect
- `binomialSample()` -- useful for determining how many animals of each species to place
- `clamp()`, `formatNumber()` -- general utility

**Nothing to override.** This module is pure functions, no state. Import and use directly.

---

## 2. State Machine Design

### 2.1 The Sub-State Problem

The engine's state machine has four states: `setup`, `running`, `paused`, `complete`. The mimicry sim needs six operational phases: `setup`, `surveying`, `recording`, `identifying`, `reviewing`, `analyzing`.

We cannot modify the base `Simulation` class. The solution: manage sub-states within the `running` state.

```
Engine states:    setup ──> running ──────────────────────────> complete
                             │
Sub-states:                  ├── surveying
                             ├── recording
                             ├── identifying
                             ├── reviewing
                             └── analyzing
```

When the player clicks "Start Survey" on the config screen, the sim calls `start()` which transitions the engine to `running`. From there, the sim manages its own `subState` property:

```javascript
// Inside BatesianMimicrySim
this.subState = 'surveying';  // initial sub-state after start()

setSubState(newSubState) {
    var prev = this.subState;
    this.subState = newSubState;
    this.emit('subStateChange', { from: prev, to: newSubState });
}
```

### 2.2 Sub-State Definitions

**`surveying`** -- The main interactive phase. Canvas shows the forest floor with cover objects. Player clicks objects to flip them. Ambient animation runs (leaf particles, maybe a bird call timer). The field notebook is visible but in read-only mode showing past entries.

**`identifying`** -- Triggered when a cover object flip reveals an animal. A modal overlay appears with the animal illustration at a larger scale, plus a species selection interface. Player must identify the species. Timer optional (adds pressure). Correct ID advances to `recording`. Incorrect ID shows feedback and lets them try again or skip.

**`recording`** -- The field notebook switches to entry mode. Some fields auto-populate from the found animal's generated traits (the "true" values). The player fills in measurements and observations. A "Save Entry" button commits the record and returns to `surveying`.

**`reviewing`** -- Triggered when all cover objects have been checked or the player clicks "End Survey." Shows a summary: total animals found, species breakdown, accuracy of identifications, completeness of data recording. Option to download CSV or proceed to analysis.

**`analyzing`** -- Post-survey lab phase. The player works with their collected data to answer questions about mimic-to-model ratios, frequency dependence, and whether their data supports Batesian mimicry predictions. Includes interactive charts and statistical tests.

### 2.3 Transitions

```
setup ──[Start Survey]──> surveying
surveying ──[Click cover object, animal found]──> identifying
surveying ──[Click cover object, nothing found]──> surveying (stay)
surveying ──[End Survey / all objects checked]──> reviewing
identifying ──[Correct ID]──> recording
identifying ──[Skip]──> surveying
recording ──[Save Entry]──> surveying
reviewing ──[Proceed to Analysis]──> analyzing
reviewing ──[Download & Exit]──> complete
analyzing ──[Finish]──> complete
```

---

## 3. Proposed File Structure

```
sim/experiments/batesian-mimicry/
  research/
    technical-architecture.md       -- This document
  BatesianMimicrySim.js             -- Main simulation orchestrator
  ForestEnvironment.js              -- Forest state, weather, rendering
  Salamander.js                     -- Individual animal entity
  CoverObject.js                    -- Clickable cover object
  FieldNotebook.js                  -- Interactive data collection
  FieldSetup.js                     -- Pre-survey config screen
  EventEngine.js                    -- Probabilistic encounter generator
  IdentificationChallenge.js        -- Species ID mini-game
  WeatherSystem.js                  -- Weather state machine
  TransectRenderer.js               -- Canvas rendering for forest floor
  AnalysisPanel.js                  -- Post-survey data analysis
  config.js                         -- Species data, probabilities, constants
```

---

## 4. Component Design

### 4.1 BatesianMimicrySim.js

**Extends:** `Simulation`

**Responsibilities:**
- Orchestrate the full survey lifecycle from setup through analysis
- Manage sub-state transitions within the engine's `running` state
- Wire up event flow between components (cover object clicks, ID challenge results, notebook entries)
- Own the render loop -- delegate to `ForestEnvironment` for background, `TransectRenderer` for cover objects and animals, HTML overlays for notebook/ID challenge
- Handle canvas click events and route them to the correct handler based on sub-state

**Key methods:**
```
init()                 -- create canvas, mount environment, notebook, HUD
start()                -- transition to running/surveying, begin render loop
tick()                 -- no-op or advance ambient animation timer
render()               -- delegate to TransectRenderer, overlay HUD elements
handleCanvasClick(x,y) -- hit-test cover objects, trigger flip + encounter
flipCoverObject(obj)   -- animate the flip, query EventEngine for encounter
onAnimalFound(animal)  -- transition to identifying sub-state
onIdentified(result)   -- handle ID challenge outcome
onRecordSaved(data)    -- commit to FieldNotebook, return to surveying
endSurvey()            -- transition to reviewing
startAnalysis()        -- transition to analyzing
reset()                -- clear all state, regenerate transect
destroy()              -- tear down all components
```

**Interactions:**
- Creates and owns: `ForestEnvironment`, `EventEngine`, `FieldNotebook`, `IdentificationChallenge`, `TransectRenderer`, `AnalysisPanel`
- Listens to: canvas click events, `IdentificationChallenge` results, `FieldNotebook` save events
- Emits: `subStateChange`, `animalFound`, `surveyComplete`, `analysisComplete`

**Implementation notes:**
- Override `start()` to NOT use the tickRate-based auto-advance loop. Instead, run a pure `requestAnimationFrame` loop that only calls `render()` and advances ambient animation timers. No `tick()` calls on a schedule
- Canvas click handling: attach a `click` listener to `this.canvas` in `init()`. Convert page coordinates to canvas coordinates, then hit-test against cover object bounding boxes. Only process clicks when `subState === 'surveying'`
- The `paused` engine state can still work -- if the player opens a menu or the tab loses focus, pause the render loop. Resume returns to whatever sub-state was active

### 4.2 ForestEnvironment.js

**Extends:** `Environment`

**Responsibilities:**
- Store environmental state (weather, temperature, humidity, canopy density, season)
- Determine how environmental conditions affect encounter probabilities (passed to EventEngine)
- Render the forest floor background on canvas (leaf litter, moss, soil patches, shadows)
- Own the collection of `CoverObject` instances and their placement along the transect

**Key methods:**
```
constructor(config)            -- initialize environmental state from config
generateTransect()             -- place cover objects along the transect line
getCoverObjects()              -- return the array of cover objects
getEnvironmentalModifiers()    -- return probability modifiers based on conditions
render(ctx, width, height)     -- draw forest floor background
update(tick)                   -- update weather transitions if applicable
reset()                        -- regenerate transect and reset state
```

**State keys:**
```
date, season, temperature, humidity, weather, canopyDensity,
leafLitterDepth, transectLength, coverObjectCount, objectsChecked
```

**Interactions:**
- Created by: `BatesianMimicrySim`
- Owns: array of `CoverObject` instances
- Consumed by: `EventEngine` (environmental modifiers), `TransectRenderer` (render state)

**Implementation notes:**
- Transect generation: the transect is a linear path through the forest. Cover objects are placed at semi-regular intervals with some random offset. Object types (rock, log, bark, board) are chosen by `weightedChoice` based on habitat configuration
- The forest floor rendering doesn't need to be photorealistic. Tiled/layered canvas fills with color variation: base soil color (`--bark` family), overlaid leaf litter patches, moss spots in humid areas. Keep it illustrative, not busy
- Season affects the color palette of the forest floor rendering (spring: greens and browns, summer: deep greens, fall: oranges and reds, winter: grays and browns)

### 4.3 Salamander.js

**Extends:** `Agent`

**Responsibilities:**
- Represent a single animal found during the survey
- Store species-specific traits (measurements, coloration, pattern)
- Render a recognizable illustration of the animal on canvas
- Know whether it's a model (toxic) or mimic (harmless)

**Key traits:**
```
species          -- e.g. 'red-spotted-newt', 'red-salamander'
commonName       -- display name
isModel          -- boolean, true for toxic model species
svl              -- snout-vent length in mm (generated from species distribution)
totalLength      -- total length in mm
mass             -- body mass in grams
sex              -- 'male', 'female', 'unknown'
ageClass         -- 'adult', 'subadult', 'juvenile'
coloration       -- primary body color (hex or named)
spotPattern      -- 'spotted', 'striped', 'uniform', 'blotched'
spotColor        -- color of markings
bodyShape        -- proportions used for rendering
tailShape        -- 'round', 'keeled', 'laterally-compressed'
activityLevel    -- affects animation when uncovered
```

**Key methods:**
```
constructor(speciesConfig)     -- generate traits from species probability distributions
render(ctx)                    -- draw the animal at its position on canvas
renderLarge(ctx, x, y, scale)  -- draw enlarged version for ID challenge
getFieldMeasurements()         -- return the "true" measurements for auto-populating the notebook
getIdentifyingFeatures()       -- return features relevant to the ID challenge
```

**Interactions:**
- Created by: `EventEngine` (when an encounter is determined)
- Rendered by: `TransectRenderer` (at cover object position) and `IdentificationChallenge` (enlarged)
- Data consumed by: `FieldNotebook` (measurements)

**Implementation notes:**
- Rendering approach: Canvas 2D path drawing. Each species has a drawing function that creates the body outline, head shape, limb positions, and pattern overlay. The key distinguishing features for the red salamander / eastern newt system:
  - Eastern newt (model): bright orange-red, black-bordered red spots in two rows, rough/granular skin texture, laterally compressed tail (keeled for aquatic phase)
  - Red salamander (mimic): similar red-orange but often darker/duller, black spots scattered irregularly (not bordered, not in neat rows), smooth skin, round tail
- Measurements generated via `gaussianRandom()` from species-specific mean and standard deviation. Real data ranges:
  - Eastern newt adult: SVL 35-55mm, total length 70-120mm
  - Red salamander adult: SVL 45-70mm, total length 95-160mm
- Variation in coloration is important -- not every individual of a species looks identical. Slight hue/saturation shifts via random offset on base colors

### 4.4 CoverObject.js

**Does not extend a base class** -- standalone component.

**Responsibilities:**
- Represent a single cover object on the transect (rock, log, bark piece, cover board)
- Track visual state: covered, animating (lifting), uncovered
- Provide hit-test for click detection
- Render on canvas in the appropriate state

**Key properties:**
```
id               -- unique identifier
x, y             -- position on canvas (set during transect generation)
width, height    -- bounding box size (varies by type)
type             -- 'rock', 'log', 'bark', 'board'
state            -- 'covered', 'lifting', 'uncovered'
animal           -- null or Salamander instance (assigned at flip time)
flipTime         -- timestamp of when it was flipped
checked          -- boolean, has this object been checked already
```

**Key methods:**
```
constructor(type, x, y)        -- create with type and position
render(ctx)                    -- draw the cover object based on state
renderUncovered(ctx)           -- draw what's underneath (soil/animal)
hitTest(mx, my)                -- return true if click coordinates are within bounds
flip()                         -- begin the lift animation, change state
setAnimal(salamander)          -- place an animal under this object
getAnimal()                    -- return the animal (or null)
isChecked()                    -- has this been flipped already
```

**Interactions:**
- Created by: `ForestEnvironment.generateTransect()`
- Click-tested by: `BatesianMimicrySim.handleCanvasClick()`
- Rendered by: `TransectRenderer`
- Animal assigned by: `EventEngine` (at flip time)

**Implementation notes:**
- Visual design per type:
  - **Rock:** irregular rounded polygon in grays (`--ink-faint` to `--ink-light` range), slight shadow underneath
  - **Log:** elongated rectangle with bark texture, brown tones (`--bark`), ring pattern on the cross-section end
  - **Bark:** thin irregular shape, curled edges, lighter brown
  - **Board:** clean rectangle, wood grain pattern, right angles (human-placed cover board)
- Lift animation: 200-300ms transform. The object shifts up and to the side, revealing the ground underneath. If an animal is present, the animal renders in the revealed space
- After checking, the cover object stays visually "lifted" with a dimmed appearance to indicate it's been checked. Player can't re-click it

### 4.5 FieldNotebook.js

**Extends:** `DataCollector`

**Responsibilities:**
- Display collected survey data in a field-notebook-styled table
- Provide an interactive entry form when recording a new observation
- Auto-populate fields from the found animal and environment
- Validate entries before committing
- Export complete survey data as CSV

**Columns:**
```
Entry #, Cover Obj, Obj Type, Species ID, Correct?, SVL (mm),
Total Length (mm), Mass (g), Sex, Age Class, Substrate, Moisture, Notes
```

**Key methods:**
```
constructor()                      -- set columns and experiment name
mount(container)                   -- build the notebook UI
openEntryForm(animal, coverObj)    -- switch to entry mode with auto-populated fields
closeEntryForm()                   -- switch back to read mode
validateEntry(formData)            -- check required fields
commitEntry(formData)              -- call record() and close form
getSpeciesSummary()                -- aggregate counts by species
getMimicModelRatio()               -- calculate mimic:model from recorded data
```

**Interactions:**
- Created by: `BatesianMimicrySim`
- Opened by: `BatesianMimicrySim.onIdentified()` after successful species ID
- Data consumed by: `AnalysisPanel`

**Implementation notes:**
- The entry form auto-populates: entry number (sequential), cover object number, object type, species (from ID challenge result), GPS coordinates (from cover object position mapped to transect coordinates). The player manually enters: SVL, total length, mass, sex, age class, substrate moisture, notes
- In a real field survey, the student would measure the animal. Here we can either (a) show the animal at a measured scale and let the player estimate, or (b) provide measurement tools in the UI (a ruler overlay). Option (b) is more pedagogically valuable but higher implementation complexity. Start with (a) -- auto-populate the "true" values from the animal's generated traits, then in a later iteration add measurement uncertainty
- The notebook panel sits below or beside the canvas. When in entry mode, it expands and the canvas may shrink or the form may overlay. Use CSS transitions for smooth open/close

### 4.6 FieldSetup.js

**Extends:** `ConfigScreen`

**Responsibilities:**
- Present survey setup parameters before the simulation begins
- Let the player choose date, habitat conditions, and difficulty settings

**Parameters:**
```
surveyDate         -- date picker or select (affects species activity)
transectLength     -- range: 25, 50, 100 meters
coverObjectCount   -- range: 10-50 (how many objects to place)
habitat            -- select: deciduous-forest, mixed-forest, stream-edge
weatherOverride    -- select: auto (based on date), clear, overcast, rain
difficulty         -- select: guided (hints on), standard, expert (no hints, time limit)
showMeasurements   -- checkbox: auto-populate measurements vs. manual entry
timeLimit          -- number: minutes (0 = unlimited), dependsOn difficulty=expert
```

**Key methods:**
```
getParams()     -- return the parameter definitions above
```

**Interactions:**
- Created by: the entry point (index.html script or BatesianMimicrySim bootstrap)
- Passes config to: `BatesianMimicrySim` constructor via `onStart` callback

**Implementation notes:**
- The `dependsOn` feature from `ConfigScreen` works well here: `timeLimit` depends on `difficulty === 'expert'`. But the current `dependsOn` implementation only supports checkbox toggles (boolean). May need to extend it for select-based dependencies, or handle it with a custom `mount()` override
- Survey date affects which species are active. Red-spotted newts in the red eft stage are most common in summer. Red salamanders are active year-round but peak in spring/fall. This creates natural variation in mimic:model ratios across seasons -- a key experimental variable

### 4.7 EventEngine.js

**Does not extend a base class** -- standalone module.

**Responsibilities:**
- Determine what (if anything) is under a cover object when the player flips it
- Use probabilistic models based on species ecology, environmental conditions, season, and habitat
- Generate individual `Salamander` instances with realistic trait distributions
- Track encounter history to maintain ecologically plausible spatial patterns

**Key methods:**
```
constructor(config, environment)    -- initialize species pools and probabilities
generateEncounter(coverObject)      -- return a Salamander instance or null
getBaseEncounterRate()               -- probability of finding any animal
getSpeciesProbabilities()            -- weighted species distribution
adjustForConditions(baseProbs)       -- modify based on weather, temperature, etc.
generateTraits(speciesConfig)        -- random traits from species distributions
getEncounterHistory()                -- return record of all encounters so far
```

**Species encounter probability model:**
```
P(animal under object) = baseRate * weatherMod * temperatureMod * moistureMod * habitatMod

If animal present:
  P(species_i) = speciesWeight_i / sum(allWeights)
  
  where speciesWeight is influenced by:
    - season (activity patterns)
    - habitat preference
    - cover object type preference (some species prefer rocks, others logs)
    - density (configured mimic:model ratio)
```

**Interactions:**
- Created by: `BatesianMimicrySim`
- Called by: `BatesianMimicrySim.flipCoverObject()` to generate encounters
- Receives environmental data from: `ForestEnvironment`
- Produces: `Salamander` instances

**Implementation notes:**
- The mimic:model ratio is the key experimental variable. The EventEngine takes the configured ratio and translates it into species weights. For example, if the ratio is 3:1 mimics-to-models, the red salamander (mimic) weight is 3x the eastern newt (model) weight
- Base encounter rates should feel realistic. In a real cover board survey, you might find an animal under 20-40% of objects in good conditions, 5-15% in poor conditions. Empty flips are part of the experience
- The engine should also occasionally produce non-target species (worms, beetles, other salamander species like slimy salamanders or dusky salamanders) to add realism and make identification non-trivial. These get a simple "not target species -- note and release" flow rather than the full ID challenge
- Important: encounters are generated at flip time, not pre-placed. This avoids needing to store a full grid of animals and allows the probability model to be condition-dependent. It also means the actual realized mimic:model ratio will vary from the configured ratio due to random sampling -- which is itself a teaching moment about sampling vs. true population parameters

### 4.8 IdentificationChallenge.js

**Does not extend a base class** -- standalone UI component.

**Responsibilities:**
- Present the found animal at a large scale for identification
- Show species options with key distinguishing features
- Evaluate the player's selection and provide feedback
- Track identification accuracy across the survey

**Key methods:**
```
constructor(container)             -- create the modal DOM structure
show(animal)                       -- display the challenge for a given animal
hide()                             -- close the modal
onSubmit(callback)                 -- register handler for when player submits ID
getAccuracyStats()                 -- return { correct, incorrect, total, accuracy }
reset()                            -- clear stats
destroy()                          -- remove DOM elements
```

**UI structure:**
```
+--------------------------------------------------+
|  What species is this?                           |
|                                                  |
|  [Large canvas rendering of the animal]          |
|                                                  |
|  Key features to examine:                        |
|  - Body color and shade                          |
|  - Spot pattern (bordered? scattered? rows?)     |
|  - Skin texture (smooth? granular?)              |
|  - Tail cross-section                            |
|                                                  |
|  ( ) Red-spotted Newt (Notophthalmus v.)         |
|  ( ) Red Salamander (Pseudotriton ruber)         |
|  ( ) Northern Dusky Salamander (Desmognathus)    |
|  ( ) Other / Unknown                             |
|                                                  |
|  [Submit Identification]                         |
+--------------------------------------------------+
```

**Interactions:**
- Created by: `BatesianMimicrySim`
- Shown by: `BatesianMimicrySim.onAnimalFound()`
- Emits result to: `BatesianMimicrySim.onIdentified()`

**Implementation notes:**
- The modal renders as an HTML overlay on top of the canvas, not inside the canvas. This keeps text crisp and allows standard form inputs
- The animal illustration in the modal uses a larger `Salamander.renderLarge()` call on a dedicated canvas element inside the modal. This lets us show more detail than the small in-situ rendering on the forest floor
- Difficulty levels affect the challenge:
  - **Guided:** key features are highlighted with labels on the illustration, hint text explains what to look for
  - **Standard:** feature checklist is shown but no hints
  - **Expert:** just the animal and the species options, no feature guidance
- Feedback on incorrect answers: show the correct answer with a brief explanation of the distinguishing features. "This is a Red Salamander. Note the scattered, unbordered spots and smooth skin -- the Red-spotted Newt has spots with distinct black borders arranged in rows."
- Track accuracy per species, not just overall. The analysis phase can use this to discuss how mimicry effectiveness correlates with identification difficulty

### 4.9 WeatherSystem.js

**Does not extend a base class** -- standalone state module.

**Responsibilities:**
- Generate realistic weather conditions for a given date and location
- Provide weather state to the environment and event engine
- Optionally allow weather to shift mid-survey (rain starting, clouds clearing)

**Key methods:**
```
constructor(date, region)           -- generate weather from date/region
getCurrentConditions()              -- return { weather, temperature, humidity, windSpeed, cloudCover }
update(elapsedMinutes)              -- advance weather state (optional transitions)
getWeatherModifier()                -- multiplier for encounter probability
getDescription()                    -- human-readable weather string for HUD
```

**Interactions:**
- Created by: `ForestEnvironment` during initialization
- Queried by: `EventEngine` for encounter probability modifiers
- Displayed by: the field HUD

**Implementation notes:**
- Weather is primarily cosmetic and educational. The main functional impact is on encounter probability -- wet/humid conditions increase surface activity for salamanders; cold or very hot conditions decrease it
- Temperature ranges by season (eastern US deciduous forest):
  - Spring (Mar-May): 8-22 C
  - Summer (Jun-Aug): 18-32 C
  - Fall (Sep-Nov): 5-20 C
- Temperature is generated via `gaussianRandom()` around seasonal means
- Weather states and their encounter modifiers:
  - Clear, dry: 0.7x (salamanders stay deeper)
  - Overcast: 1.0x (baseline)
  - Light rain: 1.4x (increased surface activity)
  - Heavy rain: 1.1x (active but harder to survey)
  - Recent rain (within 24h): 1.3x

### 4.10 TransectRenderer.js

**Does not extend a base class** -- rendering module.

**Responsibilities:**
- Render the top-down forest floor view on the canvas
- Draw cover objects in their current state (covered, lifting, uncovered)
- Draw animals when cover objects are lifted
- Handle visual effects: shadows, leaf litter particles, moisture sheen
- Manage the viewport if the transect is longer than the canvas (scrolling/panning)

**Key methods:**
```
constructor(canvas, ctx)               -- store canvas references
renderFrame(environment, coverObjects, animals, subState)  -- full frame render
drawForestFloor(ctx, w, h, env)        -- background layer
drawTransectMarkers(ctx, w, h, env)    -- transect boundary and distance markers
drawCoverObject(ctx, obj)              -- single cover object
drawAnimal(ctx, animal, x, y)          -- animal at position
drawLiftAnimation(ctx, obj, progress)  -- animated cover lift
setViewport(offsetX, offsetY, zoom)    -- pan/zoom the view
screenToWorld(sx, sy)                  -- convert click coords to world coords
worldToScreen(wx, wy)                  -- convert world coords to canvas coords
```

**Interactions:**
- Created by: `BatesianMimicrySim`
- Called by: `BatesianMimicrySim.render()` every animation frame
- Reads from: `ForestEnvironment`, `CoverObject` array, `Salamander` instances

**Implementation notes:**
- The forest floor is drawn in layers:
  1. Base soil fill (warm brown, slight noise variation)
  2. Leaf litter patches (random ellipses in seasonal colors, semi-transparent)
  3. Moss patches in humid areas (muted green, `--forest-light` at low opacity)
  4. Twig/debris scatter (thin brown lines at random angles)
  5. Transect boundary markers (small flags or stakes at corners)
  6. Cover objects
  7. Animals (only visible on uncovered objects)
  8. Shadow/lighting layer (darken edges if dense canopy)

- For transects longer than the visible canvas, implement horizontal scrolling. The player can click near the edges to scroll, or the view auto-advances to the next unchecked cover object after recording data. A minimap strip along the bottom showing the full transect with dots for objects (green = checked, white = unchecked) aids navigation

- Performance: the forest floor background is largely static. Render it once to an offscreen canvas and blit it each frame. Only re-render the background on resize or viewport change. Cover objects and animals render on top each frame

- Color palette for forest floor (derived from `main.css` design system):
  - Soil: `#8B7355` to `#6b4226` (bark family)
  - Leaf litter: seasonal -- spring `#7c9a5e`, summer `#4a6b3a`, fall `#c4713b` / `#b8860b` (gold)
  - Moss: `--forest-light` (`#52b788`) at 20-30% opacity
  - Shadows: `--shadow` (`rgba(43, 43, 43, 0.08)`)

### 4.11 AnalysisPanel.js

**Does not extend a base class** -- standalone UI component.

**Responsibilities:**
- Present collected survey data for post-survey analysis
- Guide the player through analytical questions about their data
- Render charts: species frequency bar chart, mimic:model ratio visualization, identification accuracy
- Provide interactive statistical tests (chi-square for frequency comparisons)
- Compare results against Batesian mimicry predictions

**Key methods:**
```
constructor(container)                -- create the analysis UI
load(notebookData, encounterHistory)  -- ingest data from the survey
renderSpeciesChart()                  -- bar chart of species counts
renderRatioAnalysis()                 -- mimic:model ratio with expected vs. observed
renderAccuracyBreakdown()             -- ID accuracy by species
renderFrequencyTest()                 -- chi-square or similar statistical test
mount(container)                      -- build and display the analysis panel
destroy()                             -- clean up DOM
```

**Interactions:**
- Created by: `BatesianMimicrySim`
- Receives data from: `FieldNotebook` and `EventEngine` encounter history
- Rendered in: the main container, replacing the canvas view

**Implementation notes:**
- The analysis phase replaces the canvas with an HTML-based analysis interface. The canvas can be hidden or repurposed for chart rendering
- Key analytical questions to guide the player through:
  1. "What was the ratio of mimics to models in your survey?"
  2. "How does this compare to the ratio you configured?"
  3. "Is the difference statistically significant?" (chi-square test)
  4. "Based on your data, would you expect Batesian mimicry to be effective at this ratio?"
  5. "What would happen if the mimic:model ratio increased further?"
- Charts should use the same canvas rendering approach as the HW sim's stacked area chart -- draw directly on canvas, same font stack, same color conventions from the design system
- The analysis panel should encourage the player to run multiple surveys at different ratios and compare results. A "Run Another Survey" button resets to the config screen

### 4.12 config.js

**Standalone module** -- constants and species data.

**Responsibilities:**
- Define species data for all five animal systems
- Store default configuration values
- Define color palettes for rendering
- Store probability distribution parameters for trait generation

**Structure:**
```javascript
export var DEFAULTS = {
    transectLength: 50,          // meters
    coverObjectCount: 24,
    habitat: 'deciduous-forest',
    mimicModelRatio: 1.0,        // 1:1 default
    difficulty: 'standard',
    showMeasurements: true,
    timeLimit: 0                 // unlimited
};

export var SPECIES = {
    'red-spotted-newt': {
        commonName: 'Red-spotted Newt',
        scientificName: 'Notophthalmus viridescens',
        role: 'model',
        toxic: true,
        svlRange: { mean: 45, sd: 5, min: 35, max: 55 },
        totalLengthRange: { mean: 95, sd: 12, min: 70, max: 120 },
        massRange: { mean: 3.5, sd: 0.8, min: 1.5, max: 6 },
        coloration: {
            body: '#cc4422',     // bright orange-red
            spots: '#cc2200',    // red spots
            spotBorder: '#111',  // black borders
            belly: '#f0c040'     // yellow belly
        },
        spotPattern: 'bordered-rows',
        skinTexture: 'granular',
        tailShape: 'keeled',
        seasonalActivity: { spring: 0.6, summer: 0.8, fall: 0.5, winter: 0.1 },
        habitatPreference: { 'deciduous-forest': 0.8, 'mixed-forest': 0.6, 'stream-edge': 0.9 },
        coverPreference: { rock: 0.3, log: 0.8, bark: 0.5, board: 0.7 }
    },
    'red-salamander': {
        commonName: 'Red Salamander',
        scientificName: 'Pseudotriton ruber',
        role: 'mimic',
        toxic: false,
        svlRange: { mean: 57, sd: 7, min: 45, max: 70 },
        totalLengthRange: { mean: 125, sd: 18, min: 95, max: 160 },
        massRange: { mean: 8, sd: 2, min: 4, max: 14 },
        coloration: {
            body: '#b83a1f',     // darker red-orange
            spots: '#222',       // dark scattered spots
            spotBorder: null,    // no bordered spots
            belly: '#e8a060'     // pale orange belly
        },
        spotPattern: 'scattered',
        skinTexture: 'smooth',
        tailShape: 'round',
        seasonalActivity: { spring: 0.8, summer: 0.5, fall: 0.7, winter: 0.2 },
        habitatPreference: { 'deciduous-forest': 0.7, 'mixed-forest': 0.7, 'stream-edge': 1.0 },
        coverPreference: { rock: 0.6, log: 0.5, bark: 0.4, board: 0.6 }
    }
    // Additional species for other animal systems added later
};

export var COVER_OBJECT_WEIGHTS = {
    'deciduous-forest': { rock: 0.25, log: 0.35, bark: 0.25, board: 0.15 },
    'mixed-forest':     { rock: 0.30, log: 0.30, bark: 0.20, board: 0.20 },
    'stream-edge':      { rock: 0.40, log: 0.25, bark: 0.15, board: 0.20 }
};

export var WEATHER_MODIFIERS = {
    clear:     { encounter: 0.7, label: 'Clear skies' },
    overcast:  { encounter: 1.0, label: 'Overcast' },
    lightRain: { encounter: 1.4, label: 'Light rain' },
    heavyRain: { encounter: 1.1, label: 'Heavy rain' }
};

export var COLORS = {
    soil:        '#8B7355',
    soilDark:    '#6b4226',
    leafGreen:   '#7c9a5e',
    leafFall:    '#c4713b',
    moss:        '#52b788',
    rock:        '#999',
    log:         '#8B6914',
    water:       '#a8dadc',
    transect:    '#bc4749'
};
```

**Implementation notes:**
- Species data is based on published field guides and herpetological literature. Measurement ranges are approximate and sourced from species accounts
- The config module is the single source of truth for biological parameters. No magic numbers elsewhere in the codebase
- Additional animal systems (viceroy/monarch, kingsnake/coral snake, hoverfly/wasp, zone-tailed hawk/turkey vulture) follow the same data structure. Each system has its own model and mimic species, measurement distributions, coloration specs, and habitat preferences. These can be added incrementally without changing the engine

---

## 5. Rendering Approach

### 5.1 Canvas vs. HTML Split

The sim uses a mixed rendering approach:

**Canvas (forest floor):**
- Forest floor background (soil, leaves, moss, debris)
- Transect boundary markers
- Cover objects (all states)
- Salamander illustrations
- Lift animations
- Minimap navigation strip
- Ambient effects (subtle leaf drift particles)

**HTML overlay (UI elements):**
- Field HUD (weather, progress, timer) -- positioned over/beside the canvas
- Identification challenge modal -- centered overlay with backdrop
- Field notebook -- panel below the canvas
- Analysis panel -- replaces canvas in the `analyzing` sub-state
- Tooltips and contextual hints

**Why this split:**
- Canvas handles spatial content that needs to respond to viewport changes and hit-testing in a coordinate system
- HTML handles text-heavy UI that benefits from native form inputs, accessibility, and CSS styling with the design system variables
- Modals and overlays are simpler and more accessible as HTML + CSS than as canvas-rendered elements

### 5.2 Salamander Rendering Strategy

Each species gets a drawing function that produces a recognizable illustration using Canvas 2D paths. These aren't photographs or sprites -- they're programmatic drawings that emphasize the diagnostic features used in field identification.

**Drawing components:**
1. **Body outline** -- elongated ellipse with species-specific proportions (length:width ratio differs between newts and salamanders)
2. **Head** -- slightly wider than neck, rounded snout. Newts have more flattened heads; red salamanders are more rounded
3. **Limbs** -- four small legs, positioned at body quarters. Drawn as simple bent lines with toe suggestions
4. **Tail** -- continuation of body, tapering. Key diagnostic: newts have a laterally compressed (keeled) tail; red salamanders have a round cross-section tail
5. **Coloration** -- fill the body outline with the species base color, then apply variation (slight hue/brightness shift per individual via random offset)
6. **Pattern overlay** -- the most diagnostic feature:
   - Newt: draw bordered spots in roughly parallel rows. Each spot is a filled circle with a concentric ring in `spotBorder` color
   - Red salamander: draw scattered spots without borders. Random placement, no row organization, variable sizes
7. **Eye** -- small circle near the head. Newts have a more prominent eye relative to head size

**Scale:**
- On the forest floor canvas: animals render at roughly 40-60px long (enough to see color and general shape, but detail is limited)
- In the ID challenge modal: animals render at 200-300px long on a dedicated canvas, with all diagnostic features clearly visible

### 5.3 Design System Integration

All non-canvas UI elements use the CSS variables from `main.css`:

- Backgrounds: `--parchment`, `--parchment-warm`
- Text: `--ink`, `--ink-light`, `--ink-faint`
- Borders: `--border`, `--border-light`
- Accents: `--forest` (primary actions), `--ocean-light` (links), `--rust` (warnings/incorrect)
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` classes
- Typography: `--font-heading` for titles, `--font-body` for text, `--font-mono` for data values
- Spacing: `--space-xs` through `--space-xxl`
- Shadows: `--shadow`, `--shadow-md` for depth
- Border radius: `--radius`, `--radius-lg`

Canvas rendering mirrors these values where possible -- chart axes in `--ink`, grid lines in `--parchment-dark`, data labels in `--font-mono`.

---

## 6. Event Flow

### 6.1 Main Interaction Loop

```
1. SURVEY ACTIVE (subState: 'surveying')
   │
   ├── Player sees forest floor with cover objects
   ├── Player clicks a cover object
   │
   ├── 2. HIT TEST
   │   ├── Click misses all objects → ignore
   │   └── Click hits a cover object →
   │       ├── Object already checked → ignore (visual feedback: flash border)
   │       └── Object unchecked → continue
   │
   ├── 3. FLIP ANIMATION (200-300ms)
   │   ├── Cover object state → 'lifting'
   │   ├── Object slides up and aside, revealing ground underneath
   │   └── EventEngine.generateEncounter() runs during animation
   │
   ├── 4. ENCOUNTER RESULT
   │   ├── null (nothing found) →
   │   │   ├── Show empty ground with substrate detail
   │   │   ├── Mark object as checked
   │   │   ├── Update progress counter
   │   │   └── Stay in 'surveying'
   │   │
   │   ├── non-target species (beetle, worm, etc.) →
   │   │   ├── Show brief illustration
   │   │   ├── Display "Non-target species — noted"
   │   │   ├── Mark object as checked
   │   │   └── Stay in 'surveying'
   │   │
   │   └── target species (salamander) →
   │       ├── Render animal at cover object position
   │       ├── Transition to 'identifying'
   │       └── Show IdentificationChallenge modal
   │
   ├── 5. IDENTIFICATION (subState: 'identifying')
   │   ├── Player examines the enlarged animal
   │   ├── Player selects a species
   │   ├── Player clicks "Submit Identification"
   │   │
   │   ├── CORRECT →
   │   │   ├── Green feedback flash
   │   │   ├── Record accuracy
   │   │   ├── Transition to 'recording'
   │   │   └── Open FieldNotebook entry form
   │   │
   │   ├── INCORRECT →
   │   │   ├── Red feedback flash
   │   │   ├── Show correct answer with distinguishing features
   │   │   ├── Record accuracy
   │   │   ├── Player clicks "Continue" →
   │   │   │   ├── Transition to 'recording' (still record the observation)
   │   │   │   └── Species field auto-filled with correct answer
   │   │
   │   └── SKIP →
   │       ├── Record as "unidentified"
   │       ├── Mark object as checked
   │       └── Return to 'surveying'
   │
   ├── 6. DATA RECORDING (subState: 'recording')
   │   ├── FieldNotebook entry form is open
   │   ├── Auto-populated: entry #, cover obj #, obj type, species, GPS
   │   ├── Player enters: measurements, sex, age class, notes
   │   ├── Player clicks "Save Entry" →
   │   │   ├── Validate required fields
   │   │   ├── Commit record via DataCollector.record()
   │   │   ├── Close entry form
   │   │   ├── Mark cover object as checked
   │   │   ├── Update progress counter
   │   │   └── Transition to 'surveying'
   │
   ├── 7. CHECK COMPLETION
   │   ├── All objects checked? → transition to 'reviewing'
   │   ├── Time limit reached? → transition to 'reviewing'
   │   ├── Player clicks "End Survey"? → confirm dialog → 'reviewing'
   │   └── Otherwise → loop back to step 1
   │
   ├── 8. REVIEW (subState: 'reviewing')
   │   ├── Summary panel:
   │   │   ├── Objects checked: 24/24
   │   │   ├── Animals found: 8
   │   │   ├── Species breakdown: 3 newts, 4 red salamanders, 1 dusky
   │   │   ├── ID accuracy: 6/8 correct (75%)
   │   │   ├── Mimic:model ratio (observed): 4:3
   │   │   ├── Mimic:model ratio (configured): 1:1
   │   │
   │   ├── Options:
   │   │   ├── [Download CSV] → triggers FieldNotebook.download()
   │   │   ├── [Proceed to Analysis] → transition to 'analyzing'
   │   │   └── [Run Another Survey] → reset to 'setup'
   │
   └── 9. ANALYSIS (subState: 'analyzing')
       ├── AnalysisPanel loads survey data
       ├── Guided questions walk through interpretation
       ├── Interactive charts and statistics
       ├── Options:
       │   ├── [Run Another Survey] → reset to 'setup'
       │   └── [Finish] → transition to engine 'complete' state
```

### 6.2 Timing

- Cover object flip animation: 250ms
- ID challenge: no time limit (unless expert mode -- 30 seconds)
- Data recording: no time limit
- Survey time limit (expert mode): configurable, default 20 minutes
- Ambient animation frame rate: 60fps via requestAnimationFrame (render-only loop)

### 6.3 Keyboard Shortcuts

For accessibility and efficiency:

- `Space` or `Enter` -- flip highlighted cover object (tab-navigable)
- `1-4` -- select species option in ID challenge
- `Enter` -- submit ID / save record
- `Escape` -- skip identification / cancel entry
- `Arrow keys` -- navigate between cover objects (when surveying)
- `Tab` -- cycle through notebook form fields (when recording)

---

## 7. What NOT to Modify in the Engine

The following files are off-limits for modification:

- `sim/engine/Simulation.js`
- `sim/engine/Environment.js`
- `sim/engine/Agent.js`
- `sim/engine/DataCollector.js`
- `sim/engine/HUD.js`
- `sim/engine/ConfigScreen.js`
- `sim/engine/utils.js`

Everything is done through subclassing and composition. If a base class method doesn't fit, override it entirely in the subclass. If a base class component (like HUD) doesn't match the use case, build a new component from scratch instead of forcing inheritance.

The engine's state machine (`setup -> running -> paused -> complete`) is not modified. The sim manages its own sub-states within `running`. The `paused` state still works naturally -- if the engine is paused, the render loop stops and no click handlers fire. Resuming returns to whatever sub-state was active.

---

## 8. Open Questions and Future Considerations

### Resolved Design Decisions

1. **Cover objects as Agents?** -- No. Cover objects are part of the environment, not agents. They don't have behavior in the biological sense. `ForestEnvironment` owns them, `TransectRenderer` draws them.

2. **Pre-placed vs. generated encounters?** -- Generated at flip time. This is cleaner (no hidden state grid), more flexible (conditions can affect probability dynamically), and more realistic (models real sampling uncertainty).

3. **HUD reuse?** -- No. The HUD's transport controls are irrelevant. Build a custom field HUD from scratch.

### Still Open

1. **Multi-survey persistence.** Should data from multiple surveys accumulate in a session? The analysis phase would be richer if the player can compare results across 3-4 surveys at different mimic:model ratios. This requires either browser localStorage or an in-memory store that persists across sim resets. Leaning toward in-memory: a `SessionManager` that holds an array of completed survey datasets.

2. **Measurement interaction.** V1 auto-populates measurements from the animal's generated traits. V2 could add a ruler tool where the player measures the animal on screen and enters their own values -- comparing player-measured vs. true values adds measurement error as a teaching concept. Defer to V2.

3. **Additional animal systems.** The architecture supports multiple mimic-model systems via the `config.js` species data structure. The red salamander / eastern newt system is the pilot. Butterfly, snake, hoverfly, and hawk systems add new rendering functions and species configs but don't change the engine architecture. Build the first system end-to-end before adding others.

4. **Sound design.** Forest ambiance (birdsong, rain, rustling leaves) would add immersion. The engine has no audio system. This would be a new module -- `AmbientAudio.js` -- that manages Web Audio API playback keyed to weather state and sub-state transitions. Low priority but high impact on the field experience.

5. **Transect viewport scrolling.** For long transects (50+ cover objects), the canvas can't show everything at once. Need to decide between: (a) horizontal scroll with click-to-scroll edges, (b) drag-to-pan, (c) click minimap to jump. Option (a) is simplest. Option (b) feels most natural but conflicts with click-to-flip interaction. Consider (a) with minimap for overview.

6. **Mobile support.** The existing engine sizes the canvas responsively. Touch events need to be mapped to click handlers. The field notebook form needs to work on small screens. Not a launch blocker but needs consideration -- `ConfigScreen` and `DataCollector` are already responsive via CSS.
