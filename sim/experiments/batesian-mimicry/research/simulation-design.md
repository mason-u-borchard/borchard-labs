# Batesian Mimicry Field Survey Simulation -- Design Research

**Experiment:** Salamander Batesian Mimicry in Appalachian Forests  
**System:** *Pseudotriton ruber* (Red Salamander) mimicking *Notophthalmus viridescens* (Eastern Newt, red eft stage)  
**Platform:** borchardlabs.com simulation engine (vanilla JS + Canvas)  
**Date:** 2026-04-03

---

## 1. Biological Background

### The Mimicry System

The red eft -- the terrestrial juvenile stage of the Eastern Newt (*Notophthalmus viridescens*) -- is conspicuously orange-red and produces tetrodotoxin, making it highly unpalatable to predators. The Red Salamander (*Pseudotriton ruber*) is a Batesian mimic that benefits from resembling the toxic eft. Predators that have learned to avoid red efts also avoid red salamanders, even though *P. ruber* is significantly less toxic (it produces pseudotritontoxin, a less potent protein-based secretion -- some literature classifies this as Mullerian rather than purely Batesian, but the differential toxicity makes Batesian the better pedagogical framing).

Both species co-occur in mesic Appalachian forests, particularly near headwater streams and seeps. The mimicry relationship is strongest where efts are common enough to "train" predators.

### Distinguishing Features for ID Challenges

These two species are commonly confused in the field, which is exactly the point for the simulation. Key distinguishing traits:

| Feature | Red Eft (*N. viridescens*) | Red Salamander (*P. ruber*) |
|---|---|---|
| Size | 3.5--8.5 cm total length | 10--18 cm total length |
| Skin texture | Rough, granular, dry-looking | Smooth, moist, glossy |
| Body shape | Slender, paddle-shaped tail | Stout, short tail with ~16 costal grooves |
| Dorsal color | Bright orange to orange-red | Red to orange-red, darkening with age |
| Spots | Small red spots ringed in black, scattered | Black spots, irregular, no ring pattern |
| Eye color | Yellow iris | Yellow iris (similar -- not a reliable differentiator) |
| Belly | Yellow-orange, finely spotted | Lighter, pinkish, mottled |
| Chin | Clean | Often dark/melanistic |

The simulation should require students to evaluate at least 2--3 of these features to make a confident ID. Older red salamanders get duller and darker, making them easier to distinguish from efts -- younger ones are the tricky IDs.

### Appalachian Salamander Community (Cover Object Surveys)

A realistic survey in central Appalachian mixed hardwood forest will encounter a predictable assemblage. Species probability table for the simulation:

| Species | Relative Abundance | Notes |
|---|---|---|
| *Plethodon cinereus* (Eastern Red-backed Salamander) | ~70--80% of animals found | Overwhelmingly dominant. Lead-backed morph should appear sometimes. |
| *Plethodon glutinosus* (Northern Slimy Salamander) | ~8--12% | Large, dark, distinctive. Easy ID. |
| *Desmognathus ochrophaeus* (Allegheny Mountain Dusky Salamander) | ~5--8% | Near streams. Can be tricky to ID. |
| *Desmognathus fuscus* (Northern Dusky Salamander) | ~2--4% | Streamside habitats. |
| *Eurycea bislineata* (Northern Two-lined Salamander) | ~2--3% | Yellow with dark lateral stripes. Near water. |
| *Pseudotriton ruber* (Red Salamander) | ~1--2% | THE MIMIC. Uncommon but present. |
| *Notophthalmus viridescens* (Eastern Newt, red eft) | ~1--3% | THE MODEL. Terrestrial juveniles found under cover. |
| *Gyrinophilus porphyriticus* (Spring Salamander) | <1% | Large, salmon-pink. Near springs. |

Non-salamander finds under cover objects (for realism and surprise):
- Nothing (50--60% of cover objects are empty)
- Invertebrates -- millipedes, beetles, slugs, centipedes, earthworms (common, flavor text only)
- Ringneck snake (*Diadophis punctatus*) -- rare but startling
- American toad (*Anaxyrus americanus*) -- occasional
- Redback salamander egg clutch -- rare, seasonal

