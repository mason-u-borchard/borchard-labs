# Rendering Architecture -- Immersive Field View System

**Status:** Design spec, pre-implementation
**Stack:** Vanilla JS + Canvas 2D API + HTML overlays
**Date:** 2026-04-04

---

## Overview

The current simulation renders everything in a single flat bird's-eye view. Cover objects read as diagram elements -- geometric shapes on a tinted rectangle. The overhaul replaces this with a three-view camera system that simulates the physical experience of walking a transect, approaching a cover object, and examining what's underneath.

No WebGL. No frameworks. No bundlers. Everything runs on a single `<canvas>` element with HTML overlays for UI panels.

---

## 1. Three-View System Architecture

### 1.1 View 1: Transect View (Wide Shot)

The entry point. Shows the full transect area from above -- the student's mental map of where they are in the survey.

**Camera:** Static top-down. No scroll, no pan. The entire survey area fits the canvas.

**What the student sees:**
- Forest floor filling the canvas -- soil gradient, leaf litter patches, moss, twig debris (same content as the current `_prerenderBackground()`, but with improved texture density and variation)
- Cover objects rendered at survey scale (~25-80px wide depending on type), sitting naturally on the ground with drop shadows
- Subtle dashed transect boundary lines on left/right edges
- Progress dots along the bottom strip
- Weather HUD along the top

**What changes from current:**
- The background texture needs more depth. Right now `ForestEnvironment._prerenderBackground()` draws 80-150 leaf ellipses, 5-10 moss circles, and 15-25 twig lines. That's sparse for a forest floor. Bump leaf litter to 200-300, add a noise-based soil variation layer underneath, and scatter small rock pebbles (3-6px gray circles, 20-40 of them).
- Cover objects need subtle ambient shadow -- currently they get a hard `rgba(0,0,0,0.20)` offset rectangle. Replace with a soft elliptical shadow using a radial gradient from `rgba(0,0,0,0.15)` to transparent, positioned slightly below/right of the object.
- Add a particle overlay layer for falling leaves (see Section 4).

**Rendering order:**
1. Pre-rendered background canvas (soil + litter + moss + twigs + pebbles)
2. Ambient shadow layer for cover objects
3. Cover objects themselves
4. Revealed animals (on uncovered objects)
5. Particle overlay (falling leaves, dust)
6. Progress bar
7. Field HUD (HTML overlay, not canvas-rendered)

**Interaction:** Clicking an unchecked cover object triggers the transition to Approach View.

---

### 1.2 View 2: Approach View (Medium Shot)

The student walks forward and crouches down. The selected cover object fills roughly 40% of the canvas width. The surrounding ~1 meter radius of forest floor is visible in detail.

**Camera:** Zoom transition from the transect view. The canvas `ctx` transform scales up and translates to center the selected object. No actual camera entity -- it's a coordinate transform on the same canvas.

**What the student sees:**
- The selected cover object rendered at 3-5x the transect scale, with additional detail: visible bark grain on logs, lichen spots on rocks, weathering marks on boards, slight curl on bark pieces
- Surrounding ground texture rendered at higher detail -- individual leaf shapes are distinguishable, soil color varies via noise, moss patches have visible internal texture (lighter highlights on top edges)
- Other nearby cover objects visible at the edges, slightly blurred or darkened to indicate they're not the focus
- The dappled sunlight overlay is more pronounced at this zoom level (see Section 4.2)

**What it takes to render this:**
- Generate a high-detail ground texture for a ~300x300 logical-pixel area centered on the clicked object. This gets rendered to a dedicated offscreen canvas during the zoom transition (the 800-1200ms animation provides time to generate it without blocking).
- The cover object itself needs a higher-detail render path. `CoverObject._drawRock()`, `_drawLog()`, etc. already have decent shape geometry, but at 3-5x zoom the texture lines and grain need more density. Add a `renderApproach(ctx, scale)` method that draws additional detail strokes.
- Nearby cover objects can be drawn from their existing render path -- no need for a second detail level on non-focused objects.

**Interaction:** Clicking the focused cover object flips it. The flip animation plays at the approach scale (object lifts up-left, ground patch revealed). After the flip completes:
- If nothing interesting: brief message, then auto-zoom back to transect
- If a salamander is found: transition to Examination View

---

### 1.3 View 3: Examination View (Close-Up)

The student leans in to examine the animal. The revealed ground area and the animal fill most of the canvas.

**Camera:** Further zoom from the approach view, centered on the ground patch where the animal sits. Scale is roughly 8-12x the transect view.

