# Event Engine: Probabilistic Encounter System

## Design Reference for the Batesian Mimicry Field Simulation

This document specifies the probability distributions, modifiers, and parameter tables
that drive encounter generation in the simulated Appalachian forest transect survey.
Every value is grounded in published field data or reasonable inference from the primary
literature on plethodontid salamander ecology. Where a range is given, the simulation
should sample from it -- not use the midpoint -- to preserve realistic variance.

---

## 1. Encounter Generation

### 1.1 Cover Object Contents

When a student flips a cover object, the system rolls against the following base
probabilities for what is found underneath:

| Outcome | Probability | Notes |
|---------|-------------|-------|
| Empty (no visible fauna) | 0.08 | Nothing at all -- uncommon because invertebrates are nearly ubiquitous |
| Invertebrates only | 0.52 | Beetles, ants, earthworms, centipedes, slugs, spiders, millipedes. Noted in datasheet but not the survey focus. |
| One salamander (+ possible invertebrates) | 0.30 | The core encounter |
| Two salamanders | 0.07 | Often conspecifics; P. cinereus territorial pairs or mother with juvenile |
| Three or more salamanders | 0.02 | Aggregation event -- more common in fall pre-hibernation or at prime microsites |
| Snake | 0.008 | See edge cases (Section 7) |
| Other herp (skink, small frog, etc.) | 0.012 | Five-lined skink, American toad, wood frog -- incidental |

**Rationale.** Cover board occupancy by P. cinereus averages roughly 0.18--0.25 across
forest types (Margenau et al. 2020, Herpetological Conservation and Biology 15:
234--247). Natural objects produce lower occupancy. A ~30--35% salamander hit rate per
cover object is consistent with mid-density Appalachian populations of ~0.15--0.25
salamanders/m^2 (Mathis et al. 2015, PeerJ 3: e952). Invertebrate presence is near-
universal under moist cover; truly empty objects reflect recent disturbance or very dry
conditions.

### 1.2 Species Probability Table

Given that a salamander is found, the probability that it belongs to each species:

| Species | Common Name | P(species) | Range for Sampling |
|---------|-------------|------------|-------------------|
| Plethodon cinereus | Red-backed Salamander | 0.58 | 0.50--0.65 |
| Plethodon glutinosus complex | Slimy Salamander | 0.13 | 0.10--0.16 |
| Desmognathus fuscus | Northern Dusky Salamander | 0.10 | 0.07--0.13 |
| Eurycea bislineata / E. wilderae | Two-lined / Blue Ridge Two-lined Salamander | 0.07 | 0.05--0.09 |
| Notophthalmus viridescens (red eft) | Eastern Newt (eft stage) | 0.04 | 0.03--0.06 |
| Pseudotriton ruber | Red Salamander | 0.03 | 0.02--0.05 |
| Desmognathus monticola | Seal Salamander | 0.02 | 0.01--0.03 |
| Gyrinophilus porphyriticus | Spring Salamander | 0.01 | 0.005--0.02 |
| Other (rare/unexpected) | Various | 0.02 | 0.01--0.03 |

**Rationale.** P. cinereus is the most abundant vertebrate in eastern North American
forests, with densities of 1,950--34,300 per hectare (median ~10,000/ha) across its
range (Semlitsch et al. 2014, USGS). At Hubbard Brook, New Hampshire, P. cinereus
constituted 93.5% of all terrestrial salamander biomass (Burton & Likens 1975). In
mixed-species Appalachian communities, P. cinereus typically represents 50--70% of all
captures under cover objects, with P. glutinosus second at 10--16% (MacNeil et al. 2011,
USFS GTR-NRS-P-108). Desmognathus spp. are concentrated near streams and seeps,
reducing their representation in upland transects. Red efts and red salamanders are
uncommon finds under cover boards -- efts are more often encountered on the surface
during rain, and P. ruber is genuinely rare relative to plethodontids.

