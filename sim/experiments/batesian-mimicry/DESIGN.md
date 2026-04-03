# Batesian Mimicry Field Survey Simulation -- Design Document

**System:** *Pseudotriton ruber* (Red Salamander) mimicking the red eft stage of *Notophthalmus viridescens* (Eastern Newt)
**Setting:** Appalachian hardwood forest, mid-elevation (600--1000m)
**Duration:** 45--60 min data collection + 15--30 min analysis

---

## 1. Simulation Flow

The student plays a field researcher surveying salamanders along transects. Four phases:

### Phase 1: Field Setup (3--5 min)

Config screen (`FieldSetup` extends `ConfigScreen`). Student selects:

| Parameter | Type | Default | Range | Notes |
|-----------|------|---------|-------|-------|
| Survey month | select | May | Mar--Oct | Drives seasonal modifiers |
| Survey day | number | 15 | 1--28 | Combined with month for weather gen |
| Site | select | Cove Hardwood | Cove Hardwood / Mixed Oak / Stream Corridor | Affects species composition |
| Cover objects per transect | range | 40 | 20--60 | More = longer session |
| Number of transects | select | 2 | 1--3 | Each is a sub-session |
| ID feedback | select | Deferred | Immediate / Deferred | When correct ID is revealed |
| Tutorial | checkbox | on | -- | Guided hints for first 3 objects |
| Forced encounters | checkbox | on | -- | Guarantee >= 1 mimic and 1 model |

Weather is auto-generated from date. Student sees conditions before confirming.

### Phase 2: Survey (20--25 min per transect, 40--50 min for 2 transects)

Core loop:
1. Canvas shows top-down forest floor with cover objects (rocks, logs, boards, bark)
2. Student clicks an unchecked cover object
3. Object lifts (250ms animation)
4. EventEngine determines what's underneath:
   - **Nothing/invertebrates** (55--60%): brief flavor text, object marked checked, move on
   - **Salamander** (35--40%): animal appears, transitions to ID challenge
   - **Snake** (~0.5%): safety event -- replace cover, note location, continue
   - **Egg clutch** (~0.8%): educational note, replace carefully
5. If salamander found: ID challenge modal appears
6. Student identifies species from options
7. Feedback (immediate or deferred based on config)
8. Field notebook entry form opens -- student records measurements
9. Save entry, return to surveying

Between transects: brief transition screen showing transect 2 setup (different microhabitat).

### Phase 3: Data Review (3--5 min)

Summary of the survey session:
- Cover objects checked vs total
- Animals found by species
- Data completeness check -- any missing fields flagged
- ID accuracy revealed (if deferred mode)
- Mimic:model ratio from observations
- Option to download CSV

### Phase 4: Analysis (5--10 min)

Guided questions the student answers with their data:
- Calculate mimic:model ratio
- Compare observed species frequencies to published baselines
- Chi-square goodness-of-fit test (guided walkthrough)
- Interpret results in context of frequency-dependent selection
- Identify sources of error

---

## 2. Encounter System

### 2.1 Cover Object Contents

Base probabilities per flip:

| Outcome | P | Notes |
|---------|---|-------|
| Empty / invertebrates only | 0.60 | Fast interaction, 2--3 sec |
| One salamander | 0.30 | Core encounter |
| Two salamanders | 0.07 | Often conspecifics |
| Three+ salamanders | 0.02 | Aggregation near prime spots |
| Snake (ring-neck or copperhead) | 0.008 | Special event |
| Other herp | 0.002 | Skink, toad -- flavor |

### 2.2 Species Table

Given a salamander is found, P(species):

| Species | Key | P | Role |
|---------|-----|---|------|
| Plethodon cinereus | PLCI | 0.58 | Common background |
| Plethodon glutinosus | PLGL | 0.13 | Common background |
| Desmognathus fuscus | DEFU | 0.10 | Stream-associated |
| Eurycea bislineata | EUBI | 0.07 | Stream-associated |
| Notophthalmus viridescens (eft) | NOVI | 0.04 | MODEL |
| Pseudotriton ruber | PSRU | 0.03 | MIMIC |
| Desmognathus monticola | DEMO | 0.02 | Uncommon |
| Gyrinophilus porphyriticus | GYPO | 0.01 | Rare |
| Other | OTHER | 0.02 | Special event |