**What the student sees:**
- The animal rendered at ~400px body length with full detail -- skin texture (granular dots for NOVI, smooth sheen for plethodontids), costal grooves, spot patterns, eye color, limb articulation. The existing `drawSalamanderBody()` function's `detail=true` path is already built for this; it just needs to be called at a larger scale.
- The exposed soil patch underneath, with moisture sheen and small invertebrate debris (couple of tiny isopod shapes, an ant trail -- purely decorative, 2-3 lines of code each)
- The edge of the flipped cover object visible at the left or top of the frame
- A vignette darkening the edges, focusing attention on the animal

**The ID challenge panel:**
- Slides in from the right edge as a 350-400px wide HTML panel
- The canvas (with the animal still visible and rendering) occupies the remaining left portion
- The panel contains: observable feature checklist, species options with radio buttons, submit button
- This is NOT a centered modal with a backdrop. The animal stays visible the entire time the student is making their decision. This is critical -- the whole point is that they're looking at the animal while thinking through the key features.

**Interaction:** Student selects a species and submits. Feedback appears in the panel. After clicking Continue, the student records data in the field notebook. Then the view zooms back to Approach, then to Transect.

---

### 1.4 View Transitions

All transitions are canvas transform animations. No CSS transforms on the canvas element itself -- that would blur the pixel rendering.

**Transect -> Approach:**
- Duration: 800-1200ms
- Easing: ease-out (fast start, gentle settle -- like walking forward and stopping)
- Implementation: each frame, interpolate scale and translate values, apply via `ctx.setTransform()`
- Start generating the approach-view ground texture on a separate offscreen canvas as soon as the transition begins. If it finishes before the transition completes, swap it in seamlessly. If not, the transect-level texture is still visible (just lower detail, which is fine during motion).

**Approach -> Examination:**
- Duration: 400-600ms
- Easing: ease-out
- Triggered after the flip animation completes and a salamander is confirmed
- Simultaneously, the ID challenge panel begins its slide-in animation (300ms, so it arrives during or just after the zoom)

**Examination -> Approach:**
- Duration: 600ms
- Easing: ease-in-out
- Triggered after the student finishes recording data
- The ID panel slides out simultaneously

**Approach -> Transect:**
- Duration: 800ms
- Easing: ease-in-out
- Returns to the full survey view

**Implementation approach -- animated `ctx.setTransform()`:**

```js
// ViewManager maintains current and target transform state
var current = { scale: 1, tx: 0, ty: 0 };
var target  = { scale: 1, tx: 0, ty: 0 };
var transitionStart = 0;
var transitionDuration = 0;
var transitioning = false;

function applyTransform(ctx, t) {
    // t is a normalized progress value, 0-1
    var s = lerp(current.scale, target.scale, t);
    var x = lerp(current.tx, target.tx, t);
    var y = lerp(current.ty, target.ty, t);
    ctx.setTransform(s, 0, 0, s, x, y);
}

function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}
```

The main render loop in `BatesianMimicrySim.render()` calls `ViewManager.applyTransform(ctx)` before any drawing, and `ctx.setTransform(1,0,0,1,0,0)` after drawing (to reset for HUD/overlay rendering that should be in screen space).

**Alternative -- offscreen canvas crossfade:**

Instead of animating the transform on the live canvas, pre-render each view level to its own offscreen canvas and crossfade between them during transitions. This avoids the "zooming into low-res pixels" problem during the transect-to-approach transition.

Tradeoffs:
- Pro: each view is rendered at its native resolution, no upscaling artifacts
- Pro: transition is a simple alpha blend, very cheap
- Con: requires maintaining 2-3 offscreen canvases at full resolution (memory)
- Con: the "zoom" effect is less convincing -- it's a dissolve, not a dolly

Recommendation: use `ctx.setTransform()` for the actual zoom animation, but start rendering the high-detail approach/examination content to an offscreen canvas during the transition. Swap in the high-detail canvas once it's ready. The brief moment of upscaled pixels during the zoom is acceptable and actually reinforces the spatial continuity.

---

## 2. Canvas Rendering Techniques

### 2.1 Procedural Texture Generation

All textures are generated in JS at init time and cached to offscreen canvases. No image assets for ground textures.

**Leaf litter:**
- Each leaf is an ellipse with randomized hue, saturation, size (4-12px radius), rotation, and opacity (0.3-0.6)
- At approach-view zoom, add leaf vein detail: 2-3 thin lines from the center of the ellipse toward the edges, drawn with `ctx.strokeStyle` at 0.5px lineWidth and low opacity
- Color palette pulled from `COLORS[season].litter` with individual hue jitter of +/-10 degrees
- Overlap leaves naturally -- later leaves partially cover earlier ones, creating depth
- Some leaves should be partial (half off the edge of a rock, tucked under a log) -- achieved by drawing them after cover objects with clipping, but this is a v2 detail

