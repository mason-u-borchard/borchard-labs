# Immersive Field Experience -- Design Document

**Goal:** Replace the flat bird's-eye diagram with a three-view camera system that makes
the student feel physically present in the forest.

---

## 1. Three-View System

### View 1: Transect (wide shot)

The navigation view. Full transect visible. Click an unchecked cover object to approach.

**Rendering improvements over current:**
- Increase leaf litter density from 80--150 to 250--350 ellipses with varied hue/size
- Add 2D value noise under the leaf layer for soil color variation
- Soft elliptical drop shadows on cover objects (radial gradient, not hard rectangles)
- 20--40 small pebble scatter (3--6px gray circles)
- Ambient particle overlay: 8--12 falling leaves, slow drift + rotation

**Unchanged:** progress bar, weather HUD, cover object click targets.

### View 2: Approach (medium shot)

Crouching down. The clicked cover object fills ~40% of canvas width. ~1m radius visible.

**Transition in:** 800--1000ms zoom via animated `ctx.setTransform()`, ease-out curve.
During the transition, generate a high-detail ground texture for a ~300x300px area around
the object on an offscreen canvas.

**What the student sees:**
- Cover object at 3--5x transect scale with added detail (bark grain, lichen spots, moss
  colonization on rocks, weathering marks on boards)
- Individual leaf shapes distinguishable in the litter
- Noise-varied soil color underneath
- Moss patches with internal highlight texture
- Peripheral objects dimmed/blurred via vignette
- Dappled light overlay more pronounced

**Interaction:** Click the object to flip it. Flip animation at approach scale (object
lifts up-left, ground patch revealed). After flip:
- Nothing found: brief message, auto-zoom back to transect (600ms)
- Animal found: transition to Examination view (400ms)

**Transition out:** 600--800ms zoom back to transect, ease-in-out.

### View 3: Examination (close-up)

Leaning in. The animal on exposed soil fills the canvas. The moment of identification.

**Transition in:** 400--600ms further zoom from approach, centered on reveal position.

**What the student sees:**
- Animal at ~400px body length with full rendering: skin sheen/stipple, costal grooves,
  individual spots, colored iris, limb articulation
- Dark damp soil patch, moisture sheen, 2--3 decorative invertebrate shapes (pill bug,
  centipede trail)
- Edge of the flipped cover object visible at canvas edge
- Vignette focusing attention on the animal

**ID Challenge:** slides in from right as a 350--400px HTML panel. The canvas (with animal
still visible) occupies the left portion. NOT a centered modal. The student looks at the
animal while choosing features and species.

**Transition out:** after data recording, zoom to approach (400ms), then to transect (600ms).

### Transition Implementation

All zoom is done via canvas coordinate transform -- no CSS scaling of the canvas element.

```
Camera state: { x, y, zoom }
Per frame: ctx.setTransform(zoom, 0, 0, zoom, -x * zoom + canvasW/2, -y * zoom + canvasH/2)
```

Transitions interpolate between source and target camera states using:
```
progress = 1 - Math.pow(1 - t, 3)   // ease-out cubic for zoom-in
progress = t * t * (3 - 2 * t)       // smoothstep for zoom-out
```

Where `t` goes from 0 to 1 over the transition duration.

During transitions, clicks are disabled. Sub-state is `'transitioning'`.

---

## 2. New Files

### ViewManager.js
Manages camera state, view transitions, and coordinate transforms.

- `constructor(canvas)` -- stores canvas reference, initializes camera at transect view
- `getCamera()` -- returns current `{ x, y, zoom }`
- `transitionTo(targetX, targetY, targetZoom, durationMs, easing)` -- starts animated transition
- `update(now)` -- advances transition interpolation, returns true while transitioning
- `applyTransform(ctx)` -- sets `ctx.setTransform()` from current camera
- `screenToWorld(sx, sy)` -- converts click coordinates to world coordinates
- `worldToScreen(wx, wy)` -- converts world coordinates to canvas pixels
- `isTransitioning()` -- returns boolean
- `setView(name, coverObj)` -- shortcuts: 'transect' (zoom=1), 'approach' (zoom=3.5, center on obj), 'examination' (zoom=8, center on reveal)

### TextureGenerator.js
Procedural noise and texture rendering for forest floor detail.

- `constructor()` -- seeds the noise function
- `generateNoise2D(width, height, scale, octaves)` -- returns a Float32Array of noise values
- `renderGroundTexture(canvas, width, height, season, soilColors)` -- fills an offscreen canvas with noise-based soil + leaf litter
- `renderDetailPatch(canvas, cx, cy, radius, season)` -- renders a high-detail ground patch for approach view
- `renderMoss(ctx, x, y, width, height, wetness)` -- draws a naturalistic moss patch

Internal: 2D value noise with cosine interpolation, 2--3 octave fractal stacking.