### 2.3 Modifiers

All modifiers stack multiplicatively on the base 0.30 salamander probability.

**Seasonal** (applied to base encounter rate):

| Month | Multiplier |
|-------|-----------|
| Mar | 0.40 |
| Apr | 0.75 |
| May | 1.00 |
| Jun | 0.90 |
| Jul | 0.45 |
| Aug | 0.40 |
| Sep | 0.70 |
| Oct | 0.85 |

**Weather** (compound from temperature, precip, humidity, cloud cover):

| Condition | Modifier |
|-----------|---------|
| Currently raining (light) | x1.50 |
| Rain in past 24h | x1.40 |
| 7+ dry days | x0.55 |
| Temp 12--16C (optimal) | x1.00 |
| Temp 25--30C | x0.35 |
| Humidity > 90% | x1.25 |
| Overcast | x1.15 |
| Clear/sunny | x0.85 |

**Time of day**:

| Window | Modifier |
|--------|---------|
| 05:00--07:00 | x1.15 |
| 07:00--10:00 | x1.10 |
| 10:00--13:00 | x0.85 |
| 13:00--16:00 | x0.80 |

**Microhabitat** (species composition shift, not overall rate):

Stream-edge objects: Desmognathus x2.5, Eurycea x2.5, P. ruber x1.8, P. cinereus x0.5
Rotting log: Red eft x1.2, P. ruber x1.1
Natural rock: Red eft x0.7

Compound probability is clamped at 0.75 max. Under excellent conditions (May, morning, rain yesterday, 14C, overcast) the rate hits ~0.61. Under poor conditions (August, midday, dry, 28C) it drops to ~0.01.

### 2.4 Forced Encounters

When enabled (default), the engine guarantees at least 1 NOVI and 1 PSRU per session by reserving two random object positions in the second half of the transect. If the student has already found both species naturally, the reserved slots generate normally instead.

### 2.5 Spatial Autocorrelation

Cover objects get a quality score Q drawn from Beta(2, 5) at transect generation. Q multiplies the base encounter probability. ~15--20% of objects are "hot spots" with Q > 0.7. Q is correlated among neighboring objects within 10m (Gaussian process).

---

## 3. Species Identification Challenge

### 3.1 Interface

HTML modal overlay. Shows:
- Large canvas rendering of the animal (200--300px)
- Feature checklist (guided/standard/expert difficulty)
- Radio buttons for species selection
- Submit button

### 3.2 Species Options

Contextual -- not all 8 species every time:
- **Red/orange animal found**: Red Eft, Red Salamander, Spring Salamander, "Other"
- **Dark animal found**: Red-backed Sal, Slimy Sal, Dusky Sal, Two-lined Sal, "Other"
- **Unusual**: full species list

### 3.3 Distinguishing Features (Red Eft vs Red Salamander)

The core pedagogical challenge:

| Feature | Red Eft (NOVI) | Red Salamander (PSRU) |
|---------|---------------|----------------------|
| Skin texture | Rough, granular | Smooth, moist |
| Costal grooves | Absent | 16--18, visible |
| Tail shape | Laterally compressed, slight keel | Round cross-section |
| Body proportions | Compact, large head | Elongated, small head |
| Eye | Dark iris | Gold/yellow iris with dark bar |
| Spot pattern | Black-bordered red spots in rows | Irregular black spots, scattered |
| Size (typical) | 35--85mm TL | 110--180mm TL (overlap in young) |
| Behavior | Slow, deliberate, unfazed | Freeze, coiled defensive posture |

Young P. ruber (SVL < 50mm) are the hardest -- bright red, few spots, close to eft size. The simulation correlates SVL with ID difficulty.

### 3.4 Feedback Modes

- **Immediate**: correct/incorrect shown after each ID, with feature explanation
- **Deferred**: no feedback until the review phase. More realistic -- in the field you carry uncertainty

### 3.5 Accuracy Tracking