**Soil:**
- Base color from `COLORS.soil` / `COLORS.soilLight` gradient (already implemented)
- Add noise-based color variation on top: sample a 2D noise function at each pixel, use the value to interpolate between `COLORS.soil` and `COLORS.soilDark`
- At approach-view zoom, increase noise frequency so individual pebbles and color patches are visible
- Moisture variation: in areas near cover objects and moss patches, shift hue slightly toward blue and darken by 10-15%

**Moss:**
- Current implementation: simple circles with low opacity. Upgrade to irregular blobs.
- Generate moss patch outlines using 8-12 radial samples with noise-based offset from a base radius
- Internal texture: lighter green highlights in the upper-left quadrant (simulating light direction), tiny dark dots scattered inside (spore capsules at detail view)
- At approach zoom: add fractal edge detail by subdividing the outline with midpoint displacement

**Bark (on logs and bark pieces):**
- The current implementation draws 3-4 horizontal grain lines. At approach zoom, increase to 8-12 lines with slight random vertical offset and varying opacity.
- Add knot detail: small concentric ellipses at 1-3 random positions
- Color variation along the grain: sample noise to modulate lightness by +/-5%

**Rock surfaces:**
- The current radial gradient gives a basic 3D effect. At approach zoom, add:
  - Mottled color variation via noise (gray values between `COLORS.rockDark` and `COLORS.rockLight`)
  - A specular highlight: small white-ish ellipse at roughly the 10 o'clock position, `globalAlpha` 0.08
  - Crevice lines: 2-4 thin dark strokes following the rock's edge contour but slightly inset

---

### 2.2 Layered Rendering Pipeline

Each frame, layers are drawn in this order. Some layers are pre-rendered to offscreen canvases and blitted; others are drawn live.

```
Layer 0: Background fill
         Deep forest shade -- a single dark green-brown rectangle
         ctx.fillStyle = '#3a4a38'  (or darker depending on weather)

Layer 1: Ground texture (pre-rendered offscreen canvas)
         Soil noise + leaf litter + pebbles
         Blitted via ctx.drawImage(bgCanvas, 0, 0)

Layer 2: Moss and vegetation patches (pre-rendered with ground)

Layer 3: Cover object shadows
         Soft elliptical radial gradients beneath each object
         Drawn live (positions don't change, but shadows shift
         slightly during flip animation)

Layer 4: Cover objects
         Drawn live from CoverObject.render()
         At approach/examination zoom, detail level increases

Layer 5: Animals (if revealed)
         Drawn live from Salamander.render()
         At examination zoom, rendered at 400px body length

Layer 6: Foreground debris
         A few leaf shapes and twig segments drawn ON TOP of
         cover objects. This is the key depth cue -- objects
         look embedded in the environment rather than floating.
         Pre-rendered to a sparse overlay canvas at init.

Layer 7: Atmospheric overlay
         Dappled light, vignette, mist particles
         Drawn live or composited from a pre-rendered light map

Layer 8: UI overlay
         HUD, panels, messages -- HTML elements, not canvas
```

---

### 2.3 Pre-Rendering Strategy

**Transect-view ground texture:**
- Render once at init to an offscreen canvas matching the main canvas dimensions
- Invalidate and regenerate on resize (already implemented in `ForestEnvironment._prerenderBackground()`)
- Contains: soil gradient, noise variation, leaf litter (200-300 ellipses), moss patches (5-10), twig debris (15-25), pebbles (20-40)
- Expected generation time: <30ms for a 900x562 canvas

**Approach-view ground detail:**
- Render a 600x600px offscreen canvas (at 2x the visible area to allow slight camera drift)
- Generated on-demand when the student clicks a cover object, during the zoom transition
- Contains: high-frequency soil noise, detailed leaf shapes (50-80 in the visible area), moss internal texture, small invertebrate debris
- Generation can be amortized: start rendering rows incrementally across animation frames if it takes >16ms

**Cover object detail canvases:**
- For each cover type (rock, log, bark, board), pre-render a high-detail version to a small offscreen canvas (e.g., 200x150px) at init
- When approaching a specific object, composite its detail canvas at the correct position
- This avoids re-running the detail drawing code every frame during approach view

**Foreground debris overlay:**
- Render once at init: a sparse canvas with ~10-15 leaf shapes and 5-8 twig segments placed at random positions
- These overlap the cover objects when blitted on top, creating the illusion that objects are embedded in litter rather than placed on a clean surface
- Keep this canvas mostly transparent -- only a few elements per 100x100px region