---

## 2. User Experience Flow

### Narrative Arc of a Field Day

The simulation follows the structure of an actual field survey day, condensed for a ~60--75 minute session (45--60 minutes for data collection, 10--15 for setup and analysis).

**Phase 1: Site Setup (Interactive but streamlined, ~5 minutes)**
- Student selects survey date from a calendar (month/day matters -- spring and fall are peak, summer is slow, winter is dead)
- Weather conditions are presented based on the date (temperature, recent rainfall, cloud cover, humidity)
- Student can choose to proceed or pick a different date (teaching: weather affects detection probability)
- Student sets up transect layout: choose from 2--3 site options with different habitat characteristics (distance to stream, canopy cover, slope aspect)
- Brief orientation text with a site map and instructions

**Phase 2: Survey (Fully interactive, ~45--60 minutes)**
- Core gameplay loop: approach cover object -> flip it -> scan what's underneath -> identify any animals -> record data -> move to next object
- 30--50 cover objects per transect (mix of cover boards, rocks, logs)
- Time pressure: a visible clock ticking through the survey window (surveys are typically constrained to 2--4 hours of morning or evening activity)
- Weather can change mid-survey (rain starting, temperature shifting)

**Phase 3: Data Review (Interactive but guided, ~5 minutes)**
- Student reviews their field notebook before "leaving the site"
- Prompted to check for missing entries, suspicious values, illegible notes
- Option to flag uncertain IDs
- "Pack up" confirmation

**Phase 4: Lab Analysis (Summarized/guided, ~5--10 minutes)**
- Data summary statistics are calculated
- Student is asked guided questions:
  - What was the relative abundance of each species?
  - How does the mimic-to-model ratio compare to theoretical predictions?
  - Did your misidentification rate affect the data?
  - What would happen to the mimic if the model declined?