The "Other" category includes: Aneides aeneus (Green Salamander) on rock outcrops,
Plethodon wehrlei (Wehrle's Salamander) at higher elevations, and Hemidactylium
scutatum (Four-toed Salamander) near sphagnum bogs. These are legitimately rare finds
that would warrant special attention in the student's notes.

### 1.3 Microhabitat Modifiers on Species Composition

Not all cover objects produce the same species mix. Apply the following multipliers to
the base species probabilities, then renormalize to sum to 1.0:

| Microhabitat | P. cinereus | P. glutinosus | Desmognathus | Eurycea | Red eft | P. ruber |
|-------------|-------------|---------------|--------------|---------|---------|----------|
| Cover board (baseline) | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| Natural rock | 1.0 | 1.1 | 0.9 | 0.8 | 0.7 | 0.8 |
| Rotting log | 1.1 | 0.9 | 0.8 | 0.7 | 1.2 | 1.1 |
| Stream-edge rock | 0.5 | 0.6 | 2.5 | 2.5 | 0.4 | 1.8 |
| Bark on standing dead | 0.8 | 1.3 | 0.3 | 0.3 | 0.2 | 0.3 |
| Moss-covered rock | 1.0 | 0.9 | 1.2 | 1.0 | 1.5 | 1.3 |

**Rationale.** Desmognathus and Eurycea are stream-associated genera; their capture
rates increase sharply near water. P. glutinosus favors rocky substrates and is more
arboreal than P. cinereus. Red efts and P. ruber are moisture-dependent and more likely
under logs with good moisture retention or near seeps.

---

## 2. Seasonal Modifiers

Surface activity of Appalachian salamanders follows a bimodal pattern driven by
temperature and soil moisture. The simulation applies a seasonal multiplier to the base
encounter probability (the 0.30 salamander detection rate in Section 1.1).

| Month | Activity Multiplier | Ecological Basis |
|-------|-------------------|------------------|
| January | 0.05 | Near-dormancy. Soil frozen or near-freezing. Rare surface activity. |
| February | 0.08 | Late-winter dormancy. Occasional mild days may produce very sparse surface activity. |
| March | 0.40 | Warming begins. Early-season emergence as soil temps approach 8--10C. Spring rains trigger movement. |
| April | 0.75 | Rapid increase. Soil temperatures reach 10--15C. Peak breeding prep for P. cinereus. |
| May | 1.00 | Peak activity. Optimal soil temperature (12--15C at 30 cm depth) and moisture conditions. |
| June | 0.90 | Still high but declining as temperatures rise. Early-summer drying begins. |
| July | 0.45 | Summer suppression. Soil temperatures above optimal range (>18C). Salamanders retreat to deeper refugia. |
| August | 0.40 | Lowest summer activity. Hot and often dry. Mean highs ~27C in Appalachian valleys. |
| September | 0.70 | Fall rebound. Cooling temperatures and autumn rains bring animals back to surface. |
| October | 0.85 | Secondary peak. Excellent conditions. Pre-hibernation feeding and fall courtship in P. cinereus. |
| November | 0.50 | Declining. Cooling rapidly. Activity drops as soil temperature falls below 8C. |
| December | 0.10 | Near-dormancy. Most animals underground. Freezing nights common. |

**Rationale.** Sanchez et al. (2020, Herpetological Conservation and Biology 15:
642--651) showed that P. cinereus surface activity peaks when soil temperature at 30 cm
is approximately 12.6C, with a quadratic decline on either side. The bimodal spring/fall
pattern is well-documented across plethodontid literature. Summer suppression is
particularly strong in southern Appalachian populations near the species' range edge
(Royal Society Open Science 6: 182192). Temperature data based on Appalachia, VA
climate norms: winter lows ~-3C, summer highs ~28C, spring/fall midpoints ~8--18C
(Weather Spark climate data).

### 2.1 Red Eft Seasonal Modifier (Override)

Red efts have a distinctive activity pattern that partially differs from the plethodontid
baseline. They are most conspicuous during warm rains (>12C) and are effectively absent
in cold months. Apply this separate multiplier to the red eft row:

| Month | Eft Multiplier | Notes |
|-------|---------------|-------|
| Jan--Feb | 0.02 | Essentially dormant under deep leaf litter |
| Mar | 0.20 | Occasional early-spring movement |
| Apr--May | 0.80 | Active, especially during rains |
| Jun | 1.00 | Peak dispersal period |
| Jul--Aug | 0.60 | Active on rainy nights, suppressed in dry heat |
| Sep--Oct | 0.90 | Strong fall activity with autumn rains |
| Nov | 0.30 | Declining rapidly |
| Dec | 0.05 | Dormant |

---

## 3. Weather Modifiers

Weather conditions at the time of survey exert strong, well-documented effects on
salamander surface detection. These modifiers stack multiplicatively with the seasonal
baseline.

### 3.1 Precipitation

| Condition | Multiplier | Source/Rationale |
|-----------|-----------|-----------------|
| Currently raining (light) | 1.50 | Strong positive effect on surface activity. Sanchez et al. 2020. |
| Currently raining (heavy) | 1.30 | Slightly less than light rain -- heavy rain can wash animals off surfaces and reduce visibility |
| Rain in past 24 hours | 1.40 | Soil recharge drives emergence. Detection probability at 0.75 cm 2-day cumulative precip was highest (Sanchez et al. 2020). |
| Rain in past 48 hours | 1.25 | Diminishing but still positive |
| 3+ dry days | 0.80 | Moderate drying |
| 7+ dry days | 0.55 | Significant drying. Animals deep underground. |
| 14+ dry days (drought) | 0.35 | Severe reduction. Only deepest cover objects productive. |

### 3.2 Temperature (at Survey Time)

| Condition | Multiplier | Source/Rationale |
|-----------|-----------|-----------------|
| < 2C | 0.15 | Near-freezing. Negligible surface activity. |
| 2--5C | 0.40 | Cold. Very limited activity. |
| 5--8C | 0.65 | Cool. Early-spring / late-fall marginal conditions. |
| 8--12C | 0.90 | Good. Approaching optimal range. |
| 12--16C | 1.00 | Optimal. Peak detection. Matches the 12.6C optimum from Sanchez et al. 2020. |
| 16--20C | 0.85 | Slightly warm. Still good. |
| 20--25C | 0.60 | Warm. Activity declining, especially in sun. |
| 25--30C | 0.35 | Hot. Animals deep. Poor survey conditions. |
| > 30C | 0.20 | Extreme. Survey should probably be canceled. |

### 3.3 Humidity and Cloud Cover

| Condition | Multiplier |
|-----------|-----------|
| Relative humidity > 90% | 1.25 |
| Relative humidity 80--90% | 1.15 |
| Relative humidity 60--80% | 1.00 |
| Relative humidity < 60% | 0.75 |
| Overcast sky | 1.15 |
| Partly cloudy | 1.00 |
| Clear / full sun | 0.85 |

### 3.4 Wind

Wind is a minor factor for cover-board surveys but affects researcher comfort and can
increase evaporation from cover objects.

| Condition | Multiplier |
|-----------|-----------|
| Calm (< 5 km/h) | 1.00 |
| Light breeze (5--15 km/h) | 0.95 |
| Moderate wind (15--30 km/h) | 0.90 |
| Strong wind (> 30 km/h) | 0.80 |

---

## 4. Time-of-Day Modifiers

These apply to daytime cover-object surveys, which is the standard protocol. Surface-
active encounters (e.g., seeing a red eft walking across trail) use a different curve.

### 4.1 Cover Object Survey Detection

| Time Window | Multiplier | Notes |
|-------------|-----------|-------|
| 05:00--07:00 (dawn) | 1.15 | Animals still near surface from nocturnal activity |
| 07:00--10:00 (morning) | 1.10 | Good conditions, cool substrate |
| 10:00--13:00 (midday) | 0.85 | Surface warming, some retreat |
| 13:00--16:00 (afternoon) | 0.80 | Warmest period, lowest detection |
| 16:00--18:00 (late afternoon) | 0.95 | Cooling, animals beginning to surface |
| 18:00--20:00 (dusk) | 1.15 | Strong surface activity resuming |

### 4.2 Surface Encounter Detection (Red Efts on Trail, etc.)

| Time Window | Multiplier |
|-------------|-----------|
| Daytime, dry | 0.20 |
| Daytime, raining | 1.00 |
| Dusk/dawn, any weather | 1.50 |
| Night, raining | 2.00 |
| Night, dry | 0.80 |

---

## 5. Animal Properties Per Encounter

### 5.1 Size Distributions

All body measurements are drawn from normal distributions truncated at biologically
realistic bounds. SVL = snout-vent length.

| Species | SVL Mean (mm) | SVL SD (mm) | SVL Range (mm) | Mass Mean (g) | Mass SD (g) | Mass Range (g) |
|---------|--------------|-------------|----------------|--------------|-------------|----------------|
| P. cinereus | 40 | 5 | 28--54 | 1.0 | 0.3 | 0.3--2.0 |
| P. glutinosus | 65 | 8 | 45--85 | 5.5 | 1.8 | 2.5--11.0 |
| D. fuscus | 42 | 6 | 28--58 | 2.5 | 1.0 | 0.8--5.5 |
| E. bislineata | 37 | 4 | 27--48 | 1.2 | 0.4 | 0.4--2.5 |
| N. viridescens (eft) | 38 | 4 | 28--48 | 1.8 | 0.5 | 0.8--3.0 |
| P. ruber | 58 | 10 | 35--80 | 5.0 | 2.0 | 1.5--12.0 |
| D. monticola | 55 | 7 | 38--72 | 4.0 | 1.5 | 1.5--8.0 |
| G. porphyriticus | 65 | 10 | 40--90 | 6.0 | 2.5 | 2.0--14.0 |

**Rationale.** P. cinereus total length is 57--100 mm (Wikipedia; ADW); SVL is roughly
55--60% of TL in plethodontids, giving an adult SVL range of ~32--54 mm. The 0.5 g
average mass reported by ADW likely represents juveniles; Burton & Likens (1975) used
1.5 g as the mean for Hubbard Brook adults. P. ruber males mature at 53--63 mm SVL,
females at 55--68 mm (SREL Herpetology). Large adults reach 113 mm SVL (ResearchGate).
Red efts range 34--45 mm in length (ADW), which is largely SVL given the proportionally
shorter tail of the eft stage. D. fuscus adults average 94 mm TL (males) and 86 mm TL
(females), with total lengths 64--142 mm (ADW); SVL is roughly 55% of TL.

### 5.2 Color and Pattern Variation

Each species should display realistic individual variation when rendered.

**Plethodon cinereus (Red-backed Salamander)**
- Two common morphs: striped ("red-backed") and unstriped ("lead-backed")
- Striped morph: dorsal stripe ranges from brick red to orange-red to rusty brown; stripe
  width and edge definition vary. Stripe tapers toward tail tip.
- Lead-backed morph: uniform dark gray-black dorsally, lacking the red stripe entirely.
- Both morphs: ventral surface mottled black and white ("salt-and-pepper" belly).
- Morph frequency is clinal: striped morph is more common at higher latitudes and
  easterly longitudes. For a central Appalachian simulation, use ~70% striped, ~28%
  lead-backed, ~2% erythristic (all red) or other rare variants.
- Rare variants: yellow-backed, orange-backed, white-backed, all-red (erythristic),
  leucistic, melanistic.

**Plethodon glutinosus (Slimy Salamander)**
- Base color: glossy black to dark blue-black.
- White to silvery-brass flecks scattered across dorsum and sides. Fleck density varies
  from sparse to dense.
- Chin and throat often have white spotting; belly uniformly dark.
- Produces copious sticky skin secretions when handled (the "slimy" namesake).

**Desmognathus fuscus (Northern Dusky Salamander)**
- Highly variable. Dorsal color ranges from light tan to olive-brown to dark brown.
- Juveniles: 5--8 pairs of dorsal spots/blotches between fore- and hind limbs. Pattern
  is distinct and spotted.
- Adults: darker, with less distinct patterning. Many older individuals become nearly
  uniformly dark (melanistic).
- Diagnostic field mark: pale line from eye to angle of jaw.
- Keeled (laterally compressed) tail, triangular in cross-section.

**Eurycea bislineata (Northern Two-lined Salamander)**
- Dorsal stripe: yellow to greenish-yellow to tan, bordered by two dark lines.
- Dark border lines may break into dashes along the tail.
- Flanks mottled gray-brown.
- Belly pale yellow. Underside of tail bright yellowish-orange.
- Small and slender overall.

**Notophthalmus viridescens -- red eft (Eastern Newt, terrestrial juvenile)**
- Vivid orange to reddish-orange. Intensity varies from bright neon-orange (typical) to
  duller brownish-orange.
- Row of small red spots bordered by black rings along each side (the "red spots").
  Number and arrangement vary; typically 2--5 per side.
- Skin texture: rough, granular (unlike the smooth skin of the aquatic adult).
- Belly: pale yellow to yellowish-orange, sometimes with small dark spots.
- No tail fin (unlike the aquatic adult).
- Overall brightness is an honest signal -- saturation correlates with tetrodotoxin
  concentration.

**Pseudotriton ruber (Red Salamander)**
- Young animals: bright crimson red to vivid scarlet. This is the stage that most closely
  resembles the red eft (the mimicry).
- Adults: coloration shifts toward orange-brown to purplish-brown with age. Older
  individuals are markedly darker.
- Black spots: numerous, irregularly shaped, scattered across dorsum. Spots are sparse in
  juveniles and increasingly dense/merged in older adults.
- Belly: lighter, pink-orange to flesh-colored. Belly spots may be absent in young
  animals.
- Eyes: yellow to brass-colored iris (distinctive from the red eft's dark eye).
- Stout-bodied with a proportionally short tail (~80% of SVL).

**Key Mimicry Distinction.** The red salamander most closely resembles the red eft when
young (bright red, few spots). As it ages, the darkening coloration and increasing spot
density make it look less like an eft. The simulation should correlate SVL with color
saturation: smaller (younger) P. ruber should be brighter and harder to distinguish from
red efts.

### 5.3 Behavior on Discovery

When a cover object is lifted, each species has characteristic behavioral responses.
The simulation should animate these.

| Species | Primary Response | Secondary Response | Movement Speed | Notes |
|---------|-----------------|-------------------|----------------|-------|
| P. cinereus | Freeze (1--3 sec) | Slow crawl away from light | Slow | May coil body. Tail undulation as distraction display. |
| P. glutinosus | Freeze (1--2 sec) | Moderate crawl toward cover | Moderate | Skin secretion makes it slippery. May leave sticky residue on handler. |
| D. fuscus | Brief freeze (<1 sec) | Rapid escape -- run or jump | Fast | Hind legs proportionally large. Will leap off rocks. Body flip and lateral undulation for rapid movement. |
| E. bislineata | Brief freeze | Quick escape toward water | Fast | If near stream, will enter water immediately. Slim build allows entry into tight crevices. |
| N. viridescens (eft) | Freeze / stand still | Slow, deliberate walk | Very slow | Does not flee. Relies on toxicity and warning coloration. May raise head and tail in "unken reflex" posture. |
| P. ruber | Prolonged freeze (3--10 sec) | Defensive posture | Very slow | Curls body, raises tail, tucks head under tail with tail undulating. This posture is thought to reinforce resemblance to the red eft. Staying still maintains the mimicry. |
| G. porphyriticus | Moderate freeze | Moderate retreat | Moderate | Large enough to be sluggish. May bite if handled. |

**Rationale.** The red eft's slow, conspicuous behavior reflects its high tetrodotoxin
content -- it has no reason to flee because it is genuinely toxic. Predators that have
tasted one learn to avoid the pattern. The red salamander's freeze-and-pose behavior
was described by Howard & Brodie (1971, Nature 233: 277) as consistent with Batesian
mimicry -- remaining still maintains the visual resemblance to the aposematic model. The
Desmognathus jumping escape is documented by Ryerson (2013, Copeia 2013: 512--516).

### 5.4 Health Conditions

| Condition | Probability | Notes |
|-----------|-------------|-------|
| Healthy, normal | 0.85 | No visible abnormalities |
| Regenerating tail | 0.10 | Visible regeneration cone or shortened tail with slightly different coloration. Common in plethodontids from conspecific aggression and predator encounters. |
| Old tail injury (healed) | 0.03 | Tail slightly kinked or shorter than expected but fully healed |
| Fresh injury (wound visible) | 0.01 | Recent bite mark, skin abrasion, or partial tail loss still raw |
| Dead animal | 0.005 | Desiccated or recently deceased. Under objects in poor microsites. |
| Abnormality (extra/missing digit, asymmetric limb) | 0.005 | Developmental abnormality. Rare but documented. |

**Rationale.** Tail breakage frequency in wild plethodontid populations varies by
species and context, but conspecific biting is extremely common in territorial P.
cinereus (Jaeger 1984). Wake & Dresner (1967, Journal of Morphology 122: 265--306)
documented basal tail constriction for autotomy in approximately two-thirds of
plethodontid species. A ~10% frequency of visible tail regeneration is a conservative
working estimate based on field observation reports across multiple studies.

---

## 6. Environmental State Generation

### 6.1 Weather Generation

The simulation generates weather conditions for each survey session (~2--3 hours).
Weather is initialized from seasonal baselines and may change during the survey.

#### 6.1.1 Temperature

Temperature at survey start is drawn from a normal distribution based on monthly norms
(Appalachia, VA climate data):

| Month | Mean High (C) | Mean Low (C) | Survey Temp Mean (C) | SD (C) |
|-------|--------------|-------------|---------------------|--------|
| March | 13 | 3 | 8 | 3 |
| April | 19 | 8 | 14 | 3 |
| May | 23 | 12 | 17 | 3 |
| June | 27 | 16 | 21 | 3 |
| July | 28 | 18 | 22 | 3 |
| August | 27 | 17 | 22 | 3 |
| September | 24 | 14 | 18 | 3 |
| October | 19 | 8 | 13 | 3 |

Survey temp is estimated as midpoint between high and low, representing a morning
survey start (~08:00--09:00). Adjust +3--4C for afternoon surveys, -2C for dawn.

Temperature change during survey: draw from N(0, 1.5) C/hour. Usually warms slightly
through morning.

#### 6.1.2 Precipitation

Probability of rain occurring during a survey window, by month:

| Month | P(rain during 3-hr survey) | P(rain starting mid-survey) | Mean rainfall if rain (mm) |
|-------|---------------------------|---------------------------|---------------------------|
| March | 0.32 | 0.12 | 4.0 |
| April | 0.34 | 0.13 | 5.0 |
| May | 0.40 | 0.15 | 5.5 |
| June | 0.43 | 0.16 | 5.0 |
| July | 0.44 | 0.17 | 6.0 |
| August | 0.36 | 0.14 | 5.5 |
| September | 0.26 | 0.10 | 4.5 |
| October | 0.23 | 0.09 | 4.0 |

**Derivation.** Monthly wet-day counts for Appalachia, VA range from 7.1 (October) to
13.7 (July), where "wet day" = >= 1.0 mm precipitation (Weather Spark). A 3-hour survey
window on a wet day has roughly a P(rain during window) calculated from wet-hours per
wet-day. The mid-survey rain start probability is approximately 35--40% of the total
rain probability -- rain doesn't always start at the beginning.

#### 6.1.3 Cloud Cover

| State | Probability by Season |
|-------|----------------------|
| Clear | Spring 0.20, Summer 0.25, Fall 0.30 |
| Partly cloudy | Spring 0.35, Summer 0.35, Fall 0.35 |
| Overcast | Spring 0.35, Summer 0.25, Fall 0.25 |
| Fog/mist | Spring 0.10, Summer 0.15, Fall 0.10 |

Cloud cover affects temperature (+/- 2C), UV exposure, and humidity (overcast adds
~5--10% RH).

#### 6.1.4 Humidity

Relative humidity is drawn from a beta distribution shaped by recent precipitation,
cloud cover, and season:

- Base RH: drawn from Beta(a, b) scaled to 40--100%
- After rain: shift mean upward by 15--20%
- Overcast: shift mean upward by 5--10%
- Hot, dry days: shift mean downward by 10--15%

Typical ranges:
- Spring morning: 65--90% RH
- Summer midday, dry: 45--70% RH
- Fall morning after rain: 80--98% RH
- Post-rain, any season: 75--95% RH

### 6.2 Soil Moisture

Soil moisture is the critical hidden variable that determines whether a given cover
object harbors salamanders. It is not measured directly by students but is calculated
by the engine.

Soil moisture index (0--1 scale) is generated from:

    soil_moisture = 0.3 + (0.25 * recent_rain_factor) + (0.15 * stream_proximity)
                    + (0.10 * canopy_density) + (0.10 * substrate_type)
                    + noise(0, 0.08)

Where:
- recent_rain_factor: 0--1 based on mm of rain in past 72 hours (saturates at ~25 mm)
- stream_proximity: 0--1 based on distance to nearest water (1.0 = <5m, 0 = >100m)
- canopy_density: 0.3--1.0 (closed canopy retains moisture)
- substrate_type: 0.4 (rocky), 0.6 (mineral soil), 0.8 (organic/humus), 1.0 (moss/peat)

Cover objects with soil_moisture > 0.55 have full salamander probability. Below 0.55,
probability declines linearly to 0 at soil_moisture = 0.20.

---

## 7. Spatial Autocorrelation

Animals are not uniformly distributed along a transect. The simulation should generate
spatially structured encounter patterns.

### 7.1 Hot Objects

Approximately 15--20% of cover objects in a transect are "hot" -- they have intrinsic
properties (better soil moisture, better drainage, proximity to rock crevices) that make
them consistently more productive.

Implementation:
- At transect initialization, assign each cover object a quality score Q drawn from
  Beta(2, 5), giving a right-skewed distribution (most objects are mediocre, a few are
  excellent).
- Q multiplies the base encounter probability. A Q of 0.8 means 80% of baseline; a Q
  of 1.5 means 150%.
- Q values are persistent across survey visits -- the same objects tend to be productive
  each time.

### 7.2 Spatial Clustering

Moisture is spatially autocorrelated. Neighboring cover objects (within ~5m) should have
correlated soil moisture values.

Implementation:
- Generate a 1D spatial moisture field using a Gaussian process or simple moving average
  with correlation length ~10m.
- Overlay local features: seep = +0.3 moisture in 15m radius; stream = +0.2 in 20m
  radius; ridge = -0.15.

### 7.3 Conspecific Aggregation

P. cinereus is territorial, so two adults under the same cover object implies either:
- A mated pair (spring, near nest site)
- An adult with juvenile(s)
- Brief overlap at object boundaries

Desmognathus spp. are more gregarious near stream edges. Finding 2--3 D. fuscus under
a single stream-edge rock is common.

For multi-animal cover objects, weight species co-occurrence:
- Same species: 0.65 probability
- Different species: 0.35 probability
- P. cinereus + P. glutinosus: most common heterospecific pairing
- Red eft + any other: rare (0.05) -- efts are solitary surface wanderers, not typical
  cover-object residents

---

## 8. Edge Cases and Rare Events

These events add narrative depth and ecological realism. Each has a per-cover-object
probability or a per-survey probability.

### 8.1 Per Cover Object Events

| Event | Probability | Season | Details |
|-------|-------------|--------|---------|
| Egg clutch (P. cinereus) | 0.008 | Jun--Aug | Grape-like cluster of 4--17 eggs, each ~4 mm diameter, suspended from upper surface of cover object by a stalk. Mother coiled around clutch. Direct development -- no aquatic larval stage. |
| Egg clutch (Desmognathus) | 0.003 | Jun--Sep | Smaller clutch, 12--26 eggs, often near stream edge. Female attending. |
| Predation in progress | 0.001 | Any | Ring-necked snake (Diadophis punctatus) consuming a salamander, or garter snake (Thamnophis sirtalis) mid-strike. Freeze the scene for observation. Extremely memorable event. |
| Copperhead (Agkistrodon contortrix) | 0.005 | Apr--Oct | Venomous snake. Triggers safety protocol: student must slowly replace cover, mark location, move to next object. No data collected for this object. Survey continues after safety pause. More common in rocky, south-facing habitats. |
| Ring-necked snake | 0.015 | Mar--Oct | Non-venomous. Small, often coiled. May be with salamander prey. |
| Dead salamander | 0.005 | Any | Desiccated or decomposing. Indicates recent drying event or disease. |

### 8.2 Per Survey Events

| Event | P(per survey) | Details |
|-------|---------------|---------|
| Rain starts mid-survey | 0.10--0.17 | Varies by month (see Section 6.1.2). Detection rates improve. Student decides whether to continue. |
| Rain stops mid-survey | 0.08 | If survey started in rain. Detection gradually returns to non-rain baseline over ~30 min. |
| GPS battery dies | 0.02 | Student must estimate coordinates from last fix and transect position. Data quality flag. |
| Camera lens fogs | 0.05 | On humid days when taking camera from pack. 30-second delay to clear. |
| Unexpected species | 0.005 | Finding a species outside its known range or habitat. System draws from a rare-species list: Aneides aeneus (Green Salamander), Plethodon wehrlei (Wehrle's Salamander), Ambystoma jeffersonianum (Jefferson Salamander). Triggers special data collection and photo documentation. |
| Observer disturbs animal before ID | 0.03 | Cover object flipped too quickly. Animal escapes before full observation. Partial data only (e.g., "small brown salamander, Plethodon sp."). Teaches careful technique. |
| Other field crew visible | 0.10 | Another survey team is working an adjacent transect. No mechanical effect but adds immersion. |
| Wildlife distraction | 0.15 | Bird flock, deer, box turtle, interesting mushroom. Brief narrative event. No data impact. |

### 8.3 Per Season Events (Probability Per Survey in That Season)

| Event | P(per survey in season) | Season | Details |
|-------|------------------------|--------|---------|
| Spring ephemeral bloom | 0.40 | Mar--Apr | Trillium, bloodroot, trout lily. Visual enhancement. |
| Fall leaf color | 0.60 | Oct | Canopy color change. Affects light conditions under cover. |
| First frost | 0.25 | Late Oct--Nov | Very low salamander activity. Student learns about temperature limits. |
| Timber rattlesnake sighting | 0.01 | May--Sep | On trail, not under cover. Safety awareness moment. |

---

## 9. Compound Probability Example

To illustrate how these layers combine, here is a worked example for a single cover
object flip:

**Scenario:** May survey, 09:00, overcast, 14C, rained yesterday, forest interior,
cover board on flat ground 30m from stream.

1. Base salamander probability: 0.30
2. Seasonal modifier (May): x 1.00
3. Weather -- rain yesterday: x 1.40
4. Weather -- temperature 14C: x 1.00
5. Weather -- overcast: x 1.15
6. Weather -- RH ~85%: x 1.15
7. Time of day (09:00): x 1.10
8. Object quality Q: x 1.0 (average object)
9. Soil moisture modifier: x 1.0 (above 0.55 threshold)

Compound probability: 0.30 x 1.00 x 1.40 x 1.00 x 1.15 x 1.15 x 1.10 x 1.0 x 1.0
= **0.61**

This means under excellent conditions, more than half of cover objects will yield a
salamander. This matches field experience -- experienced herpetologists report "every
other board" productivity on optimal spring survey days.

Under poor conditions (August, midday, 28C, dry, sunny):
0.30 x 0.40 x 0.55 x 0.35 x 0.85 x 0.75 x 0.80 = **0.012**

One salamander per ~80 cover objects. The student learns why survey timing matters.

The engine should clamp the compound probability at a maximum of 0.75 to prevent
unrealistic scenarios where every object is productive.

---

## 10. Implementation Notes

### 10.1 Random Number Generation

Use a seeded PRNG so that transect layouts and object quality scores are reproducible
across sessions. Weather should be generated fresh each session but from the same
seasonal distributions.

### 10.2 Encounter Pacing

A realistic survey checks 30--50 cover objects in a 2--3 hour session. Pacing should
feel natural -- about 3--5 minutes per cover object including travel time, flip,
observation, data recording, and object replacement.

### 10.3 Data Integrity Prompts

After every encounter, the student records:
- Object ID and GPS coordinates
- Species (or best guess if escaped)
- SVL and estimated mass
- Color morph / pattern notes
- Behavior observed
- Photo (if camera functional)
- Microhabitat notes

The system should occasionally test data integrity: an escaped animal forces "unknown
Plethodon sp." rather than a guess. This teaches the difference between data and
inference.

### 10.4 Key Encounter -- The Mimicry Moment

When a student encounters P. ruber, the system should present it in a way that forces
a real identification decision. A young, bright-red P. ruber is visually very similar
to a red eft. The student must use diagnostic characters:

- Eye color: P. ruber has yellow/brass iris; red eft has dark iris
- Skin texture: P. ruber is smooth; red eft is granular/rough
- Body proportions: P. ruber is stouter with a shorter tail relative to body
- Spot pattern: P. ruber has irregular black spots; red eft has bordered red spots
- Costal grooves: P. ruber has 16--18; red eft has 12--13
- Size: adult P. ruber is generally larger (>50mm SVL vs. eft's 28--48mm)
- Behavior: P. ruber freezes and holds posture; red eft freezes but with different pose

This identification challenge is the pedagogical core of the mimicry lesson.

---

## References and Data Sources

Morphometrics and natural history:
- Animal Diversity Web (animaldiversity.org) -- species accounts for all focal species
- AmphibiaWeb (amphibiaweb.org) -- species accounts
- Savannah River Ecology Lab (srelherp.uga.edu) -- P. ruber maturity sizes
- Virginia Herpetological Society (virginiaherpetologicalsociety.com)

Abundance and community composition:
- Burton & Likens. 1975. Energy flow and nutrient cycling in salamander populations
  in the Hubbard Brook Experimental Forest, New Hampshire. Ecology 56: 1068--1080.
- Ford et al. 2002. Stand age and habitat influences on salamanders in Appalachian
  cove hardwood forests. Forest Ecology and Management 155: 131--141.
- Mathis et al. 2015. Calibrating abundance indices with population size estimators
  of red back salamanders in a New England forest. PeerJ 3: e952.
- MacNeil et al. 2011. Relative abundance and species richness of terrestrial
  salamanders. USFS GTR-NRS-P-108.
- Semlitsch et al. 2014. Range-wide salamander densities reveal a key component of
  terrestrial vertebrate biomass in eastern North American forests. USGS.

Detection probability and survey methods:
- Bailey et al. 2004. Estimating detection probability parameters for Plethodon
  salamanders using the robust capture-recapture design. Journal of Wildlife
  Management 68: 1--13.
- Williams & Bailey. 2004. Reducing false absences in survey data: detection
  probabilities of red-backed salamanders. Journal of Wildlife Management 68: 418--428.
- Sanchez et al. 2020. Environmental drivers of surface activity in a population of
  the eastern red-backed salamander. Herpetological Conservation and Biology 15:
  642--651.
- Margenau et al. 2020. Efficacy and biases of cover object survey design.
  Herpetological Conservation and Biology 15: 234--247.
- Ochs et al. 2024. Evaluating elements of artificial cover object design for
  terrestrial salamander monitoring. Wildlife Society Bulletin.

Mimicry system:
- Howard & Brodie. 1971. Experimental study of mimicry in salamanders involving
  Notophthalmus viridescens viridescens and Pseudotriton ruber schencki. Nature 233:
  277.
- Brodie & Howard. 1973. Experimental study of Batesian mimicry in the salamanders
  Notophthalmus viridescens and Pseudotriton ruber.

Behavior and anti-predator responses:
- Jaeger. 1984. Agonistic behavior of the red-backed salamander. Copeia 1984: 309--314.
- Ryerson. 2013. Jumping in the salamander Desmognathus ocoee. Copeia 2013: 512--516.
- Wake & Dresner. 1967. Functional morphology and evolution of tail autotomy in
  salamanders. Journal of Morphology 122: 265--306.

Climate data:
- Weather Spark (weatherspark.com) -- Appalachia, VA climate normals
- NOAA Southern Region Climate Center -- precipitation climatology