**Animal examination canvas:**
- When transitioning to examination view, render the salamander at 400px body length to a dedicated offscreen canvas (500x300px)
- This pre-render means the examination view is a single `drawImage()` call per frame, no re-running the complex `drawSalamanderBody()` with 60+ detail elements each frame
- Invalidate if the student somehow returns and re-examines (unlikely in normal flow)

---

### 2.4 Noise Function (Pure JS)

A 2D value noise implementation for soil texture, moss edges, and dappled light. Full Perlin is overkill -- linear or cosine-interpolated value noise with 2-3 octaves produces convincing organic variation at the scales we need.

```js
/**
 * Simple 2D value noise with cosine interpolation.
 *
 * Usage:
 *   var noise = new ValueNoise2D(seed);
 *   var val = noise.sample(x, y);           // single sample, range [0, 1]
 *   var val = noise.fractal(x, y, 3, 0.5);  // 3 octaves, persistence 0.5
 */
function ValueNoise2D(seed) {
    // build a 256-entry permutation table from the seed
    this._perm = new Uint8Array(512);
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;

    // Fisher-Yates shuffle seeded by a simple LCG
    var s = seed & 0xffffffff;
    for (var i = 255; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        var j = ((s >>> 0) % (i + 1));
        var tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }

    for (var i = 0; i < 512; i++) this._perm[i] = p[i & 255];
}

ValueNoise2D.prototype._hash = function(ix, iy) {
    return this._perm[(this._perm[ix & 255] + iy) & 255] / 255;
};

ValueNoise2D.prototype.sample = function(x, y) {
    var ix = Math.floor(x);
    var iy = Math.floor(y);
    var fx = x - ix;
    var fy = y - iy;

    // cosine interpolation factor
    var ux = (1 - Math.cos(fx * Math.PI)) * 0.5;
    var uy = (1 - Math.cos(fy * Math.PI)) * 0.5;

    var v00 = this._hash(ix, iy);
    var v10 = this._hash(ix + 1, iy);
    var v01 = this._hash(ix, iy + 1);
    var v11 = this._hash(ix + 1, iy + 1);

    var top = v00 + (v10 - v00) * ux;
    var bot = v01 + (v11 - v01) * ux;
    return top + (bot - top) * uy;
};

ValueNoise2D.prototype.fractal = function(x, y, octaves, persistence) {
    var total = 0;
    var amplitude = 1;
    var frequency = 1;
    var maxValue = 0;

    for (var i = 0; i < octaves; i++) {
        total += this.sample(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }

    return total / maxValue;
};
```

**Performance expectation:** Generating a 512x512 noise texture at 2 octaves requires ~524k `sample()` calls. Each call does 4 hash lookups, 2 cosine operations, and a handful of multiplies. On a 2020-era laptop this runs in ~20-40ms, well within the budget for an init-time operation. If we need to generate during a transition, we can split it across 4 frames (128 rows per frame at ~5-10ms each).

---

## 3. Atmospheric Effects

### 3.1 Particle System

A lightweight array-based particle system. No classes, no inheritance -- just a flat array of particle objects updated each frame.

**Particle types:**

| Type | Count | Size (px) | Speed (px/frame) | Lifetime (frames) | Behavior |
|------|-------|-----------|-------------------|--------------------|----------|
| Falling leaf | 5-15 | 4-8 | 0.5-1.5 vy, 0.2-0.8 vx | 180-360 | Rotation drift, sine-wave horizontal oscillation |
| Dust mote | 3-8 | 1-2 | 0.1-0.3 random | 120-240 | Brownian drift, only visible in "light beam" areas |
| Mist wisp | 2-5 | 30-60 | 0.1-0.2 vx | 300-600 | Large semi-transparent circles, fade in/out over lifetime |
| Rain streak | 0 or 20-40 | 1x10-20 | 4-6 vy, -1 vx | 30-60 | Diagonal lines, splash particle on ground contact |

**Data structure:**

```js
// each particle is a plain object
var particle = {
    type: 'leaf',     // 'leaf' | 'dust' | 'mist' | 'rain'
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,          // remaining frames
    maxLife: 0,       // for computing alpha fade
    size: 0,
    rotation: 0,
    rotSpeed: 0,      // radians per frame
    phase: 0          // for sine-wave oscillation
};
```

**Update loop:**

```js
ParticleSystem.prototype.update = function() {
    for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.life--;

        if (p.life <= 0) {
            // remove dead particle, replace with new one from emitter
            this.particles.splice(i, 1);
            continue;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        // leaf: sine oscillation on x
        if (p.type === 'leaf') {
            p.x += Math.sin(p.phase) * 0.3;
            p.phase += 0.02;
        }
    }

    // emit new particles to maintain target count per type
    this._emit();
};
```