The sim tracks:
- Correct IDs per species
- Total accuracy rate
- Which features the student examined (if guided mode)
- Common confusion pairs

---

## 4. Field Notebook

### 4.1 Architecture

`FieldNotebook` extends `DataCollector`. Inherits CSV export and row storage. Overrides the UI to provide an interactive entry form.

### 4.2 Columns

```
Entry #, Time, Cover Obj #, Obj Type, Species ID, ID Confidence,
SVL (mm), Total Length (mm), Mass (g), Sex, Age Class,
Substrate Moisture, Air Temp (C), Notes
```

Hidden columns (not shown to student, used in analysis):
```
True Species, ID Correct, Animal ID
```

### 4.3 Entry Form

When recording an observation:
- **Auto-populated**: Entry #, Time, Cover Obj #, Obj Type, Species (from ID challenge)
- **Student enters**: SVL, Total Length, Mass, Sex (M/F/Unknown), Age Class (Adult/Subadult/Juvenile), Substrate Moisture (Dry/Damp/Wet/Saturated), Notes
- **Validation**: SVL must be within plausible range for identified species. Mass must be positive. All required fields must be filled.

V1: measurements auto-populate from the animal's generated traits (student sees them and can adjust). This simulates "you measured the animal and got these values."

### 4.4 UI Style

Styled like a Rite in the Rain field notebook:
- Cream background with faint blue horizontal rules
- Monospace font for data values
- Compact layout to show many rows
- Scrollable table for completed entries
- Entry form appears as a highlighted row at the bottom

---

## 5. Analysis Phase

### 5.1 Summary Statistics

Auto-calculated from the field notebook:
- Total cover objects checked
- Occupancy rate (objects with animals / total)
- Species encounter counts and relative frequencies
- Mimic:model ratio (PSRU count : NOVI count)
- Mean SVL and mass by species
- ID accuracy rate

### 5.2 Visualizations

Canvas-rendered charts matching the HW sim style:
- **Species frequency bar chart**: horizontal bars, one per species, sorted by count
- **Mimic:model ratio dial**: visual representation of where the observed ratio falls relative to the theoretical breakdown threshold (~1:1)

### 5.3 Guided Questions

Presented sequentially, student enters answers:

1. What is the mimic:model ratio from your data? [auto-calculated, student interprets]
2. Perform a chi-square test comparing your species frequencies to expected values [guided: expected values provided, student fills in the calculation]
3. At what ratio does theory predict mimicry breaks down? How does your ratio compare?
4. Identify 3 sources of error in your data
5. How might your results differ in a different season?

### 5.4 Data Export

Download CSV button available at review and analysis phases. Filename format:
`batesian-mimicry_YYYY-MM-DD_HHmmss.csv`

---

## 6. File-by-File Implementation Plan

### Core Files (implement in order)

```
sim/experiments/batesian-mimicry/
```

**1. config.js** -- No dependencies. Species data, probability tables, color palettes, measurement distributions, weather parameters. Single source of truth for all biological constants.

**2. WeatherSystem.js** -- Depends on config.js. Generates weather from date/region. Returns conditions and encounter modifiers. Standalone module, no base class.

**3. EventEngine.js** -- Depends on config.js, WeatherSystem. Probabilistic encounter generator. Takes environmental state + cover object properties, returns an encounter result (null, invertebrate, Salamander instance, special event). Standalone module.

**4. Salamander.js** -- Depends on config.js. Extends Agent. Generates traits from species distributions. Renders at two scales (forest floor and ID challenge). Key methods: `render()`, `renderLarge()`, `getIdentifyingFeatures()`.

**5. CoverObject.js** -- Depends on config.js. Standalone class. Position, type, visual state, hit-test, flip animation state. Key methods: `render()`, `hitTest()`, `flip()`.

**6. ForestEnvironment.js** -- Depends on config.js, WeatherSystem, CoverObject. Extends Environment. Holds forest state, owns cover object array, generates transect layout. Renders forest floor background.

**7. FieldSetup.js** -- Depends on config.js. Extends ConfigScreen. Overrides `getParams()` with survey setup parameters. No deep dependencies.

