# Competitive Landscape -- Educational Ecology Simulations

**Product:** borchardlabs.com  
**Scope:** Browser-based simulated field ecology research for biology students  
**Date:** 2026-04-04  
**Author:** Mason Borchard

---

## Table of Contents

1. [Virtual Field Ecology Platforms](#1-virtual-field-ecology-platforms)
2. [Species Identification Training Tools](#2-species-identification-training-tools)
3. [Immersive Science Education Games](#3-immersive-science-education-games)
4. [Gap Analysis](#4-gap-analysis)

---

## 1. Virtual Field Ecology Platforms

### Labster

**URL:** labster.com  
**Target Audience:** University and high school STEM courses  
**Tech Stack:** Unity engine compiled to WebGL, delivered in-browser. LMS integration (Canvas, Blackboard, etc.)

**What it looks like:**  
Labster's ecology simulations use a sci-fi visual wrapper -- students interact with holographic tables, futuristic lab spaces, and 3D terrain models projected as holograms. The aesthetic is "space station meets ecology lab." Think clean gradients, glowing UI elements, floating data panels. It looks polished but feels disconnected from actual fieldwork. You are never standing in a forest.

**Ecology simulations available (24+ modules):**
- Spatial Ecology -- species distribution on a holographic terrain map
- Landscape Ecology -- dispersal/specialization on 3D holo-floor
- Biodiversity assessment on a fictional exoplanet
- Carbon/Nitrogen/Water cycle management
- Trophic levels, competition, foraging theory
- Population growth, behavioral thermoregulation
- Eutrophication, marine biology fish death investigation

**Interaction model:**  
Point-and-click through narrative-driven scenarios. Students follow a linear story, answer embedded quiz questions, manipulate parameters on virtual instruments. Heavily guided -- the sim tells you what to do next. No open-ended exploration. Data "collection" is abstracted into clicking highlighted objects and reading results from holographic displays.

**What works:**
- Production quality is high -- the 3D environments are clean and readable
- LMS integration means grades flow automatically into Canvas/Blackboard
- 300+ simulations across all STEM subjects means institutional buy-in is easier
- Narrative framing keeps students moving forward
- Auto-graded quizzes reduce instructor workload

**What doesn't work:**
- The sci-fi aesthetic actively undermines ecological literacy -- you never learn what a forest floor actually looks like
- Linear hand-holding means students never develop independent research instincts
- Load times are brutal (Unity WebGL cold start) -- students report browser crashes mid-session
- Progress isn't saved on crash, so students restart from zero
- Theory coverage is thin -- quiz questions test material not explained in the sim
- No customization for instructors who want to align with their own curriculum
- Text is often too small, interactive elements are hard to click
- Per the Trustpilot reviews, student frustration is real and frequent

**Pricing:**
- Explorer: $3,000/year for up to 50 students, 10 simulations (~$5/student/month)
- Advanced: custom pricing, up to 100 students, 30 simulations
- Elite: custom pricing, unlimited students, all 300+ simulations
- Per-student access from $79--$109 for group/individual quotes
- Institutions negotiate volume deals; small programs get priced out

**Bottom line for us:**  
Labster is the gorilla in the room for institutional sales. But their ecology offering is a dressed-up quiz engine -- there is zero authentic field experience. A biology student who completes Labster's ecology suite has never flipped a rock, identified a real organism from ambiguous features, or dealt with the frustration of finding nothing under half their cover objects. That's our entire opening.

---

### PhET Interactive Simulations (University of Colorado Boulder)

**URL:** phet.colorado.edu  
**Target Audience:** K-12 and introductory college, free for everyone  
**Tech Stack:** HTML5/JavaScript (open source, GitHub: phetsims/natural-selection)

**What it looks like:**  
2D cartoon-style illustrations. The Natural Selection sim shows a landscape (snowy tundra or desert) with cartoon bunnies hopping around. Clean, bright, friendly. The aesthetic is "interactive textbook illustration" -- not immersive, not trying to be. Simple toolbar across the top, population graph on the side.

**Ecology-relevant simulations:**
- Natural Selection -- mutation, selection pressure, population dynamics with bunnies
- (Legacy) Natural Selection -- older Java version, similar concept
- Various population ecology activities contributed by teachers

**Interaction model:**  
Sandbox-style parameter manipulation. Students toggle mutations (fur color, ear length, teeth), add environmental pressures (wolves, limited food, tough food), switch environments (summer/winter), and watch population dynamics play out in real time. A population graph updates live. Students can add data probes to read exact values off the graph.

**What works:**
- Completely free, no login required, runs in any browser
- Lightweight -- loads instantly, no Unity overhead
- Excellent for visualizing selection pressure and population dynamics
- Widely used, huge library of teacher-contributed activities and worksheets
- Open source code on GitHub -- the gold standard for transparency
- Translated into 100+ languages
- Students can explore freely without hand-holding

**What doesn't work:**
- Extremely abstract -- cartoon bunnies are not organisms, the environment is a flat backdrop
- No species identification component at all
- No data collection mechanics -- the simulation generates all the data automatically
- No field protocols, no procedural skills, no research design
- Visual quality is deliberately simple -- fine for concept demos, but not for training observation skills
- Limited to population-level phenomena, can't model community ecology or species interactions at the individual level

**Pricing:** Free, always.

**Bottom line for us:**  
PhET isn't a competitor -- it's a concept visualization tool. Nobody would confuse what PhET does with field ecology training. But it sets an important precedent: free, instant, browser-based science sims with massive adoption. We need to match their accessibility (no login wall, no download) while offering something they fundamentally cannot -- immersive, procedural field experience.

---

### EcoMUVE (Harvard Graduate School of Education)

**URL:** ecolearn.gse.harvard.edu/projects/ecomuve  
**Target Audience:** Middle school students (grades 6--8)  
**Tech Stack:** Custom 3D MUVE (Multi-User Virtual Environment), downloadable client for Windows/Mac

**What it looks like:**  
Early-2010s 3D virtual world -- think Second Life or early Minecraft. Low-poly environments with basic textures. Students control an avatar that walks through a virtual pond ecosystem or forest. The visual fidelity is dated by modern standards -- this was cutting-edge for 2010 educational software but would look rough to students raised on modern games.

**Modules:**
- Pond Module: students investigate a fish die-off by exploring a virtual pond ecosystem over time
- Forest Module: similar inquiry-based investigation in a forest setting

**Interaction model:**  
Students navigate a 3D world in first/third person, clicking on objects and organisms to collect data. They work in teams, each student taking different measurements (water chemistry, organism surveys, weather). Data is recorded and shared. The experience culminates in a "mini scientific conference" where teams present findings. Two to four week curriculum, not a single session.

**What works:**
- The inquiry structure is genuinely excellent -- students investigate a mystery (why did the fish die?) using evidence
- Team-based data collection mirrors real collaborative field research
- The "virtual world" framing was novel and engaging for its target demographic
- Backed by solid pedagogical research (NSF-funded, published studies showing learning gains)
- Students learn to connect observations across scales (individual organisms to ecosystem dynamics)
- The mini-conference at the end teaches scientific communication

**What doesn't work:**
- The software is a downloadable client from 2012 -- it is effectively abandoned
- Visual quality is far below modern expectations
- Requires installation, which is a hard sell in schools with managed devices
- Only two modules, both focused on aquatic/forest ecosystem dynamics rather than field technique
- The 3D world is a navigation space, not a realistic habitat -- students don't develop observational skills from walking around a low-poly pond
- Not browser-based, can't run on Chromebooks (a dealbreaker for many schools)
- No active development or support

**Pricing:** Free download (with license from Harvard).

**Bottom line for us:**  
EcoMUVE's pedagogical design is the best in the field -- the inquiry-based mystery structure and team data collection are ideas worth studying carefully. But the software is dead. The technical execution aged out years ago. If you took EcoMUVE's pedagogical framework and rebuilt it with modern browser tech and realistic visual fidelity, you'd have something exceptional. That's close to what we're doing, except we're focused on field technique rather than ecosystem-scale causal reasoning.

---

### SimBio (EcoBeaker and SimUText)

**URL:** simbio.com  
**Target Audience:** Undergraduate ecology courses  
**Tech Stack:** Custom desktop application (SimUText System), Java-based

**What it looks like:**  
2D top-down simulation windows with simplified organism sprites on habitat backgrounds. The Keystone Predator lab shows a bird's-eye view of an intertidal zone with colored dots representing different species. The Isle Royale lab shows a map of the island with moose and wolf icons. The aesthetic is "functional scientific software" -- not pretty, but readable. Clean data panels, abundance graphs, parameter controls alongside the simulation view.

**Ecology modules (EcoBeaker line):**
- Keystone Predator -- intertidal community dynamics
- Isle Royale -- moose/wolf predator-prey dynamics
- Niche Wars -- competitive exclusion
- Barnacle Zone -- intertidal zonation
- Plus interactive chapters on: competition, predation/parasitism/herbivory, community dynamics, physiological ecology, behavioral ecology, life history, population growth, biogeography, ecosystem ecology, nutrient cycling, decomposition, climate change

**Interaction model:**  
Students manipulate parameters (add/remove species, change food availability, alter environment) and observe outcomes in the 2D simulation. They can freeze the simulation at any point and read abundance values for each species. Integrated workbook with questions guides students through experiments. The student sets up the experiment, runs it, observes results, and answers analysis questions.

**What works:**
- Deeply respected in the ecology education community -- many ecology professors swear by these
- The simulations are based on real ecological systems (Isle Royale moose/wolves is a real long-term study)
- Students design experiments rather than just watching outcomes
- Integrated workbooks mean students have structured analysis to do
- The ability to freeze and read individual data points is genuinely useful
- Faculty love the Isle Royale lab -- in 200-person classes, 25%+ of students cite it as the most memorable activity of the semester
- Auto-graded with instructor dashboards

**What doesn't work:**
- Desktop application that requires installation via SimUText System -- not browser-based
- The 2D visualization is extremely abstract -- colored dots on a map are not organisms
- No field skills at all -- everything is parameter manipulation and graph reading
- No species identification training
- Students never "see" organisms -- they see population-level representations
- The pricing model requires institutional contact and custom quotes, which is opaque
- Java-based tech is aging

**Pricing:**
- Individual modules can be purchased, or bundled as an $89 textbook replacement
- Institutional pricing requires contacting SimBio directly with course details
- Custom registration links generated per course

**Bottom line for us:**  
SimBio is the quality standard for ecology lab simulations in higher ed. Isle Royale and Keystone Predator are genuinely beloved. But they operate at the population/community level -- students manipulate parameters and read graphs. Nobody ever looks at an animal and tries to figure out what it is. Nobody crouches down and flips a rock. SimBio does "ecology concepts" brilliantly; we do "ecology fieldwork."

---

### Virtual Biology Lab (Amrita Vishwa Vidyapeetham)

**URL:** vlab.amrita.edu  
**Target Audience:** Indian higher education students (free access)  
**Tech Stack:** PHP backend, web-based animations and simulators, custom "Virtual Lab Collaborative Platform"

**What it looks like:**  
Sparse, utilitarian web interface. Card-based layout with placeholder images (literally temp.gif in some cases). Experiments open in-browser with basic animations and parameter inputs. The visual design is functional but dated -- think early 2010s educational website with limited CSS styling. Animations are simple Flash-era style (likely HTML5 now).

**Ecology experiments (9 modules):**
- Determination of pH of Waste Water Sample
- Biological/Chemical Oxygen Demand
- Nitrogen Cycle
- Species Interactions in Ecology
- Bacterial Population Growth
- Population Invasion
- Foraging of Organisms
- Case Studies on Ecology

**Interaction model:**  
Step-by-step guided procedures with embedded animations. Students click through protocol steps, adjust parameters in simple forms, and read outputs. Each experiment includes theory background, procedure, simulation, and self-evaluation quiz.

**What works:**
- Free access for millions of students who have no access to physical labs
- 220+ experiments across all biology disciplines
- Clear pedagogical structure (theory -> procedure -> sim -> quiz)
- Addresses a real equity gap in Indian higher education

**What doesn't work:**
- Visual quality is extremely low -- placeholder images, minimal animation
- Interactions are shallow -- clicking through steps, not genuine data collection
- The ecology labs are mostly about water chemistry and population math, not field ecology
- No immersion, no environmental context, no sense of place
- No species identification component
- The platform serves a different market (Indian university labs), so direct comparison is limited

**Pricing:** Free.

**Bottom line for us:**  
Not a direct competitor. Amrita solves a different problem (basic lab access for under-resourced institutions). But it demonstrates that free, browser-based science labs can achieve massive scale -- the VALUE program has served millions of students across India. If we ever think about emerging markets or equity access, this is the precedent.

---

### BioInteractive (HHMI)

**URL:** biointeractive.org  
**Target Audience:** AP Biology, introductory college biology, high school  
**Tech Stack:** HTML5/JavaScript, browser-based, some legacy Flash (migrated)

**What it looks like:**  
Clean, modern, National Geographic-quality photography and illustration. The Lizard Evolution Virtual Lab uses real photographs of anole lizards in their natural habitats alongside data visualization tools (scatter plots, phylogenetic trees). The Population Dynamics sim uses illustrated graphs with interactive sliders. The aesthetic is "polished science media" -- think of a well-designed textbook figure that you can interact with.

**Ecology/evolution virtual labs and interactives:**
- Lizard Evolution Virtual Lab -- 4 modules: ecomorphs, phylogeny, experimental data, dewlap colors
- Population Dynamics -- exponential and logistic growth model exploration
- Trophic Cascades interactive
- Biomes and climate interactive
- Extensive supporting videos, data sets, and teaching materials

**Interaction model:**  
The Lizard Evolution lab is the standout. Students examine photos of real lizards in real habitats, take measurements from images, collect data into tables, construct graphs, and perform statistical analyses. The lab is modular -- each section involves genuine data collection, calculation, and interpretation. The Population Dynamics sim is more typical (slider-based parameter manipulation).

**What works:**
- Completely free, no login required for most resources
- The Lizard Evolution lab is one of the best pieces of science education software ever made
- Uses real photographs and real data -- students interact with actual organisms, not cartoons
- Emphasis on "science as a process" -- observation, measurement, analysis, interpretation
- Data collection is meaningful, not automated
- Beautiful production quality funded by HHMI's massive endowment
- Huge educator community, extensive teacher resources

**What doesn't work:**
- The Lizard Evolution lab is point-and-click on static images -- you're measuring lizards in photographs, not encountering them in a dynamic environment
- No environmental immersion -- it's a series of panels and data tables, not a virtual habitat
- Population Dynamics sim is a standard parameter-slider model
- Limited scope -- only a handful of virtual labs (most BioInteractive resources are videos and data activities)
- The "lab" framing is generous -- it's really interactive data analysis, not simulated research
- No field protocols, no procedural skills training

**Pricing:** Free, always. HHMI funded.

**Bottom line for us:**  
BioInteractive's Lizard Evolution lab is the closest thing to what we're building in terms of pedagogical philosophy -- students collect real data from organisms and analyze it. The difference is delivery: they use static photographs in a structured interface; we put students in a living environment where they have to find the organisms first. BioInteractive proves the demand for organism-level, data-driven ecology education. We're making it dynamic and immersive.

---

### Virtual Field Station (VFS) / University Virtual Field Trips

**Notable projects:**
- Virtual Field Station (University of Bristol, 2003) -- VR ecology fieldwork for A-Level biology
- Virtual Scotland (various UK universities) -- immersive virtual landscape with 30,000 trees, rivers, road traffic, quad bikes
- Penn State VR Bird Research -- 360-degree video fieldwork brought to classroom
- Stanford Virtual Field Sites -- instructor-guided virtual tours with field guides
- Cengage Virtual Field Trips -- immersive earth science field experiences in MindTap
- ASU STEMscapes -- course teaching educators how to build virtual field experiences

**What they look like:**  
Varies enormously. Virtual Scotland went for high-fidelity photorealism with a detailed 3D landscape. Penn State used 360-degree video of actual fieldwork sites. Stanford uses panoramic photography with overlay annotations. Cengage uses "vivid imagery and animation" with expert commentary. Visual quality ranges from basic photospheres to fully rendered 3D worlds.

**Interaction model:**  
Most follow a guided tour model -- students move through a virtual space and complete activities at designated stops. Some involve genuine data collection (transect surveys, quadrat counts). Virtual Scotland let students drive a quad bike around the landscape, which is memorable if nothing else. The more sophisticated ones include hypothesis development, investigation design, and data analysis.

**What works (across the category):**
- Research shows immersive virtual field trips can "match or even exceed the learning outcomes of in-person experiences"
- Students report high engagement with realistic environments
- Addresses accessibility issues (cost, mobility, weather, safety, geography)
- Some genuinely teach field protocols and data collection methods

**What doesn't work:**
- Almost all are one-off projects tied to a specific course at a specific university
- No standardized platform -- each one is custom-built
- Most are not publicly available
- VR headset requirements limit accessibility
- The "guided tour" model doesn't build independent research skills
- 360-degree video gives you passive observation, not active investigation
- None of them simulate the tedious reality of field data collection (mostly empty cover objects, environmental variability, ID uncertainty)

**Bottom line for us:**  
The academic VR field trip space validates our core thesis -- there's strong demand for virtual fieldwork, and students learn effectively from it. But every existing project is either a one-off prototype, requires VR hardware, or doesn't simulate the actual mechanics of field research. Nobody has built a scalable, browser-based platform that lets students do the boring, repetitive, procedurally accurate work of field ecology. That's the gap.

---

### Virtual Ecology Workbench and Related Tools

**Notable tools:**
- virtualecology.org -- appears to be an inactive/minimal project
- Populus (University of Minnesota) -- population biology simulation software
- Ecopath with Ecosim -- professional ecosystem modeling suite (mass-balance, time-dynamic, spatial)
- EcoNet -- online network modeling for ecological systems
- GoldSim -- commercial ecological modeling software
- BiologySimulations.com -- inquiry-based ecology labs in browser

**What they are:**  
These are modeling tools, not educational simulations. Ecopath with Ecosim is used by actual researchers to model fisheries and marine ecosystems. Populus runs population dynamics models. GoldSim does industrial-scale environmental modeling. They're professional-grade software that happens to be used in teaching, not teaching tools designed around learning experiences.

**Bottom line for us:**  
Not competitors. These serve a completely different need (quantitative ecological modeling). But worth knowing they exist -- if a university ecology department already uses Populus for population dynamics modeling, they're not looking for another parameter-slider tool. They're looking for something that fills a different gap. Like field skills.

---

## 2. Species Identification Training Tools

### iNaturalist and Seek

**URLs:** inaturalist.org, Seek app (iOS/Android)  
**Tech Stack:** Ruby on Rails (iNaturalist), React Native (Seek), computer vision models trained on community-submitted observations

**How they train visual ID:**

iNaturalist's core loop: photograph organism -> upload -> community identifies it -> you learn. The training is incidental -- you get better at ID by seeing hundreds of identifications over time. The community correction model is powerful: experts annotate your photos, explaining *why* something is Species X rather than Species Y.

Seek takes this further with real-time camera ID. Point your phone at something and it narrows down the taxonomy live -- Kingdom -> Phylum -> Class -> Order -> Family -> Genus -> Species. The narrowing ladder is brilliant UX for teaching taxonomic thinking. When Seek can't get to species, it tells you what taxonomic level it's confident at (e.g., "this is definitely in family Plethodontidae but I can't tell you which species"). That honest uncertainty is pedagogically valuable.

**What works:**
- The real-time narrowing in Seek teaches students how identification actually works -- you rule things out, not in
- iNaturalist's community model means every observation becomes a learning moment
- Massive dataset (millions of observations) means the AI is genuinely good
- Gamification through badges and challenges drives engagement
- Location/season filtering teaches biogeography naturally
- Free for both platforms

**What doesn't work for our purposes:**
- Requires being in the field with real organisms -- not applicable to a virtual sim
- No structured curriculum or assessment
- The AI does the hard work -- students learn to photograph, not to identify
- No integration with data collection protocols or research design
- The ID process is instant, not deliberative -- in real field work, you sit with a field guide for 5 minutes comparing features

**Relevance to us:**  
Seek's taxonomy narrowing UI is worth studying carefully. Our ID challenge should mirror that deliberative process -- examining features one at a time, ruling out possibilities, arriving at identification through evidence rather than pattern matching. We should also consider building in the honest uncertainty Seek shows ("I think this is genus Plethodon but I'm not sure about species").

---

### Merlin Bird ID (Cornell Lab of Ornithology)

**URL:** merlin.allaboutbirds.org  
**Tech Stack:** Native iOS/Android, CV models trained on eBird/Macaulay Library photos

**Visual identification workflow:**  
Merlin asks the same questions an expert birder would ask: Where were you? When? What size was the bird? What colors did you notice? What was it doing? From five answers, it narrows to likely species using 750 million eBird observations filtered by location and date. Photo ID lets you upload a picture for direct CV identification. Sound ID listens to birdsong in real time and shows species suggestions.

**What works:**
- The question-based ID workflow is exactly how experts think -- it teaches the right mental model
- Location and date filtering reflects real-world species distribution (not every bird is possible everywhere)
- Sound ID is genuinely magical and drives engagement
- The "Explore Birds" feature generates a local species list, teaching students what to expect before they go out
- Completely free, offline-capable with downloaded packs
- Covers 6,000+ species globally

**What doesn't work for our purposes:**
- Requires real-world context (you saw a real bird)
- The AI provides the answer -- students don't learn the diagnostic features themselves
- No structured data collection workflow
- No lab or classroom integration

**Relevance to us:**  
Merlin's question-based approach is exactly right for teaching identification. Our ID challenge should ask: What's the skin texture? How big is it? What's the body shape? What pattern are the spots? -- and narrow the species list based on answers. The "where and when" filtering is also key: our simulation's species composition changes by site and season, just like Merlin's does.

---

### PlantNet and PictureThis

**PlantNet:** Free, community-driven, backed by CIRAD/INRAE. 40--68% accuracy depending on test. Regional flora filtering.  
**PictureThis:** Paid subscription (~$30/year after 7-day trial). 73--78% accuracy. Superior UX -- clean, fast, information-rich results page.

**UX patterns worth noting:**
- PictureThis loads bulk information on the main ID page immediately after scanning -- no drilling into submenus
- PlantNet lets you filter by regional flora, which improves accuracy and teaches biogeography
- PictureThis includes care information, environmental conditions, FAQ -- it anticipates the next question after "what is this?"
- PlantNet is community-driven and contributes to science; PictureThis is a consumer product

**Relevance to us:**  
The pattern to steal from PictureThis is the information-dense result page -- once a student identifies a salamander in our sim, the species profile should be rich and immediate. Morphological details, habitat preferences, conservation status, range map, behavioral notes -- all on one screen, no clicking through tabs. The PlantNet regional filtering model maps directly to our site-selection mechanic: different sites have different species assemblages.

---

### HerpMapper

**URL:** herpmapper.org  
**Tech Stack:** Web + native mobile app (Android/iOS), GPS integration

**What it does:**  
Citizen science platform for recording reptile and amphibian observations. The mobile app creates voucher records with photos, GPS coordinates, and optional audio recordings (for calling frogs). Searchable database of all world herpetofauna common and scientific names. Data is shared with partner organizations for conservation research. Works offline with sync-when-connected model.

**Relevance to us:**  
HerpMapper's data entry workflow is the closest real-world analog to what our students will do in the simulation: find a herp, photograph it, record location and conditions, identify it. The key difference is that HerpMapper assumes you already know what you found (or will figure it out later) -- it doesn't train identification. Our simulation actively teaches the ID skills that HerpMapper users are expected to already have. We're the training ground; HerpMapper is the field tool.

---

### eBird

**URL:** ebird.org  
**Tech Stack:** Ruby on Rails, massive PostgreSQL backend, mobile apps (BirdLog)

**Data entry workflow:**  
Semi-structured protocols with flexible compliance. In the field: record location (GPS), start time, observation type (stationary, traveling, incidental), duration, distance. For each species: count, breeding code, age/sex. Complete checklists allow non-detection inference (critical for real science). Quality control through automated filters and community review.

**What works:**
- The checklist model is brilliant for structuring field data collection
- The distinction between "complete" and "incidental" checklists teaches data quality awareness
- Effort data (time, distance, method) alongside observation data enables real scientific analysis
- The system handles the gap between "casual observation" and "structured protocol" elegantly

**Relevance to us:**  
Our field notebook data entry should feel like filling out an eBird checklist -- structured enough to produce analyzable data, flexible enough to feel natural. The effort metadata eBird collects (time spent, area covered, method used) maps directly to our transect-level metadata. Students should learn that *how* you collected data matters as much as *what* you collected.

---

## 3. Immersive Science Education Games

### Tyto Online / Tyto Ecology

**URL:** tytoonline.com, Steam ($3.99 base)  
**Target Audience:** Middle school life science  
**Tech Stack:** Unity, available on Steam (Windows/Mac) and iPad

**What it looks like:**  
3D low-poly environments -- empty biodomes that you fill with organisms. Clean, colorful, calm aesthetic. Three biomes (Mojave Desert, Great Plains, Amazon Rainforest) with expansion packs for Himalayas, Alaska Tundra, and Cretaceous Mongolia (dinosaurs). Over 70 species as placeable objects.

**Interaction model:**  
Pure god-mode sandbox. You start with an empty dome, place producers, then consumers, then decomposers. Balance the food web or watch everything collapse. A Biodex catalogs species, progress trackers follow quests. Time passes even when you're away -- return to find your ecosystem has evolved (or died). Teaches NGSS standards through organic problem-solving.

**What works:**
- Cheap ($3.99) and immediately accessible
- The "build an ecosystem from scratch" model teaches food web concepts intuitively
- Time passage creates consequences for decisions
- The Biodex encourages species learning
- NGSS alignment makes it easy for teachers to justify

**What doesn't work:**
- No longer actively supported (indie studio, development stopped)
- God-mode perspective means students never experience what field research actually feels like
- Species are objects you place, not organisms you encounter and identify
- No data collection, no research design, no analysis
- The visual style is functional but not immersive enough to teach observational skills
- Biodome framing is inherently artificial

**Pricing:** $3.99 base, $1.99 per expansion. Bundle: $7.96.

---

### Calangos (Brazil)

**URL:** calangos.sourceforge.net  
**Target Audience:** Brazilian high school biology students  
**Tech Stack:** Custom engine, 3D first/third person, SourceForge-hosted

**What it looks like:**  
3D simulation of the sand dunes along the middle Sao Francisco River in Brazil's Caatinga biome. First and third-person perspectives. You play as a lizard from one of three endemic species (*Tropidurus psammonastes*, *Cnemidophorus* sp. nov., or *Eurolophosaurus divaricatus*). The environment includes realistic topography, circadian and circannual climate cycles based on real weather data, and modeled plant/animal communities.

**Interaction model:**  
You ARE the lizard. You navigate the environment, find food, avoid predators, interact with conspecifics, and try to survive. The game models thermoregulation, foraging efficiency, predator-prey encounters, and reproductive success. Students can access dispersion graphs that relate environmental variables to their lizard's past performance. The game explicitly teaches students to interpret graphs as a scientific skill.

**What works:**
- This is the only ecology game I've found that uses climate data from a real study site
- The organism-perspective approach is unique and compelling -- you experience ecology from inside the food web
- Ecological relationships are modeled with real data, not arbitrary game balance
- The built-in graphing tools teach data interpretation as a core skill
- The three-species choice creates natural comparative learning
- Genuinely novel pedagogical approach backed by published research

**What doesn't work:**
- The software is old, SourceForge-hosted, and extremely niche
- Available only in Portuguese (or limited English), limiting global adoption
- The lizard-perspective means students don't practice researcher skills -- they practice being a lizard
- No species identification component -- you know what you are
- Desktop application, not browser-based
- The Caatinga biome is hyper-specific -- not transferable to other ecosystems

**Bottom line for us:**  
Calangos is the most intellectually interesting competitor. Playing as the organism is a genuinely different pedagogical idea. But it's complementary to what we do, not competing. We put students in the researcher role; Calangos puts them in the organism role. Both are valid. The use of real climate data and real ecological relationships is something we share -- our simulation also models real species assemblages and environmental variability. The key difference: our students have to figure out what species they're looking at, which is the core skill of field ecology.

---

### Equilinox

**URL:** equilinox.com, Steam ($9.99)  
**Target Audience:** General gamers (not education-specific)  
**Tech Stack:** Custom engine by solo developer (ThinMatrix), Java/LWJGL

**What it looks like:**  
Low-poly 3D with a distinctive colorful aesthetic. Beautiful in a stylized way -- rolling terrain with softly shaded grass, trees, and water. Animals have simplified but charming models. Relaxing ambient soundtrack. The overall vibe is "nature documentary made of paper craft."

**Interaction model:**  
Place plants, which make terrain fertile. Place animals, which earn points. Use points to genetically modify species or unlock new ones. Balance the ecosystem or let it evolve. Sandbox mode for unlimited creation. Task system with specific challenges. Animals have behaviors: hunting, den building, breeding. Bees make honey.

**What works:**
- 93% positive reviews (2,092 reviews) -- players genuinely love it
- The relaxing sandbox style hooks people who wouldn't normally play ecology games
- The genetic modification mechanic is creative
- Beautiful art style despite low-poly approach
- Cross-platform (Windows, Mac, Linux)

**What doesn't work for education:**
- No educational structure, assessment, or curriculum alignment
- God-mode ecosystem manager perspective
- Species are abstract game tokens, not real organisms
- No data collection, no research design
- You can put tropical fish next to arctic foxes -- ecological realism is secondary to gameplay

---

### Ecosystem (by Slug Disco Studios)

**URL:** ecosystem-game.com, Steam ($19.99)  
**Target Audience:** General gamers interested in evolution  
**Tech Stack:** Custom engine with neural network simulation

**What it looks like:**  
Underwater 3D environments with procedurally generated creatures. Creatures have genuinely alien morphologies -- they evolve neural networks, body structures, and locomotion strategies through natural selection. The visual style is otherworldly and fascinating. Procedural worlds with terrain sculpting.

**Interaction model:**  
Set up ocean environments (depth, soil type, nutrients, currents, temperature). Seed with initial creatures. Watch evolution happen through natural selection over generations. Intervene with species tools (force certain traits, set requirements). Track results through phylogenetic trees, population charts, and statistics. Steam Workshop for sharing creatures and maps.

**What works:**
- The neural network evolution produces genuinely emergent, surprising behavior
- Phylogenetic tree visualization is excellent for teaching evolutionary concepts
- Deep environmental simulation (energy flow, nutrient cycles, temperature gradients)
- The "creatures evolved on their own" framing is compelling

**What doesn't work for education:**
- Purely aquatic, purely speculative organisms -- no real-world connection
- No structured learning, no assessment
- Complex enough to be intimidating for non-gamers
- 77% positive (Mostly Positive) -- some frustrations with complexity and performance
- $19.99 is steep for a classroom tool

---

### Eco (Strange Loop Games)

**URL:** strangeloopgames.com/eco, Steam ($29.99)  
**Target Audience:** Multiplayer sandbox gamers, environmental education  
**Tech Stack:** Unity, dedicated servers, web-based economy dashboard

**What it looks like:**  
Voxel-style 3D world (Minecraft-adjacent aesthetic). Players build structures, farm, mine, craft -- standard survival game visuals. But the world has a detailed ecological simulation running underneath: every organism exists in a modeled food web, disruptions cascade through the ecosystem, and all player activity generates searchable data (graphs, heat maps).

**Interaction model:**  
Multiplayer survival/civilization building with ecological consequences. Players specialize in crafts, trade, govern (write laws, vote on constitutions), and advance technology -- all while trying not to destroy the ecosystem before a meteor arrives. The government and economy systems are unique among ecology games.

**What works:**
- The "civilization vs. ecosystem" framing teaches environmental impact naturally
- Real social dynamics (governance, trade, specialization) add depth
- Ecological data is tracked and searchable -- students can study their own impact
- Multiplayer creates genuine social consequences for environmental decisions
- Teaches systems thinking at a level no other game approaches

**What doesn't work for education:**
- $29.99 per student plus server hosting costs
- Multiplayer dependency means you need a critical mass of players
- The ecology simulation is backdrop, not focus -- most gameplay is building and crafting
- No species identification, no field protocols
- The ecological model is abstracted -- you see population numbers, not individual organisms
- Requires significant time commitment (dozens of hours to be meaningful)

---

### National Geographic Education

**URL:** education.nationalgeographic.org  
**Target Audience:** K-12, general public  

Nat Geo's education portal offers several interactive tools relevant to ecology:
- **Wildfires simulation** -- explore variables affecting fire spread and intensity
- **Climate simulation** -- explore temperature data from ice cores, satellites; run computational models
- **Agriculture simulation** -- explore resources in agricultural systems
- **SIMOC** -- design an off-world habitat (Mars colony), NGSS-aligned

These are parameter-exploration tools with high production quality. Beautiful photography, clean UI, expert commentary. But none simulate field ecology or species-level interactions. They operate at the systems level (climate, agriculture, fire ecology) rather than the organism level.

---

### Smithsonian Science Education Center

**URL:** ssec.si.edu/game-center  
**Target Audience:** K-8

Notable offerings:
- **Aww Snap! A Snapdragon Study** -- students play as field researchers counting bee visits to different-colored flowers. Data collection and scientific observation. Grades 2--6.
- **Whale Protection Corps** -- marine conservation decision-making with no-go zones
- **Aquation** -- freshwater resource management
- **VERA** (Virtual Experimentation Research Assistant) -- conceptual modeling tool for introductory college ecology. Students build ecosystem models and validate them against agent-based simulations in NetLogo. Uses Smithsonian's Encyclopedia of Life species database.

VERA is worth a closer look -- it lets students build their own ecosystem models, parameterized with real species data from EOL (2 million species, 11 million trait records), and then test those models against agent-based simulations. No coding required. Free since 2018. The model-build-test-revise cycle is excellent pedagogy.

The Snapdragon Study is interesting because it's one of the few games that puts students in a "field researcher" role -- counting observations, recording data. But it's aimed at elementary school and is extremely simple.

---

## 4. Gap Analysis

### What is NOBODY doing that we should be doing?

**Nobody simulates the actual experience of being a field researcher.**

Every platform reviewed falls into one of three categories:

1. **God-mode ecosystem managers** (Labster, SimBio, Tyto, Equilinox, Ecosystem, Eco) -- students manipulate parameters and watch populations respond. They are gods. They never crouch down, never get their hands dirty, never flip a rock and find nothing.

2. **Data analysis interfaces** (BioInteractive, PhET, VERA) -- students interact with pre-collected or auto-generated data. The data collection is abstracted away entirely. Students analyze, but they never collect.

3. **Virtual tours** (VR field trips, EcoMUVE, Virtual Field Station) -- students walk through 3D environments and click on highlighted objects. The environment is a navigation space, not a research space. The experience is passive observation, not active investigation.

Nobody -- not a single product in this landscape -- simulates the procedural, repetitive, often frustrating mechanics of field data collection:
- Walking a transect and flipping cover objects one at a time
- Finding nothing under most of them
- The physical interaction of lifting a rock and seeing what's underneath
- The cognitive challenge of identifying a live animal from ambiguous features while it's trying to escape
- Recording measurements and observations in a field notebook with structured data entry
- The accumulated boredom punctuated by excitement when you find something rare

This is what field ecology actually is. Every platform skips it.

### Where does every platform punt on realism?

1. **Species identification is either automated or absent.** Labster and PhET don't have it. BioInteractive has it from static photos. iNaturalist/Seek automate it with AI. Nobody makes students sit with a set of diagnostic features and work through the identification process deliberately.

2. **Negative results don't exist.** In every simulation, every interaction yields data. In real field research, most of your time produces nothing. Our sim is 60% empty cover objects. That ratio is pedagogically critical -- it teaches patience, thoroughness, and the statistical reality that most sampling units are empty.

3. **Environmental variability is decorative.** Labster sets a scene, but weather doesn't affect species detection. PhET's environment is a background image. In our sim, temperature, moisture, time of day, and season all modify encounter probabilities because that's how biology works.

4. **Data collection is instant.** You click a thing and data appears. In our sim, students have to examine the animal, choose features to evaluate, make an identification decision, then manually enter measurements and observations into a field notebook. The data entry is part of the learning.

5. **There is no procedural skill transfer.** No existing simulation teaches students protocols they could actually use in the field. Our cover object survey protocol mirrors real salamander monitoring methodology. A student who completes our simulation has practiced a real research technique.

### What would make a biology student say "this is nothing like the other sims I've used"?

- **The first time they flip a rock and find nothing.** Then the second, third, fourth time. Then they find a red-backed salamander and it feels earned.

- **The ID challenge where two species look almost identical.** Red eft vs. red salamander. Checking skin texture, body shape, spot pattern. Making a call and not being sure. That uncertainty is the authentic experience.

- **The field notebook.** Structured data entry that feels like real field work, not a quiz. Species, SVL measurement, location, substrate, weather conditions. The student produces a dataset, not a score.

- **The data they collect is *their* data.** Not pre-generated, not a fixed answer set. Their survey results depend on their choices -- which site, which season, how many cover objects. Two students get different datasets and have to analyze them differently.

- **The visual quality.** When the forest floor looks like a forest floor. When the salamander looks like a salamander. When the rock has moss on it and the log is decomposing. The bar is not photorealism -- it's ecological legibility. Students need to see the features that matter for identification.

### What's the visual quality floor we need to clear to be taken seriously?

Looking across the landscape:

| Platform | Visual Quality | Taken Seriously? |
|----------|---------------|-------------------|
| PhET | 2D cartoon | Yes -- because it's free and ubiquitous |
| SimBio | 2D dots on maps | Yes -- because the pedagogy is excellent |
| Labster | 3D Unity, polished | Yes -- because institutional sales team |
| BioInteractive | Real photographs | Yes -- because HHMI money |
| EcoMUVE | Dated 3D world | Was, but looks abandoned now |
| Tyto | 3D low-poly | Marginal -- mostly nostalgia |

The floor is higher than PhET but lower than Labster. We don't need Unity-quality 3D. We need:

1. **Ecologically accurate organism illustrations** that show diagnostic features clearly enough for identification challenges to work. This is non-negotiable. If students can't see the difference between rough and smooth skin texture, the simulation fails.

2. **Environmental context that reads as "forest floor"** -- not photorealistic, but atmospherically convincing. Leaf litter, moss, moisture, dappled light. Canvas 2D can do this with careful art direction.

3. **UI that doesn't look like a homework assignment.** Clean, modern, dark-toned (field researchers work in shade). The terminal/hacker aesthetic can work here -- field notebooks, data terminals, research station vibes.

4. **Organism animations that convey behavior** -- a salamander doesn't sit still when you flip its cover object. It tries to hide. That movement is part of the identification challenge (body shape, locomotion style) and part of the immersion.

The quality benchmark is: "this looks like someone who cares about ecology built it, not someone who needed to ship a product."

### How does our "field researcher role-play" approach differ from the "god-mode ecosystem manager" approach?

| Dimension | God-Mode (Everyone Else) | Researcher Role-Play (Us) |
|-----------|--------------------------|---------------------------|
| Perspective | Top-down, omniscient | Ground-level, limited |
| Agency | Control everything | Observe and record |
| Data source | Parameter manipulation | Direct collection |
| Time scale | Generations, populations | Minutes, individuals |
| Failure mode | Ecosystem collapse | Misidentification, incomplete data |
| Skill taught | Systems thinking | Field technique |
| Emotional register | Power fantasy | Patient curiosity |
| Frustration source | Imbalanced parameters | Finding nothing, uncertain IDs |
| Real-world transfer | Conceptual understanding | Procedural field skills |
| What students remember | "I crashed the ecosystem" | "I found the mimic" |

The god-mode approach teaches ecology concepts. Our approach teaches ecology practice. They're complementary, not competing. But nobody is doing ours.

The research literature backs this up: sandbox simulations are often "impractical, expensive, and ultimately less effective" for teaching procedural skills and decision-making compared to narrative-driven, role-play approaches. Our students aren't managing an ecosystem -- they're doing the tedious, careful, rewarding work of learning what lives in one.

---

## Summary: The Competitive Position

**The market has:**
- Excellent concept visualization tools (PhET, VERA)
- Solid population/community ecology parameter simulators (SimBio, Labster)
- Beautiful data analysis interfaces (BioInteractive)
- Fun ecosystem sandbox games (Tyto, Equilinox, Eco)
- Dead or dying VR field trip prototypes (EcoMUVE, VFS)
- Powerful species ID tools for real-world use (iNaturalist, Merlin, HerpMapper)

**The market does not have:**
- A browser-based platform that simulates authentic field ecology research protocols
- A simulation where students identify organisms from ambiguous visual features
- Any product where the majority of interactions yield negative results (empty cover objects), teaching the statistical reality of field sampling
- A tool that produces student-generated datasets for analysis, where the data reflects their choices
- Integration of field technique training with ecological concept learning
- Anything that would make a field biologist say "yeah, that's what it's actually like"

We're building in a gap so wide that nobody is even adjacent to it. The closest analogues are EcoMUVE (dead) and BioInteractive's Lizard Evolution lab (static photos, no environmental immersion). Our advantage is specificity: we're not trying to teach all of ecology. We're teaching students how to do one thing extremely well -- conduct a field survey, identify organisms, collect data, and analyze it. That focused approach is what makes the simulation feel real instead of feeling like a quiz wrapped in a game engine.