**Render:** Each particle type has a small draw function. Leaves are filled ellipses with a rotation transform. Dust motes are small circles with `globalAlpha` proportional to remaining life. Mist is large circles with very low alpha (0.03-0.06). Rain is a short angled line.

**View-level adjustment:** In approach view, reduce particle count (smaller visible area means fewer particles needed). In examination view, particles are paused or reduced to 1-2 dust motes -- the focus should be on the animal.

---

### 3.2 Lighting

**Dappled sunlight:**
- Pre-render a "light map" to an offscreen canvas at init
- Use the noise function (Section 2.4) sampled at low frequency (scale 0.02-0.04) to create organic-shaped bright patches
- Apply as an overlay: `ctx.globalCompositeOperation = 'soft-light'`, draw the light map, reset composite operation
- In clear weather: light map contrast is high (bright spots at alpha 0.15-0.20)
- In overcast weather: light map contrast is low (nearly uniform, alpha 0.03-0.05)
- In approach/examination views: the light map is zoomed with the scene, so dappled patches appear larger and more dramatic

**Overcast lighting:**
- Apply a color wash over the entire scene after all game elements are drawn
- `ctx.globalCompositeOperation = 'multiply'`, fill with `rgba(180, 190, 210, 0.08)` for a slight cool desaturation
- This is cheap (one fillRect) and gives a convincing overcast feel

**Vignette:**
- A radial gradient from transparent at center to `rgba(0, 0, 0, 0.25)` at edges
- Pre-rendered to an offscreen canvas (same size as main canvas, regenerate on resize)
- Blitted as the last canvas layer before UI
- In examination view: tighten the vignette (smaller transparent center) to focus attention

**Implementation note:** The composite operations (`soft-light`, `multiply`, `overlay`) are well-supported in Canvas 2D across all modern browsers. They're also fast because the GPU handles the blending on most platforms. No polyfill needed.

---

### 3.3 Sound (Web Audio API)

Sound design for spatial immersion. All audio runs through the Web Audio API for precise timing and volume control.

**Ambient loop:**
- A ~30-second seamless forest ambient track (birds, insects, wind through leaves)
- Loaded as an ArrayBuffer, decoded with `AudioContext.decodeAudioData()`
- Played via a `BufferSourceNode` with `loop = true`
- Connected through a `GainNode` for volume control
- Target file size: ~150KB (mono, 22050 Hz, compressed as OGG with MP3 fallback)
- Loop point: the file must be authored with a seamless loop -- no click at the boundary

**Interaction sounds:**

| Event | Sound | Duration | Trigger |
|-------|-------|----------|---------|
| Approach | Leaf crunch / footstep | ~0.3s | Transect -> Approach transition starts |
| Flip (rock) | Stone scrape | ~0.5s | Cover object flip begins |
| Flip (log/bark) | Wood creak | ~0.4s | Cover object flip begins |
| Flip (board) | Board lift | ~0.3s | Cover object flip begins |
| Reveal (animal found) | Wet soil squelch | ~0.2s | Animal revealed after flip |
| Reveal (empty) | Quiet thud | ~0.1s | Nothing found |
| Data recording | Pencil scratch | ~0.8s, looped softly | Notebook entry form opens |
| Panel slide | Soft whoosh | ~0.2s | ID challenge panel slides in |

**Architecture:**

```js
function SoundManager() {
    this._ctx = null;        // AudioContext, created on first user interaction
    this._masterGain = null;
    this._buffers = {};      // name -> AudioBuffer
    this._ambientSource = null;
    this._muted = false;
    this._volume = 0.6;
}

SoundManager.prototype.init = function() {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);
};

SoundManager.prototype.load = function(name, url) {
    var self = this;
    return fetch(url)
        .then(function(res) { return res.arrayBuffer(); })
        .then(function(buf) { return self._ctx.decodeAudioData(buf); })
        .then(function(decoded) { self._buffers[name] = decoded; });
};

SoundManager.prototype.play = function(name, options) {
    if (this._muted || !this._buffers[name]) return;
    var source = this._ctx.createBufferSource();
    source.buffer = this._buffers[name];
    if (options && options.loop) source.loop = true;

    var gain = this._ctx.createGain();
    gain.gain.value = (options && options.volume) || 1.0;
    source.connect(gain);
    gain.connect(this._masterGain);
    source.start(0);
    return { source: source, gain: gain };
};
```

**Volume control:** A mute toggle button in the field HUD. A volume slider in settings (if we add a settings panel). The `_masterGain` node controls global volume; individual sounds can have their own gain for mixing (ambient at 0.4, interaction sounds at 0.7-1.0).