**8. IdentificationChallenge.js** -- Depends on config.js, Salamander. Standalone UI component. HTML modal. Shows animal, collects ID, provides feedback, tracks accuracy.

**9. FieldNotebook.js** -- Depends on config.js. Extends DataCollector. Interactive entry form + read-only table. CSV export. Key override: `mount()` to build custom UI.

**10. AnalysisPanel.js** -- Depends on config.js, FieldNotebook data. Standalone UI. Summary stats, charts, guided questions. Rendered in HTML, charts on canvas.

**11. BatesianMimicrySim.js** -- Depends on everything above. Extends Simulation. Orchestrates the full flow. Manages sub-states within the engine's `running` state. Handles canvas clicks, wires events between components.

### Supporting Files

**12. Entry point integration** -- Wire into `experiments/batesian-mimicry/index.html`. Replace "Coming Soon" button with launch script that imports and runs BatesianMimicrySim.

---

## 7. Engine Extensions

**None.** All base classes remain unmodified. Everything is done through subclassing and composition.

### How the Base Classes Map

| Base Class | Extension | Notes |
|------------|-----------|-------|
| Simulation | BatesianMimicrySim | Override start() for render-only loop. Manage sub-states within `running`. tick() is a no-op. |
| Environment | ForestEnvironment | State keys: date, season, temperature, humidity, weather. Owns CoverObject array. render() draws forest floor. |
| Agent | Salamander | Traits: species, svl, mass, coloration, spotPattern. render() draws the animal. Not pre-placed -- generated at flip time by EventEngine. |
| DataCollector | FieldNotebook | Override mount() for interactive entry form. Inherits record(), toCSV(), download(). |
| ConfigScreen | FieldSetup | Override getParams() for survey setup parameters. |
| HUD | NOT USED | Build custom FieldHUD from scratch -- transport controls are irrelevant. |
| utils.js | USED AS-IS | gaussianRandom for measurements, weightedChoice for species, shuffle for transect layout. |

### Sub-State Machine

The engine sees: `setup -> running -> complete`. Within `running`, the sim manages:

```
surveying -> identifying -> recording -> surveying (loop)
surveying -> reviewing -> analyzing -> complete
```

Transitions are method calls on BatesianMimicrySim, not engine state changes. The sim emits `subStateChange` events for UI coordination.

---

## 8. Rendering Architecture

### Canvas Layer (forest floor)

Rendered in layers, bottom to top:
1. Soil base fill (warm brown with subtle noise)
2. Leaf litter patches (seasonal colors -- spring green, fall orange/gold)
3. Moss patches in moist areas (forest-light at 20% opacity)
4. Twig/debris scatter (thin brown lines)
5. Transect boundary markers (flagging tape stakes)
6. Cover objects (typed shapes: rock=irregular gray, log=brown rectangle, board=clean rectangle)
7. Animals (only on uncovered objects)
8. Hover highlight on clickable objects

Background is pre-rendered to offscreen canvas once, re-rendered on resize. Only cover objects and animals update per frame.

### HTML Overlay Layer

Positioned over/beside the canvas via CSS:
- **Field HUD** (top): weather icon + temp + humidity, survey progress (12/40 objects), elapsed time
- **ID Challenge modal** (center): backdrop + card with animal canvas + species selector
- **Field Notebook** (below canvas): scrollable entry table + entry form
- **Analysis Panel** (replaces canvas): charts + questions + summary

### Salamander Rendering

Canvas 2D path drawing. Each species has a `drawSpecies(ctx, x, y, scale, traits)` function:
- Body: elongated ellipse, species-specific proportions
- Head: rounded, width varies by species
- Limbs: 4 bent lines with toes
- Tail: tapered continuation, shape varies (keeled vs round)
- Color: base fill from species config, individual variation via hue/saturation offset
- Spots: species-specific pattern (bordered rows for eft, scattered for P. ruber)
- Eyes: colored dot (dark for eft, gold for P. ruber)

Two render scales:
- Forest floor: 40--60px body length (color + shape visible, fine detail not)
- ID challenge: 200--300px body length (all diagnostic features visible)

### Design System