### ParticleSystem.js
Ambient atmosphere particles.

- `constructor(canvasWidth, canvasHeight)` -- initializes particle pool
- `spawn(type, count)` -- types: 'leaf', 'dust', 'mist', 'rain'
- `update(dt)` -- advances all particles (position, rotation, life)
- `render(ctx, camera)` -- draws all live particles, respecting camera transform
- `setMaxParticles(n)` -- adjusts pool size per view (12 for transect, 6 for approach)
- `clear()` -- removes all particles

Each particle: `{ x, y, vx, vy, rotation, rotSpeed, life, maxLife, size, type, color, alpha }`

### SoundManager.js
Web Audio API wrapper for ambient + interaction sounds.

- `constructor()` -- creates AudioContext (suspended until first user interaction)
- `loadSound(name, url)` -- fetches and decodes an audio buffer
- `play(name, volume, loop)` -- plays a sound. Returns a handle for stopping loops
- `stop(handle)` -- stops a looped sound
- `setMasterVolume(v)` -- 0--1
- `mute()` / `unmute()`
- `resume()` -- resumes AudioContext after user gesture

Sounds to load (all procedurally generated or from small audio sprites):
- `ambient-forest` -- 15--30s loop, layered birds/stream/wind (~100KB)
- `leaf-crunch` -- 0.3s, approach transition (~5KB)
- `rock-scrape` -- 0.5s, flip action (~8KB)
- `soil-squelch` -- 0.2s, reveal (~4KB)

If audio assets are too much scope for v1, defer entirely. The three-view system is the
priority.

---

## 3. Modified Files

### BatesianMimicrySim.js
- Add ViewManager as a component (created in init, updated in render loop)
- Add sub-state `'transitioning'` -- blocks clicks during view changes
- `_handleCanvasClick` converts screen coords to world coords via ViewManager
- `_flipCoverObject` triggers approach->examination transition
- `_onFlipComplete` for salamander: transition to examination, then show ID panel
- `_onRecordSaved` triggers examination->approach->transect transitions
- Add ParticleSystem, updated each frame
- Add SoundManager (optional), trigger sounds on approach/flip/reveal

### ForestEnvironment.js
- `_prerenderBackground` uses TextureGenerator for richer soil + litter
- Add `renderApproachDetail(ctx, coverObj, scale)` -- renders high-detail ground patch
- Cover object shadows become soft elliptical gradients

### CoverObject.js
- Add `renderApproach(ctx)` -- higher-detail drawing for 3--5x zoom (bark grain, lichen,
  moss patches on rocks, knot detail on logs)
- Flip animation tuning: slower start (anticipation), faster reveal. Ease-out cubic.
  Total duration 400ms (up from 250ms).
- Add cursor affordance: `pointer` on hover in transect, `grab`/`grabbing` in approach

### Salamander.js
- `renderLarge` upgraded: dorsal highlight gradient, ventral shadow, specular wet spots,
  granular stippling for NOVI (seeded PRNG for consistency)
- Costal grooves rendered as subtle curved lines, not just straight verticals
- Eye rendering: pupil + iris ring + specular dot
- Individual spot positions generated from seeded PRNG (consistent across frames)

### IdentificationChallenge.js
- Convert from centered modal to right-edge slide-in panel (350px, CSS transition)
- Panel background: var(--parchment), left border: 2px solid var(--border)
- Canvas stays visible on the left with the animal in context
- Feature hints styled as inline cards, not a bullet list
- On show: adjust canvas container width to accommodate the panel

---

## 4. Cover Object Detail Levels

Each cover object type renders differently at each zoom level:

### Rock
- **Transect (1x):** Irregular polygon (existing vertices), gray gradient fill, soft shadow
- **Approach (3.5x):** Add lichen spots (small yellow-green circles), surface cracks (thin
  dark lines), half-buried soil crust around base, moss on top surface