**Audio budget:** Total audio assets should stay under 300KB. At OGG quality ~48kbps mono, the 30-second ambient loop is ~180KB. The interaction sounds are 0.1-0.8 seconds each, totaling ~5 seconds, which at 48kbps is ~30KB. Well within budget.

**AudioContext resume:** Browsers require a user gesture before AudioContext can produce sound. Initialize the AudioContext on the first canvas click or the "Start Survey" button click. Call `this._ctx.resume()` to handle the auto-suspend policy.

---

## 4. HTML Overlay Redesign

### 4.1 ID Challenge: Side Panel Instead of Modal

**Current implementation (`IdentificationChallenge.js`):**
- A fixed-position backdrop (`position: fixed; inset: 0`) with a centered modal
- The backdrop is `rgba(0, 0, 0, 0.55)` -- completely obscures the canvas
- The modal is 700px max-width, vertically centered
- Contains its own canvas (300x200) for the salamander preview

**New implementation:**
- Remove the backdrop entirely. No overlay, no dimming.
- The panel is a `position: absolute` element, anchored to the right edge of the simulation container (not the viewport)
- Width: 380px. Height: 100% of the container.
- Slides in from `right: -380px` to `right: 0` over 300ms, `ease-out`
- The main canvas (showing the animal in examination view) continues rendering on the left side
- The panel does NOT contain its own canvas anymore -- the animal is visible on the main canvas. The panel only has text content: feature checklist, species options, submit button, result feedback.

**Panel structure:**

```
+------------------------------------------+
|  [Canvas -- examination view]   | ID     |
|                                 | Panel  |
|  Salamander on exposed soil     |        |
|  with vignette and lighting     | Feature|
|                                 | list   |
|                                 |        |
|                                 | Species|
|                                 | options|
|                                 |        |
|                                 | Submit |
+------------------------------------------+
```

**CSS approach:**

```css
.idc-panel {
    position: absolute;
    top: 0;
    right: -380px;              /* hidden by default */
    width: 380px;
    height: 100%;
    background: var(--parchment);
    border-left: 1px solid var(--border);
    box-shadow: -4px 0 16px var(--shadow-md);
    padding: var(--space-md) var(--space-lg);
    overflow-y: auto;
    transition: right 0.3s ease-out;
    z-index: 10;
}

.idc-panel.idc-visible {
    right: 0;
}
```

**Canvas width adjustment:** When the panel slides in, the canvas doesn't need to resize -- the panel overlaps the right portion. At examination zoom, the animal is centered in the left 60% of the canvas anyway (the zoom target is offset to account for the panel). If we want to be precise, shift the examination view's center-x leftward by `panelWidth / 2` so the animal is centered in the visible canvas area.

**Removing the internal canvas:** The current modal has a 300x200 canvas where `salamander.renderLarge()` is called. In the new design, the animal is rendered at 400px body length on the main canvas in examination view. The panel doesn't need its own canvas. Remove `this._canvas` from `IdentificationChallenge` and the `idc-canvas-wrap` element.

**Keyboard interaction:** Keep the number-key selection and Enter-to-submit shortcuts. Add `Tab` to cycle focus between the canvas and the panel. `Escape` closes the panel and returns to approach view (skipping the ID, same as current behavior).

---

### 4.2 Field Notebook Redesign

The notebook currently sits below the canvas as a standard HTML table/form. The overhaul:

- Keep it below the canvas, but styled as a physical field notebook
- Background: `var(--parchment-warm)` with a subtle paper texture (CSS repeating gradient that simulates ruled lines)
- Top border: a torn-edge effect (CSS clip-path with a jagged polygon) or just a heavier border with rounded corners
- Header: "Field Notebook" in Merriweather italic, slightly larger
- During data recording: the notebook panel expands upward, its top edge overlapping the bottom 20-30px of the canvas, creating the effect of pulling a notebook out of a pack
- The overlap is achieved with a negative `margin-top` and `position: relative; z-index: 5`

**Ruled lines:**

```css
.field-notebook {
    background: var(--parchment-warm);
    background-image: repeating-linear-gradient(
        transparent,
        transparent 27px,
        rgba(180, 170, 155, 0.25) 27px,
        rgba(180, 170, 155, 0.25) 28px
    );
}
```

---

## 5. Performance Budget

### 5.1 Frame Rate Target

60fps on a 2020-era laptop with integrated graphics (Intel UHD 620 or equivalent). This means each frame must complete in under 16.67ms.

**Frame time budget breakdown:**