All HTML UI uses CSS variables from main.css:
- Backgrounds: `--parchment`, `--parchment-warm`
- Text: `--ink`, `--ink-light`
- Accents: `--forest` (primary), `--rust` (warnings/incorrect), `--forest-light` (correct)
- Buttons: `.btn .btn-primary`, `.btn-secondary`, `.btn-ghost`
- Typography: `--font-heading` for titles, `--font-body` for text, `--font-mono` for data
- Canvas elements mirror these colors

---

## 9. Animal Size Distributions

All drawn via gaussianRandom(mean, sd), clamped to range:

| Species | SVL mean (mm) | SVL SD | SVL range | Mass mean (g) | Mass SD | Mass range |
|---------|--------------|--------|-----------|--------------|---------|------------|
| P. cinereus | 40 | 5 | 28--54 | 1.0 | 0.3 | 0.3--2.0 |
| P. glutinosus | 65 | 8 | 45--85 | 5.5 | 1.8 | 2.5--11.0 |
| D. fuscus | 42 | 6 | 28--58 | 2.5 | 1.0 | 0.8--5.5 |
| E. bislineata | 37 | 4 | 27--48 | 1.2 | 0.4 | 0.4--2.5 |
| N. viridescens (eft) | 38 | 4 | 28--48 | 1.8 | 0.5 | 0.8--3.0 |
| P. ruber | 58 | 10 | 35--80 | 5.0 | 2.0 | 1.5--12.0 |
| D. monticola | 55 | 7 | 38--72 | 4.0 | 1.5 | 1.5--8.0 |
| G. porphyriticus | 65 | 10 | 40--90 | 6.0 | 2.5 | 2.0--14.0 |

---

## 10. Behavior on Discovery

| Species | Response | Speed | Notes |
|---------|----------|-------|-------|
| P. cinereus | Freeze 1--3s, then slow crawl | Slow | Tail undulation display |
| P. glutinosus | Freeze 1--2s, moderate crawl | Moderate | Sticky skin secretion |
| D. fuscus | Brief freeze, rapid escape/jump | Fast | Will leap off rocks |
| E. bislineata | Brief freeze, quick escape to water | Fast | Enters crevices |
| N. viridescens (eft) | Stand still, slow deliberate walk | Very slow | Toxic -- doesn't need to flee. Unken reflex posture. |
| P. ruber | Prolonged freeze 3--10s | Very slow | Coiled defensive posture -- mimicry behavior |

---

## 11. Edge Cases and Special Events

| Event | P (per object) | Season | Effect |
|-------|---------------|--------|--------|
| P. cinereus egg clutch | 0.008 | Jun--Aug | Educational note, replace carefully |
| Copperhead | 0.005 | Apr--Oct | Safety pause, replace cover, mark location, continue |
| Ring-neck snake | 0.015 | Mar--Oct | Brief surprise, non-venomous |
| Predation in progress | 0.001 | Any | Memorable observation event |
| Dead salamander | 0.005 | Any | Desiccation/disease indicator |

| Event | P (per survey) | Effect |
|-------|---------------|--------|
| Rain starts mid-survey | 0.10--0.17 | Detection rates improve, flavor text |
| GPS battery dies | 0.02 | Data quality flag |
| Camera fogs | 0.05 | Brief delay |
| Animal escapes before ID | 0.03 | Partial data only -- teaches technique |

---

## 12. Assessment Integration

### Pre-Lab (assigned before sim)
7 questions priming frequency-dependent selection, mimicry types, field methods

### During-Sim Checkpoints
- After first dual encounter (both species seen)
- After misidentification (feature feedback)
- Mid-survey data check
- After copperhead encounter (safety)
- End of transect (completeness check)

### Post-Lab Analysis
10 guided questions covering ratio calculation, chi-square test, descriptive stats, error sources, seasonal variation, frequency-dependent selection interpretation

### Common Misconceptions Addressed
1. Teleological thinking ("the mimic is trying to...")
2. Batesian vs Mullerian confusion
3. Binary thinking about mimicry effectiveness
4. Ignoring predator learning as the driver
5. Assuming models and mimics are closely related
6. "More mimics = better" (opposite for Batesian)
7. Assuming field data is clean