- **Examination:** Not directly rendered (it's flipped aside), but the edge is visible

### Log
- **Transect:** Rounded rectangle, bark brown fill, grain lines
- **Approach:** Peeling bark edges, shelf fungus brackets (tiny half-circles), moss along
  upper surface, cross-section ring visible on cut end, darker underside where moisture sits

### Board
- **Transect:** Clean rectangle, pale wood color
- **Approach:** Weathered gray surface, warped edges from moisture, algae staining
  (green-gray wash), nail holes

### Bark Piece
- **Transect:** Thin curved shape, light brown
- **Approach:** Rough inner surface texture, curled edges, beetle gallery traces

---

## 5. Salamander Rendering Upgrade

### Skin Rendering
- **Smooth species (plethodontids, P. ruber):** base fill -> dorsal highlight (radial
  gradient, white at 18% opacity) -> ventral shadow (linear gradient, black at 15%) ->
  2--3 specular wet spots (white ellipses at 25% opacity, seeded random positions)
- **Granular species (NOVI eft):** base fill -> dense stippling (120 dots at 6% opacity,
  0.4--0.8px radius, seeded PRNG) -> skip the smooth sheen

### Spot Patterns (upgraded)
- **Eft bordered-rows:** Spots have subtle inner gradient (lighter center -> darker edge
  within the red fill). Black borders are 1.2px wide with slight feathering via shadow
- **P. ruber scattered:** Spots are irregular ovals (not circles). Size varies more.
  Young animals: 8--12 spots, bright background. Old animals: 20--30 spots, some merged
  (overlapping fills), darker background
- **All spots:** Generated from seeded PRNG per individual so they're consistent across
  frames but different between animals

### Eyes
Three-layer rendering at examination scale:
1. Dark pupil circle (black)
2. Iris ring -- species-specific color (dark for NOVI, gold for PSRU)
3. Tiny white specular highlight dot (upper-left quadrant)

At approach scale: single colored dot. At transect scale: not visible.

### Body Shape
Keep the current programmatic bezier approach but refine proportions:
- Trunk and head ellipses -> joined bezier paths with smoother neck transitions
- Tail taper follows a quadratic curve, not linear
- Limbs: add toe suggestions (3 tiny lines at foot end) at approach/examination scale

---

## 6. Atmospheric Effects

### Particles
- **Transect view:** 8--12 falling leaves (slow rotation, 0.3--0.8px/frame drift, autumn
  colors or green depending on season). 4--6 dust motes in light beams (tiny bright
  circles, random walk)
- **Approach view:** 3--5 leaves (closer = bigger), 2--3 dust motes
- **Examination view:** 1--2 leaves at edge of frame only. Minimal distraction.

### Lighting
- Pre-rendered noise-based light map (same resolution as background canvas)
- Applied via `globalCompositeOperation = 'soft-light'` over the ground texture
- In approach view: more contrast (deeper shadows, brighter highlights)
- Examination view: even lighting (diagnostic clarity over atmosphere)
- Vignette: radial gradient from transparent center to rgba(0,0,0,0.3) at edges.
  Stronger in examination view.

### Cursor States
- Transect view, hovering unchecked object: `pointer`
- Approach view, hovering the object: `grab`
- During flip: `grabbing`
- After reveal: `crosshair` (examination)
- Default: `default`

---

## 7. Performance Budget

Target: 60fps on 2020-era integrated graphics laptop.

| Component | Frame Time Budget |
|-----------|------------------|
| Background blit (offscreen -> main) | 0.5ms |
| Cover objects (transect: 40 objects) | 1.5ms |
| Particles (12 max) | 0.3ms |
| Light map overlay | 0.3ms |
| ViewManager transform | 0.1ms |
| Salamander (examination, full detail) | 1.5ms |
| **Total** | **~4.2ms** (well under 16.67ms) |

Offscreen canvases (max 5):
- Transect background: canvas-width x canvas-height (~1.5MB)
- Approach detail patch: 512x512 (~1MB)
- Light map: half-resolution (~0.4MB)
- Noise seed texture: 256x256 (~0.25MB)
- Vignette overlay: canvas-width x canvas-height (~1.5MB)
- **Total: ~4.7MB**

Particle pool: max 20 objects. No allocation during gameplay.

---

## 8. Implementation Order

### Phase A: Foundation (ViewManager + TextureGenerator)
1. Write ViewManager.js with camera state and animated transitions
2. Write TextureGenerator.js with 2D value noise and ground texture generation
3. Integrate ViewManager into BatesianMimicrySim render loop
4. Wire transect->approach transition on cover object click
5. Wire approach->transect transition on back/escape

### Phase B: Approach View Rendering
6. Add CoverObject.renderApproach() with per-type detail
7. ForestEnvironment.renderApproachDetail() for high-detail ground patch
8. Wire flip animation at approach scale
9. Approach->examination transition on animal found
10. Examination->approach->transect after data recording

### Phase C: Examination View + ID Panel Redesign
11. Upgrade Salamander.renderLarge() with skin sheen, stipple, spots, eyes
12. Convert IdentificationChallenge from modal to side panel
13. Animal stays visible on canvas during ID
14. Wire the full examination sub-state flow

### Phase D: Atmosphere
15. Write ParticleSystem.js with falling leaves and dust motes
16. Add noise-based light map overlay
17. Add vignette overlay
18. Cursor state changes per view
19. (Optional) Write SoundManager.js and add ambient + interaction sounds

### Phase E: Polish
20. Tune all transition timings and easing curves
21. Test on tablet/mobile viewport sizes
22. Verify ID challenge accuracy still works correctly
23. Verify field notebook data flow is intact
24. Performance profiling and optimization