| Operation | Budget | Notes |
|-----------|--------|-------|
| Clear canvas | <0.5ms | Single `clearRect` |
| Blit background | <1ms | Single `drawImage` from offscreen canvas |
| Draw cover objects | <2ms | 40 objects at survey scale, simple shapes |
| Draw animals | <1ms | 0-3 visible, moderate complexity |
| Particle update + render | <2ms | 15-30 particles, simple shapes |
| Atmospheric overlay | <1ms | Blit pre-rendered light map + vignette |
| Total | <7.5ms | Leaves ~9ms headroom |

During transitions, the frame budget is tighter because we're also interpolating transforms and potentially generating textures. The transform interpolation itself is trivial (<0.1ms). Texture generation is offloaded to idle frames or amortized.

### 5.2 Memory Budget

**Offscreen canvases:**

| Canvas | Dimensions | Bytes (RGBA) | Purpose |
|--------|-----------|--------------|---------|
| Transect background | 900x562 | ~2.0 MB | Soil + litter + moss |
| Approach detail | 600x600 | ~1.4 MB | High-detail ground texture |
| Animal examination | 500x300 | ~0.6 MB | Pre-rendered salamander |
| Light map | 900x562 | ~2.0 MB | Dappled sunlight overlay |
| Vignette | 900x562 | ~2.0 MB | Radial gradient |
| **Total** | | **~8.0 MB** | |

This is at the upper end of the budget. Two optimizations:
1. The vignette canvas can be reduced to quarter resolution (450x281, ~0.5MB) and scaled up when blitting -- radial gradients look fine at lower resolution
2. The light map can also be quarter resolution (~0.5MB) since it's a soft overlay

With these: **~5.0 MB total**, comfortable for any device.

**Maximum concurrent canvases:** 5 (matching the table above). Never exceed this -- create approach/examination canvases on demand, dispose when returning to transect.

### 5.3 Particle Limits

| View | Max particles | Rationale |
|------|---------------|-----------|
| Transect | 30 | Full-area coverage, small particles |
| Approach | 15 | Smaller visible area, larger apparent size |
| Examination | 5 | Minimal -- focus on animal |

### 5.4 Noise Generation Budget

- Transect-view soil noise (900x562 at scale 0.05): ~506k samples, ~25ms
- Approach-view soil noise (600x600 at scale 0.1): ~360k samples, ~18ms
- If either exceeds 16ms, amortize across frames:
  - Generate 128 rows per frame
  - At 900px width, that's ~115k samples/frame, ~6ms
  - 562 rows / 128 = 5 frames to complete (~83ms wall time, invisible to user)

### 5.5 Animation Frame Discipline

- All zoom transitions use `requestAnimationFrame` with timestamp-based interpolation
- Never use `setTimeout` or `setInterval` for visual animations
- Never apply CSS transforms to the canvas element (causes subpixel blurring)
- The existing `Simulation._loop()` pattern is correct -- `BatesianMimicrySim` overrides it to be render-only, which is fine since this sim is event-driven

---

## 6. File Change Plan

### New Files

**`ViewManager.js`** -- manages the three views, transitions, zoom state
- Exports: `ViewManager` class
- Responsibilities:
  - Maintains current view (`transect` | `approach` | `examination`)
  - Stores transform state: `{ scale, tx, ty }`
  - Runs transition animations with easing
  - Provides `applyTransform(ctx)` and `resetTransform(ctx)` for the render loop
  - Manages approach-view and examination-view offscreen canvases (create on demand, dispose on return)
  - Translates screen-space click coordinates back to world-space for hit testing during zoomed views
- Depends on: nothing (standalone utility)
- Used by: `BatesianMimicrySim.js`

**`TextureGenerator.js`** -- procedural noise and texture rendering
- Exports: `ValueNoise2D` class, `TextureGenerator` object with methods
- Methods:
  - `generateSoilTexture(canvas, width, height, season)` -- noise-based soil with color variation
  - `generateLeafLitter(ctx, width, height, season, density)` -- scattered leaf ellipses
  - `generateMossPatch(ctx, x, y, radius)` -- irregular moss blob with internal texture
  - `generateLightMap(canvas, width, height, weather)` -- dappled sunlight overlay
  - `generateVignette(canvas, width, height, intensity)` -- radial edge darkening
- Used by: `ForestEnvironment.js`, `ViewManager.js` (for approach-detail textures)

**`ParticleSystem.js`** -- ambient particle effects
- Exports: `ParticleSystem` class
- Methods:
  - `constructor(config)` -- config specifies particle type mix, max counts
  - `setViewLevel(level)` -- adjusts counts and behavior for current zoom
  - `update()` -- advance all particles one frame
  - `render(ctx)` -- draw all particles
  - `setWeather(weather)` -- enable/disable rain, adjust mist density