- Comparison against "expected" values (other researchers' data from the same region)
- Final reflection prompt

**Skipped entirely:** Travel to site, permit applications, gear packing, bathroom breaks, detailed equipment calibration. These add nothing to the learning objectives and would make students quit.

### The "Feel" of Flipping a Cover Object

This is the core interaction and needs to feel tactile and slightly tense. Sequence:

1. **Approach.** The student clicks a cover object on the canvas. A brief animation shows it being lifted (the object visually tilts/shifts). Maybe 0.3s.
2. **Reveal.** What's underneath fades in over ~0.5s. Usually nothing but soil and leaf litter. Sometimes invertebrates (cosmetic). Sometimes a salamander. Occasionally two animals. Very rarely a snake (which should be startling -- a different visual treatment).
3. **Quick scan.** If a salamander is present, the student gets a brief look -- maybe 2--3 seconds of a "field view" before the ID challenge pops up. This simulates the real moment of "what is that?" before you grab your field guide.
4. **Identification challenge.** A panel slides in (HTML overlay, not Canvas) showing a closer view of the animal with selectable features: size estimate, skin texture, spot pattern, body shape. Student makes their ID call from a species dropdown or set of options.
5. **Measurement recording.** If they identified it, they need to record: species, SVL (snout-vent length -- select from a reasonable range), total length, sex (if determinable), age class, microhabitat notes. They type/select these values. Nothing is auto-filled.
6. **Replace the cover object.** The student clicks "replace cover" to put the object back (as per protocol -- you always replace what you flip). This closes the interaction and advances the transect.

The critical design point: **empty cover objects should feel routine and fast.** Flip, see nothing, move on in 1--2 seconds. The rhythm of mostly-nothing punctuated by occasional finds is what makes the finds feel meaningful. Do not add unnecessary UI steps to empty flips.

---

## 3. Interface Paradigm

### Hybrid Canvas + HTML Approach

The engine's Canvas handles the spatial, visual world. HTML/CSS overlays handle structured data entry and text-heavy UI. This matches the existing engine pattern and avoids trying to do form inputs in Canvas.

**Canvas layer (the forest floor):**
- Top-down view of the transect area
- Leaf litter texture as the base layer (procedural -- randomized brown/tan/amber shapes, not a photographic tile)
- Cover objects scattered across the transect: cover boards (rectangular, grey-brown), rocks (irregular dark shapes), logs (elongated dark brown)
- Each cover object is clickable. Hover state shows a subtle highlight or cursor change.
- A faint transect line or numbered markers showing the survey path
- Weather overlay: rain effect (simple falling lines), fog/mist (reduced opacity overlay), sun/shade patterns from canopy

**HTML overlay layer:**
- **Field notebook panel** (right side or bottom): Always visible. Shows the running data table of recorded observations. Styled like a ruled field notebook page -- cream background, blue lines, handwriting-style font for headers.
- **ID challenge panel** (center modal): Appears when a salamander is found. Shows the animal illustration/description on the left, input fields on the right. Has a countdown or urgency cue (the animal won't stay still forever).
- **Weather/conditions bar** (top): Shows current time, temperature, humidity, cloud cover. Updates as the survey progresses.
- **Progress indicator** (top or bottom): "Cover object 14 of 42" or similar. Gives a sense of how much survey remains.
- **HUD controls** (adapted from engine): Pause, speed controls (for advancing through empty stretches faster if desired -- though this risks breaking immersion).

### Forest Floor Visual Design

The forest floor does not need to be photorealistic. A stylized, readable top-down view is better than a cluttered photographic mess. Key principles:

- **Readability over realism.** The student needs to quickly identify which objects are cover objects (clickable) vs. background (leaf litter, sticks, small rocks).
- **Visual variety.** Cover objects should vary in size, shape, and type. A board looks different from a rock looks different from a log. This trains the student to recognize different cover object types, which is a real field skill.
- **Spatial realism.** Objects should be spaced 5--15 m apart along the transect (scaled to canvas). Not in a grid -- scattered naturally with some clustering near streams or rock outcrops.
- **Seasonal cues.** Spring: green understory, some wildflowers. Fall: orange/red/brown leaf litter. This reinforces the date selection.

### Species Illustration Style

For the ID challenge, each salamander species needs a clear visual representation. Options:

- **Stylized illustrations** (preferred): Clean line art with accurate markings, colored to show key diagnostic features. This forces students to look at the right things rather than pattern-matching against a photograph.
- **Multiple views**: Dorsal (default) plus ventral and lateral views accessible by clicking "flip" or "side view" buttons.
- **Variable appearance**: Each individual should have slight randomization in color intensity, spot count, and size to prevent students from memorizing a single reference image.

---

## 4. Engine Architecture Adaptations

### Event-Driven vs. Generation-Based Ticking

The Hardy-Weinberg sim uses generation-based ticking: each tick advances one generation, the loop runs automatically, and the student watches the simulation unfold. The mimicry sim inverts this. Each tick is a student action, not a time step.

**Tick model:** One tick = one cover object interaction (approach + flip + ID/record + replace). The game loop does not auto-advance. It waits for the student to click the next cover object.

This means the Simulation base class needs one of two adaptations:

**Option A -- Override the loop entirely.** The MimicryFieldSim subclass doesn't call `start()` in the traditional sense. Instead, it runs `render()` on every frame for visual updates (weather effects, hover states, animations) but only calls `tick()` in response to player input. The tick counter tracks "number of cover objects checked."

**Option B -- Use the existing loop for rendering, emit custom events for actions.** The rAF loop runs continuously for animations and visual polish, but the tickCount only increments when the student completes a cover object interaction. This keeps the engine's render loop alive for smooth visuals while decoupling logical ticks from time.

Option B is cleaner and doesn't require engine modifications. The sim would:
- Override `tick()` to be a no-op (or only handle time-based updates like weather)
- Implement a separate `advanceSurvey()` method triggered by player actions
- Increment `tickCount` manually when a cover object interaction completes
- Use the existing event system (`emit('tick')`) to notify the HUD and data collector

### State Machine for Interaction Flow

The survey has more complex state than the HW sim. A state machine within the sim:

```
SETUP -> SURVEYING -> (per cover object: APPROACHING -> REVEALING -> IDENTIFYING -> RECORDING -> REPLACING) -> REVIEWING -> ANALYZING -> COMPLETE
```

The inner loop (APPROACHING through REPLACING) repeats for each cover object. The sim needs to track:
- Which cover objects have been checked
- Current phase of the interaction
- Running observation data
- Time elapsed in the survey
- Weather state
- Student accuracy (for scoring)

### Environment Subclass: ForestFloor

Extends `Environment`. Holds:
- Cover object array with positions, types, and hidden contents (pre-generated at init based on config)
- Weather state (temperature, humidity, precipitation, cloud cover) -- can shift over time
- Time of day (advances with each cover object checked)
- Season/date from config
- Detection probability modifier (calculated from weather + time + season)
- Species abundance table (from config, modified by environmental conditions)

### Agent Subclass: Salamander

Extends `Agent`. Represents a single animal found under a cover object. Traits:
- `species`: the true species identity
- `svl`: snout-vent length (mm), drawn from species-specific normal distribution
- `totalLength`: total length (mm)
- `sex`: M/F/unknown
- `ageClass`: adult/juvenile/eft (for newts)
- `colorIntensity`: 0--1, affects visual appearance and ID difficulty
- `spotPattern`: specific to species, with individual variation
- `difficulty`: how hard this individual is to correctly identify (function of species, age, color)

The student never sees the true `species` until the analysis phase (or as immediate feedback, depending on pedagogical mode).

### Data Collector: FieldNotebook

Extends `DataCollector`. Columns:
- Cover Object # 
- Cover Object Type (board/rock/log)
- Student's Species ID
- SVL (mm) -- student-entered
- Total Length (mm) -- student-entered
- Sex
- Age Class
- Time
- Temperature
- Humidity
- Notes

The field notebook should also track "true" species and whether the ID was correct, but this data is hidden until the analysis phase.

---

## 5. Realism Features Assessment

### What MATTERS (include in simulation)

**Species misidentification as a real risk.**
This is the core educational mechanic. The red eft and red salamander look similar enough that misidentification is a genuine problem in real surveys, and iNaturalist research shows that even experienced naturalists misidentify look-alikes at nontrivial rates. In the simulation:
- Some individuals are easy (large adult *P. ruber* vs. small eft -- size alone distinguishes them)
- Some are hard (young *P. ruber* that is small, bright, and hasn't developed a dark chin yet)
- Misidentifications corrupt the student's dataset, which they discover during analysis
- The simulation should track and reveal their accuracy rate at the end

**Weather affecting detection probability.**
Real salamander detection probability is strongly influenced by moisture and temperature. Research shows optimal detection at ~12.6 C soil temperature with recent rainfall. In the simulation:
- Warm, dry days: fewer animals found under cover (lower detection probability)
- Cool, moist days after rain: more animals active on the surface and under cover
- Rain during the survey: detection goes up, but working conditions go down (wet notebook, harder to handle animals)
- This teaches students that sampling effort and conditions affect results -- survey data is not a census

**Manual data recording.**
Students must type or select values for each observation. Nothing auto-populates. This is intentionally slower than it could be and mirrors the reality of field data collection. It also creates opportunities for transcription errors, which are real.

**Realistic find ratios.**
~55% of cover objects are empty. ~75% of animals found are *P. cinereus*. Red salamanders and efts are uncommon. The student should feel the tedium of repeated empty flips and *P. cinereus* finds before the excitement of finding a mimic or model. This teaches the reality of fieldwork: most of it is routine.

**Time of day and seasonal effects.**
Spring and fall surveys yield more detections. Morning surveys are better than midday. Midsummer is hot and dry -- low detection. Picking the wrong date is a learning moment, not a dead end (the survey still runs, just with fewer finds).

**Checking data before leaving.**
A real field researcher reviews their notebook before packing up. The simulation prompts the student to review their entries and flags obviously problematic values (e.g., a 200mm SVL for a species that maxes out at 80mm). This teaches data quality control.

### What to SKIP

- Travel to site, driving, hiking in
- Permit applications, IACUC protocols (mention in intro text, don't simulate)
- Detailed gear packing (assume the student has their equipment)
- Bathroom breaks, lunch, applying sunscreen, bug spray
- Extremely detailed microhabitat measurements (slope angle in degrees, canopy cover percentage to decimal precision, soil pH) -- streamline to broad categories
- GPS coordinates for each cover object (pre-assigned)
- Photographing every animal (mention the protocol, don't simulate the camera workflow)
- Marking/PIT-tagging animals for recapture studies
- Multi-day survey schedules (one survey day per session)

---

## 6. Engagement Hooks

### Running Tally

The field notebook accumulates visibly. A counter in the HUD shows: "Observations: 7 | Cover Objects Checked: 23/42 | Time Remaining: 1:34:22". The growing observation count provides low-key satisfaction. The ratio of observations to objects checked teaches encounter rates intuitively.

### Identification Uncertainty

When finding a red/orange salamander, the simulation should elevate tension:
- A brief alert cue (subtle sound or visual flash -- "you found something unusual")
- The ID challenge for mimics/models should be harder than for common species -- more features to evaluate, more ambiguity in the illustration
- After the student commits to an ID, the simulation could give immediate feedback ("Are you sure? This animal has rough, granular skin...") or defer feedback entirely to the analysis phase. Deferred feedback is more realistic but immediate feedback is better pedagogy. Offer both as a config option.

### Lab Analysis Payoff

The analysis phase is the reward for an hour of data collection. The student sees:
- Their species accumulation curve
- Mimic:model ratio from their data vs. theoretical prediction
- Their misidentification rate (if using deferred feedback mode)
- How weather conditions affected their detection rates compared to "ideal" conditions
- A chi-square or similar test comparing their observed species frequencies against expected community composition

This is where the educational content crystallizes. The tedium of data collection pays off when the student can actually analyze what they gathered and see the mimicry pattern (or fail to see it, if they picked a bad survey day or misidentified too many animals).

### Surprises

Monotony needs punctuation. Distributed unpredictably across the survey:
- Finding a ringneck snake (unexpected, interesting, quick "oh cool" moment)
- Finding two salamanders under the same cover object (a real occurrence -- sometimes a *P. cinereus* pair or a *P. cinereus* with a *Desmognathus*)
- Weather changing mid-survey (rain starting -- detection probability shifts)
- An egg clutch (seasonal, educational moment about reproductive ecology)
- A particularly large or unusually-colored individual (e.g., a lead-backed *P. cinereus* morph)
- A spring salamander (*Gyrinophilus porphyriticus*) -- large, pink, and rare enough to feel exciting

### Field Notebook Score

At the end of the survey, evaluate the student's field notebook on:
- **Completeness**: Did they fill in all fields for every observation?
- **Accuracy**: How many species IDs were correct? (revealed in analysis)
- **Consistency**: Are measurement values within plausible ranges for identified species?
- **Protocol adherence**: Did they check all cover objects? Did they replace each one?

This gives a concrete metric without gamifying the experience into something unrecognizable. Frame it as "data quality assessment," not "your score."

---

## 7. Tedium Calibration

### Target Session Length

- **Setup phase:** 3--5 minutes
- **Survey phase:** 45--60 minutes
- **Data review:** 3--5 minutes
- **Analysis:** 5--10 minutes
- **Total:** ~60--75 minutes

This fits a standard college lab period with time for instructor introduction and discussion.

### Cover Object Density and Contents

For a single transect of 40 cover objects:

| Outcome | Count | Percentage |
|---|---|---|
| Empty (soil, leaf litter, invertebrates) | 22--24 | 55--60% |
| *Plethodon cinereus* | 10--12 | 25--30% |
| *Plethodon glutinosus* | 1--2 | 2.5--5% |
| *Desmognathus* spp. | 1--2 | 2.5--5% |
| *Eurycea bislineata* | 0--1 | 0--2.5% |
| *Pseudotriton ruber* (the mimic) | 1--2 | 2.5--5% |
| *Notophthalmus viridescens* (red eft) | 1--2 | 2.5--5% |
| Ringneck snake or other non-salamander | 0--1 | 0--2.5% |

These numbers are drawn from real Appalachian cover-board survey data, with the mimic/model frequencies slightly boosted from natural rates (~1--2% each) to ensure the student encounters at least one of each per session. A 40-object transect with natural 1% encounter rates would mean a ~33% chance of finding zero red salamanders, which is realistic but pedagogically useless.

### Pacing

- **Empty cover objects:** 3--5 seconds each (click, see nothing, move on). Fast and routine.
- **Common species (*P. cinereus*):** 30--60 seconds each (flip, see animal, quick ID, record measurements). Should become faster as the student gets comfortable.
- **Uncommon/tricky species:** 60--120 seconds each (flip, see animal, careful ID evaluation, record measurements, maybe re-examine features). The mimic/model encounters should feel like they take real thought.
- **Surprises (snake, egg clutch):** 15--30 seconds (brief event, no full data recording required for non-target species).

At these rates, a 40-object transect takes roughly:
- 23 empties x 4 sec = ~90 sec
- 11 common species x 45 sec = ~500 sec
- 3 uncommon x 90 sec = ~270 sec
- 1 surprise x 20 sec = ~20 sec
- Overhead (reading, thinking, looking at notebook) = ~300 sec
- **Total: ~1180 sec = ~20 minutes**

That's shorter than the target. Two options:
1. **Two transects** per session (80 cover objects total, ~40 minutes of survey time). This also teaches replication.
2. **Increase per-object time** by making data recording more detailed. But this risks genuine frustration.
3. **Add brief travel time between objects** -- a 3--5 second walk animation/transition. Adds ~2 minutes per transect of passive time, which also builds the spatial feeling of moving through the forest.

Option 1 (two transects) is best. It doubles the data, teaches replication, and lets the student compare results between sites. The second transect could be at a different habitat type (closer to stream vs. upslope) to show how community composition shifts with microhabitat.

### Boredom vs. Engagement Curve

The session should follow this emotional arc:

```
Engagement
    ^
    |   *                                           * * *
    |  * *        *     *                         *       *
    | *   *      * *   * *     *       *        *           *
    |*     *    *   * *   *   * *     * *      *
    |       *  *     *     * *   *   *   *   *
    |        **             *     * *     * *
    |                              *
    +----------------------------------------------------> Time
    Setup  [Empty Empty Empty Pcin Empty Pcin Empty MIMIC!] [Transect 2...]  Analysis
```

Early novelty ("oh this is how the interface works") drops into routine ("another *P. cinereus*..."), then spikes when something interesting appears, then drops again, then spikes at the analysis reveal. The routine stretches are not a bug -- they teach the student what fieldwork actually feels like, and they make the interesting finds feel earned.

---

## 8. Educational Simulation Precedents and Lessons

### What Works in Existing Ecology Simulations

**Calangos (Loula et al., 2014):** An ecology game simulating lizard behavior in Brazilian sand dunes. Its strength is grounding gameplay in a real ecological system with real species, not abstractions. The simulation models actual ecological relationships (predation, thermoregulation, resource competition) and lets the player discover them through interaction. Lesson: **use the real system, not a simplified analogy.** Our simulation should use real species names, real morphological features, real survey protocols.

**Tyto Ecology:** Ecosystem builder that teaches food webs and trophic structure. Works well for conceptual understanding but feels like a toy because the student is a god-figure placing animals in a landscape. Lesson: **first-person perspective creates engagement that top-down management can't.** Our student is a field researcher in the mud, not an omniscient ecosystem designer.

**iNaturalist / eBird as training tools:** These platforms succeed because identification is an intrinsically satisfying skill. The "am I right?" feedback loop is addictive. iNaturalist's community ID system -- where multiple observers converge on an identification -- mirrors the scientific process of consensus. Lesson: **identification challenges are inherently engaging when the stakes are clear** (your data quality depends on getting this right).

### What Falls Flat

- **Simulations that skip the boring parts entirely.** If every flip reveals something interesting, the student doesn't learn that fieldwork involves a lot of nothing. The ratio of tedium to excitement is itself educational content.
- **Simulations that over-gamify.** Points, achievements, leaderboards, and time-pressure mechanics that don't map to real scientific practice. A field researcher doesn't get "combo bonuses" for identifying three salamanders in a row. The motivation should come from curiosity and data quality, not extrinsic rewards.
- **Simulations with no consequence for errors.** If misidentifying a species has no effect on the final analysis, there's no reason to be careful. Errors need to propagate through the data and visibly affect conclusions.
- **Tutorials that don't let go.** The first 2--3 cover objects can have guidance ("Notice the rough skin texture -- this is a red eft"). After that, the student should be on their own. Persistent hand-holding undercuts the learning.

### Common Pitfalls to Avoid

1. **The "museum diorama" problem.** If the forest floor looks too perfect and arranged, it feels artificial. Introduce visual noise -- fallen twigs, leaf debris, patches of moss -- that don't do anything functionally but make the scene feel like a real place.
2. **Instant feedback undermining the point.** If the simulation immediately tells students whether their ID was right, it becomes a quiz app. The power of fieldwork simulation is that you carry uncertainty with you through the survey and reconcile it later. Offer deferred feedback as the default mode, with immediate feedback as a training-wheels option.
3. **Overcomplicated UI.** The field notebook should look like a field notebook, not an enterprise database form. Minimal dropdowns, minimal chrome. If the UI looks more complicated than a real Rite in the Rain notebook, it's overdesigned.
4. **Ignoring the null result.** Empty cover objects need to be logged too (or at least counted). This is real protocol and teaches the concept of survey effort vs. detection.

### Citizen Science Platform Lessons

**iNaturalist's approach to data quality:**
- Research-grade observations require agreement between multiple identifiers
- The platform tracks observation quality (photo quality, location accuracy, date accuracy) separately from identification accuracy
- Misidentification rates vary wildly by taxon -- 92% accuracy for well-known plants, much worse for cryptic or look-alike species
- Key insight: **the system assumes errors will happen and builds error-correction into the workflow** rather than trying to prevent all errors upfront

**eBird's protocol structure:**
- Standardized survey protocols (stationary count, traveling count, incidental observation)
- Effort data (duration, distance, number of observers) is required alongside species data
- Flagging system for unusual observations (rare species, high counts)
- Key insight: **effort data is as important as observation data.** Our simulation should make students record survey effort (time, conditions, number of objects checked) alongside species data.

---

## 9. Config Screen Parameters

The config screen (extending `ConfigScreen`) should offer:

**Core parameters:**
- Survey date (month/day selector -- determines season, weather baseline, species activity)
- Site selection (2--3 options with different habitat descriptions and distances to water)
- Number of cover objects per transect (default: 40, range: 20--60)
- Number of transects (default: 2, range: 1--3)

**Difficulty/pedagogy toggles:**
- ID feedback mode: "Immediate" (tells you after each ID) vs. "Deferred" (reveals at analysis) vs. "Realistic" (never tells you -- you'd need to verify against a reference collection)
- Tutorial mode: First 3 cover objects have guidance overlays (default: on)
- Weather variability: Fixed (conditions stay constant) vs. Dynamic (weather can change mid-survey)

**Advanced (hidden behind an "Advanced" toggle):**
- Custom species abundance table
- Detection probability modifier
- Forced encounters (guarantee the student finds at least 1 mimic and 1 model)
- RNG seed for reproducibility (useful for assignments where all students should get the same data)

---

## 10. Technical Implementation Notes

### What Can Use the Existing Engine As-Is

- `Simulation` base class: lifecycle management, canvas setup, resize handling, event system, speed control
- `Environment` base class: state management, update/render hooks
- `Agent` base class: ID system, traits, position
- `DataCollector` base class: table rendering, CSV export, row management
- `ConfigScreen` base class: parameter form generation
- `HUD` base class: controls, stats display (though the "Generation" label needs to become "Cover Objects Checked" or similar)
- `utils.js`: all of it -- `randomFloat`, `randomInt`, `weightedChoice`, `gaussianRandom`, `shuffle`

### What Needs New Implementation

- **ForestFloor environment**: Canvas rendering of the transect, cover object placement, weather state management, detection probability calculations
- **Cover object interaction system**: Click handling on canvas objects, the flip/reveal animation sequence, the state machine managing each interaction
- **ID challenge panel**: HTML overlay that presents the animal and collects the student's identification. This is the most complex new UI component.
- **Field notebook panel**: Extending DataCollector with manual input fields instead of auto-populated rows. The student fills in each row themselves.
- **Weather system**: Date-based weather generation, dynamic changes during the survey, visual effects on the canvas
- **Analysis phase**: Summary statistics, charts comparing observed vs. expected, accuracy reveal, guided questions
- **Salamander illustration system**: Rendering or displaying species with individual variation for the ID challenge

### Rendering Approach

The forest floor canvas should use layered rendering:
1. **Background layer**: Leaf litter texture (can be pre-rendered to an offscreen canvas for performance)
2. **Object layer**: Cover objects at their positions. Checked objects get a visual change (slightly displaced, lighter color, maybe a small "checked" mark).
3. **Highlight layer**: Hover effects on the next clickable object, transect path indicators
4. **Weather layer**: Rain, fog, or lighting effects overlaid on top
5. **Animation layer**: Cover object flip animation, salamander reveal

The HTML overlays (field notebook, ID challenge, weather bar) sit on top of the canvas via CSS positioning. This is the same pattern the HUD already uses.

### Performance Considerations

This simulation is not computationally intensive. There are at most ~60 cover objects to render, no physics, no per-frame agent updates. The main performance concern is:
- Leaf litter texture rendering: pre-render to offscreen canvas once, then blit
- Rain animation: simple particle system, cap at ~100 particles
- Resize handling: re-render the offscreen canvas on resize (already handled by the engine's ResizeObserver)

---

## 11. Open Questions

1. **Sound design.** Should the simulation have audio? Forest ambience, the thunk of flipping a board, rain sounds? Audio adds immersion but also adds development scope and accessibility concerns (needs to work without sound too). Probably worth doing minimally -- ambient forest loop, one flip sound, rain sound.

2. **Multiplayer/comparative mode.** Could multiple students survey the same site and compare results? This would powerfully demonstrate observer bias and sampling variability. But it's a significant infrastructure addition. Table for v2.

3. **Multi-session campaigns.** Could a student survey the same site across multiple dates (spring and fall) and see seasonal patterns? This would teach temporal replication. Would require data persistence across sessions. Table for v2.

4. **Instructor dashboard.** Instructors probably want to see aggregate student performance -- who finished, who didn't, accuracy rates, common misidentifications. This is outside the simulation itself but worth considering in the platform architecture.

5. **Accessibility.** The Canvas-based forest floor needs keyboard navigation as an alternative to mouse clicks. Cover objects should be tab-navigable. The ID challenge panel (HTML) is naturally more accessible. Color choices for species illustrations need to work for colorblind students -- do not rely on red/green distinction alone for the mimic/model ID.

6. **Mobile support.** Touch interactions instead of mouse hover/click. The canvas and overlay approach should work on tablets. Phone screens are probably too small for the split view (forest floor + notebook). Minimum viable target: landscape tablet and desktop.