- Used by: `BatesianMimicrySim.js` (called from render loop)

**`SoundManager.js`** -- Web Audio API wrapper
- Exports: `SoundManager` class
- Methods:
  - `init()` -- create AudioContext (call on first user gesture)
  - `load(name, url)` -- fetch and decode an audio file
  - `play(name, options)` -- play a sound (options: volume, loop)
  - `stopAmbient()` -- stop the looping ambient track
  - `setVolume(v)` -- set master volume (0-1)
  - `mute()` / `unmute()` / `toggleMute()`
- Used by: `BatesianMimicrySim.js`

### Modified Files

**`ForestEnvironment.js`** -- render at multiple detail levels
- Add `renderApproachDetail(ctx, centerX, centerY, scale)` method that generates and draws high-detail ground texture for the approach view area
- Modify `_prerenderBackground()` to use `TextureGenerator` for noise-based soil and improved leaf litter
- Add foreground debris overlay rendering (leaves/twigs on top of objects)
- Add `getLightMap()` accessor for the atmospheric overlay

**`CoverObject.js`** -- render at multiple zoom levels
- Add `renderApproach(ctx, scale)` method with additional detail strokes for bark grain, rock mottling, lichen spots
- Replace hard rectangle shadows with soft elliptical radial gradient shadows
- Add ambient occlusion darkening at the base of objects (subtle contact shadow)

**`Salamander.js`** -- larger, more detailed examination-view rendering
- Add `renderExamination(ctx, x, y)` method that draws at ~400px body length with maximum detail
- The existing `renderLarge()` can be refactored to call the same `drawSalamanderBody()` at a larger scale
- Add decorative details visible only at examination zoom: moisture sheen on skin, subtle shadow underneath the body, tiny eye highlight (white specular dot)

**`BatesianMimicrySim.js`** -- integrate ViewManager and handle view transitions
- Import and instantiate `ViewManager`, `ParticleSystem`, `SoundManager`
- Modify `_handleCanvasClick()` to route differently based on current view:
  - Transect view: clicking an object starts the zoom transition to approach
  - Approach view: clicking the focused object flips it
  - Examination view: no canvas clicks (interaction is in the HTML panel)
- Modify `render()` to apply/reset the view transform around all drawing calls
- Add `_transitionTo(view, targetObj)` method that orchestrates zoom + sound + particle adjustments
- Modify the sub-state flow:
  - `surveying` (transect) -> click object -> `approaching` (zoom animation) -> `surveying-approach` (approach view, waiting for flip click) -> click flip -> `flipping` -> `identifying` (examination view + panel) -> `recording` -> `returning` (zoom back) -> `surveying`
- Sound triggers: play approach sound on zoom start, flip sound on cover object interaction, reveal sound after flip, panel sound on ID challenge show

**`IdentificationChallenge.js`** -- convert from modal to side panel
- Remove the backdrop element and all backdrop-related styles
- Remove the internal canvas and `idc-canvas-wrap`
- Change the modal to a right-anchored panel (`position: absolute; right: -380px`)
- Add slide animation via CSS transition on `right` property
- Adjust `show()` to not render the salamander internally (it's on the main canvas)
- Adjust `hide()` to trigger the slide-out animation, then clean up after transition ends
- Remove the `idc-backdrop` and `idc-modal` CSS; replace with `idc-panel` styles
- Keep all option building, feature display, submit handling, and keyboard shortcut logic -- those are solid and don't need changes

---

## 7. Implementation Order

Phase 1 (foundation):
1. `TextureGenerator.js` -- noise function and texture methods
2. `ViewManager.js` -- view state and transform management
3. Integrate `ViewManager` into `BatesianMimicrySim.render()`
4. Verify transect view renders identically through the new transform pipeline

Phase 2 (zoom transitions):
5. Implement transect -> approach transition in `ViewManager`
6. Add approach-view ground detail generation in `ForestEnvironment`
7. Add approach-view detail rendering in `CoverObject`
8. Wire up the click-to-approach flow in `BatesianMimicrySim`

Phase 3 (examination view):
9. Implement approach -> examination transition
10. Add examination-view rendering in `Salamander`
11. Convert `IdentificationChallenge` from modal to side panel
12. Wire up the flip -> examine -> identify -> record flow

Phase 4 (atmosphere):
13. `ParticleSystem.js` -- falling leaves, dust motes
14. Light map and vignette overlays
15. `SoundManager.js` -- ambient loop and interaction sounds
16. Audio asset creation/acquisition

Phase 5 (polish):
17. Field notebook visual overhaul
18. Foreground debris overlay
19. Weather-dependent rendering adjustments (overcast tint, rain particles)
20. Performance profiling and optimization pass
