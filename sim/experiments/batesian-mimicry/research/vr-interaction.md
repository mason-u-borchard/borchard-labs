# VR and Desktop Interaction Design -- Batesian Mimicry Field Survey

**Date:** 2026-04-04
**Author:** Mason Borchard
**Status:** Research / Pre-implementation
**Stack:** Three.js + WebXR, targeting Quest 3 (VR) and desktop (WASD + mouse)

---

## Overview

The simulation moves from a 2D Canvas bird's-eye view to a first-person 3D forest rendered with Three.js. Students walk a transect, flip cover objects, discover salamanders, and record data -- the same core loop described in DESIGN.md, but experienced from ground level. The critical constraint: VR and desktop must share identical simulation logic and produce identical scientific data. The interaction layer is a skin, not a fork. One `InputManager` class abstracts the two modes so everything downstream -- encounter rolls, identification challenges, notebook entries -- runs the same code regardless of whether the student is holding a Quest 3 controller or clicking a mouse.

This document covers the full interaction flow for both modes, the abstraction layer that unifies them, VR comfort standards, world-space UI architecture, accessibility, and controller mapping.

---

## 1. VR Interaction Flow (Quest 3)

Nine steps from spawn to replacing the cover object. Each step maps to a sub-state in the simulation's internal state machine (`surveying`, `identifying`, `recording`, etc. from DESIGN.md Section 7).

### Step 1: Spawn

The student materializes standing on a forest trail at the start of the transect. Eye height is set from the WebXR reference space -- no artificial height correction needed because Quest 3's Guardian system handles room-scale calibration. The scene fades in over 1.5s from black (a comfort fade, not a loading screen). The first thing visible is the forest canopy overhead and leaf litter at their feet. A world-space welcome panel floats at chest height, 1.2m away, showing survey parameters (site, weather, date) and a "Begin Survey" button they select with the right trigger ray.

Audio fades in with the visual: layered forest ambience (wind through canopy, distant bird calls, creek if Stream Corridor site). This establishes presence before any interaction demand.

### Step 2: Navigate (Teleport)

Movement is teleport-only -- no smooth locomotion (see Section 4 for comfort rationale). The student aims the left controller's trigger at the ground. A parabolic arc traces from the controller to the landing point, rendered as a dashed line with a disc indicator at the target. Valid landing zones are constrained to the transect area plus a 2m buffer. If the arc lands outside the boundary, the disc turns red and the teleport won't fire. On trigger release, the view fades to black over 100ms, the camera repositions, and fades back over 150ms. Total blackout is ~250ms -- short enough to feel instant, long enough to prevent disorientation.

Cover objects are visible from a distance as rocks, logs, bark pieces, and boards scattered across the forest floor. Objects the student hasn't checked yet have a subtle particle shimmer (tiny floating motes, like dust catching light) visible from ~3m. Already-checked objects have no shimmer and appear slightly darker. This replaces the 2D version's checkbox overlay with a diegetic cue that doesn't break immersion.

Snap-turn on the left thumbstick (see Section 7 for mapping) rotates the view in 30-degree increments.

### Step 3: Approach (Rim Light Highlight)

When the student gets within 1.5m of an unchecked cover object, a rim light activates on the object's mesh. This is a shader effect -- a thin bright edge glow (warm amber, matching dappled sunlight) that pulses subtly at 0.5Hz. The rim light is the VR equivalent of the 2D hover highlight. It says "this is interactive" without text or icons.

Implementation: each cover object mesh has a custom `ShaderMaterial` with a rim light term calculated from `dot(viewDir, normal)`. The rim intensity uniform is driven by proximity -- 0 beyond 1.5m, ramping to full at 0.8m. The pulse is a sine wave on the intensity.

A spatial audio cue -- a soft leaf crunch -- plays when the rim light first activates, reinforcing that the student has "arrived" at an object worth investigating.

### Step 4: Flip (Grip + Lift)

The student reaches toward the highlighted cover object and squeezes the grip button on either controller. The controller must be within 0.4m of the object's collision volume (a generous hitbox, slightly larger than the visual mesh, to account for imprecise VR hand tracking). On grip press, the controller vibrates briefly (5ms, low intensity) to confirm contact.

While holding grip, the student lifts their hand upward. The cover object's mesh follows a constrained animation: it tilts up and to the left (for rocks) or rolls to the side (for logs), pivoting around its bottom edge. The animation is physics-informed but not physics-simulated -- it follows a predefined keyframe curve that maps the controller's vertical displacement (0 to 0.3m) to the object's rotation (0 to 90 degrees). This avoids the jank of actual rigid body physics while still feeling responsive to the student's hand motion.

The lift doesn't need to track perfectly. If the student yanks their hand up fast, the object follows the same curve at 1.5x speed. If they lift slowly, it matches. The mapping is displacement-driven, not velocity-driven -- wherever their hand is vertically, the object is at the corresponding rotation angle.

Once the object reaches ~70 degrees of rotation (hand raised ~0.2m), it auto-completes the remaining 20 degrees with a settle animation (ease-out, 200ms) and snaps into the "flipped" position. The student can release grip at any point after the auto-complete threshold. If they release before 70 degrees, the object settles back to its original position (a "changed my mind" interaction).

### Step 5: Discover

The EventEngine determines what's underneath, identical to the 2D flow (DESIGN.md Section 2). The ground patch under the object is now visible -- a detail mesh showing exposed soil, moisture sheen, and small invertebrate models (isopods, beetle, ant trail) for visual richness.

- **Nothing/invertebrates (55--60%):** A small text label fades in above the soil patch ("Empty -- leaf litter and invertebrates") for 2s, then fades out. The object is marked checked. The shimmer particles disappear.
- **Salamander (35--40%):** The animal model appears on the exposed soil. It doesn't pop in -- it fades from 0 to full opacity over 300ms, simulating the moment your eyes adjust and you notice the animal sitting there. A discovery audio sting plays (a soft chime, not a fanfare -- this is science, not a loot drop).
- **Snake (~0.5%):** The snake model appears with a quick rustle sound. A safety panel appears at chest height: "Caution -- copperhead. Replace cover carefully, note location, continue." The student selects "Understood" to proceed.

### Step 6: Examine (Pick Up, Rotate in Hand)

When a salamander is discovered, the student reaches toward it and presses grip. The animal model lifts from the soil and attaches to the controller's position, offset slightly forward and rotated so it sits "in the palm" of the virtual hand. The student can now rotate their wrist to examine the animal from different angles -- dorsal view, ventral view, lateral profile. The animal model is rendered at roughly life-size (3--8cm SVL depending on species), which in VR is genuinely small. This is intentional. Real salamanders are small. The student needs to bring their hand close to their face to see diagnostic features, just like in the field.

The salamander model shows all diagnostically relevant features at this scale: skin texture (bump-mapped -- rough/granular for efts, smooth for plethodontids), costal groove geometry, spot patterns, eye color, tail cross-section shape. These are the same features listed in DESIGN.md Section 3.3 but rendered as 3D geometry and material properties rather than 2D drawing strokes.

The animal exhibits idle animation while held: slow breathing (ribcage expansion cycle at 0.3Hz), occasional limb adjustment, and species-appropriate behavior. Efts are calm and still (toxic, no need to flee). Red salamanders freeze in a defensive coil. Duskies squirm and try to wriggle free (subtle oscillation on the model).

### Step 7: Identify (World-Space Panel, Controller Ray)

While the student holds the animal in one hand, the identification panel appears as a world-space UI element (see Section 5 for implementation). The panel spawns 0.8m in front of the student at chest height, angled 15 degrees toward them for comfortable reading. It contains:

- **Feature checklist** at the top: skin texture, costal grooves, tail shape, body proportions, eye color, spot pattern, size. Each feature has a checkbox the student can check with the right trigger ray as they observe it on the animal in their other hand. Checking is optional but tracked for assessment data.
- **Species options**: contextual radio buttons (red/orange animal shows Red Eft, Red Salamander, Spring Salamander, Other; dark animal shows the plethodontid set). Each option is a row the student can select with the right trigger ray.
- **Submit button**: highlighted once a species is selected.

The right controller emits a visible ray (thin white line, ~3m length) that intersects with the panel's collision plane. A small dot cursor appears on the panel where the ray hits. Trigger pull on the right controller activates the element under the cursor.

The panel text is rendered at 0.05m cap height minimum at 1m distance (see Section 4 for text size rationale). At the actual panel distance of 0.8m, this means ~0.04m cap height minimum, which translates to roughly 24pt equivalent in screen terms. Comfortable to read.

Feedback after submission follows the same immediate/deferred logic from DESIGN.md. In immediate mode, the panel updates with a green/red border and a feature explanation. In deferred mode, the panel simply says "Response recorded" and closes.

### Step 8: Record (Virtual Clipboard)

After identification, the student places the animal back on the ground (see Step 9 for the animation) and the field notebook appears as a world-space clipboard. This clipboard is a flat panel angled like a physical clipboard held at waist height -- about 0.5m in front of the student, tilted 45 degrees from vertical.

The clipboard shows the same entry form from DESIGN.md Section 4.3. Auto-populated fields (entry number, time, cover object number, species) are already filled. The student uses the right trigger ray to interact with input fields. Numeric inputs (SVL, mass) use a world-space number pad that appears beside the clipboard when a numeric field is selected. The number pad has large touch targets (0.04m minimum per digit button).

Sex, age class, and substrate moisture are dropdown selectors -- in VR these render as vertically stacked radio-style buttons, not traditional dropdown menus. Dropdown menus are miserable in VR. Flat lists are better.

A "Save Entry" button at the bottom commits the record. The clipboard fades out over 300ms.

For V1, measurements auto-populate from the animal's generated traits (same as the 2D version). The student sees the values and can adjust them, but in practice they'll usually accept the defaults. This reduces the amount of VR text input, which is slow and frustrating.

### Step 9: Replace (Animate Back)

After saving the entry, the cover object plays an auto-animated return sequence: it rotates back from the flipped position to its original orientation over 600ms (ease-in-out). A soft thud sound plays on contact. The soil patch fades back to the standard ground texture. The object is now visually marked as checked -- no shimmer, slightly darker material.

The student is back in the `surveying` sub-state and can teleport to the next object.

---

## 2. Desktop Interaction Flow (WASD + Mouse)

Nine steps, parallel to VR, producing identical data. The desktop experience is a standard first-person browser game. No VR headset. No controllers. Just keyboard and mouse.

### Step 1: Spawn (First-Person Camera)

The scene renders to a standard `<canvas>` element via Three.js's WebGLRenderer. The camera is a `PerspectiveCamera` at standing eye height (1.65m). The same fade-in from black, same welcome panel (rendered as an HTML overlay centered on screen), same ambient audio. The student clicks "Begin Survey" with the mouse.

The renderer locks the pointer on click (`canvas.requestPointerLock()`) for mouselook. An on-screen prompt instructs: "Click to look around. WASD to move. ESC to release cursor." Pointer lock is essential -- without it, mouselook fights with the browser's cursor.

### Step 2: Navigate (WASD + Shift Crouch)

Standard first-person movement:
- **W/S**: forward/backward along the camera's facing direction, projected onto the ground plane (no flying)
- **A/D**: strafe left/right
- **Mouse**: mouselook (yaw and pitch). Pitch is clamped to +/- 85 degrees to prevent full vertical flip.
- **Shift (hold)**: crouch. Camera height drops from 1.65m to 0.9m over 200ms (ease-out). Movement speed halves while crouched. This is the desktop equivalent of physically leaning down in VR.

Movement speed is 2.5 m/s walking, 1.25 m/s crouched. No sprint -- the transect isn't large enough to need it, and running through a forest survey would be inappropriate behavior the sim shouldn't model.

Collision with the transect boundary is a soft stop -- the camera decelerates over 0.2m rather than hitting an invisible wall. A subtle visual cue (faint orange border vignette) appears when the student reaches the boundary.

Cover objects show the same unchecked shimmer particles visible in VR, plus an additional desktop-specific cue: when the crosshair passes over an unchecked object within 3m, the object's name appears as small floating text ("Mossy rock", "Oak log section") and the crosshair dot changes from white to amber.

### Step 3: Approach (Crosshair Highlight)

The student walks toward a cover object. When within interaction range (1.5m), the crosshair changes to a hand icon (CSS cursor swap on the canvas). The cover object receives the same rim light highlight as in VR, but since the student can't physically lean in, the highlight is slightly more pronounced (brighter rim, 0.8Hz pulse) to compensate for the reduced spatial awareness of a flat screen.

A tooltip appears below the crosshair: "Click to flip" (or "E to flip" as an alternative keybind). Either mouse click or E key initiates the flip.

### Step 4: Flip (Click, Camera Animates to Crouch)

On click (or E press), the student doesn't manually lift the object. Instead, the camera auto-animates: it moves forward to 0.8m from the object, drops to crouch height (0.9m), and tilts downward 30 degrees to look at the ground beneath the object. This transition takes 600ms with ease-in-out easing. Simultaneously, the cover object plays its flip animation (same keyframe curve as VR, but driven by time rather than hand position).

During the camera animation, input is temporarily locked -- WASD and mouse do nothing for 600ms. This prevents the student from walking away mid-flip, which would break the spatial logic. Input unlocks after the camera settles and the flip animation completes.

The auto-crouch is the key design decision for desktop. In VR the student physically bends down. On desktop, the sim does it for them. Without this auto-animation, the student would be standing at full height staring at the ground from 1.5m away -- the animal would be tiny and the examination angle would be wrong. The auto-crouch replicates the physical action that VR handles naturally.

### Step 5: Discover

Identical to VR Step 5 in logic. Visual presentation differs slightly: the discovery text for empty objects appears as HTML overlay text centered on screen rather than floating in world space. The salamander fade-in and audio sting are the same.

### Step 6: Examine (Orbit-Drag Camera)

When a salamander is discovered, the camera locks onto the animal's position. WASD movement is disabled. The mouse now controls an orbit camera centered on the salamander:

- **Left-click drag**: orbit around the animal (azimuth and elevation)
- **Scroll wheel**: zoom in/out (clamped between 0.15m and 0.5m from the animal)
- **Right-click drag**: pan the focus point slightly (small range, +/- 0.1m)

The orbit camera uses `THREE.OrbitControls` or a lightweight custom equivalent (OrbitControls pulls in a fair amount of code; a minimal orbit implementation is ~80 lines). The animal is centered and fills roughly 40% of the screen at default zoom.

The salamander model shows the same diagnostic features as in VR. Since the student is viewing on a flat screen, they rely on orbiting to see different angles rather than physically rotating their wrist. The orbit controls should be smooth and responsive -- any input latency here makes the examination feel sluggish, and the student is trying to see fine details like costal grooves and eye color.

A "Return to standing" button (HTML overlay, top-right corner) lets the student exit orbit mode without identifying, in case they flipped a rock and want to move on (e.g., an empty discovery that somehow entered examine mode due to a bug, or a snake encounter where they need to back away).

### Step 7: Identify (HTML Slide-In Panel)

The identification panel slides in from the right edge of the screen as an HTML `<div>`, 380px wide, with the same content as the VR world-space panel: feature checklist, species options, submit button. The canvas (with the orbit view of the animal still active) occupies the remaining left portion. This matches the approach described in rendering-architecture.md Section 1.3 -- the animal stays visible while the student makes their decision.

Interaction is standard HTML: checkboxes for features, radio buttons for species, a submit button. Mouse click on each element. Keyboard navigation also works -- Tab cycles through options, Space/Enter selects.

The slide-in animation is 250ms, ease-out, from right. The panel has a semi-transparent dark backdrop on its left edge that helps visually separate it from the 3D scene without fully occluding the animal.

### Step 8: Record (HTML Notebook)

After identification, the ID panel slides out and the field notebook slides in from the bottom of the screen. This is the same Rite in the Rain styled notebook from DESIGN.md Section 4.4, rendered as an HTML panel. It covers the bottom 40% of the screen. The 3D scene remains visible above it, though input to the scene is disabled while the notebook is open.

The entry form is standard HTML inputs. Auto-populated fields are pre-filled. The student tabs through the remaining fields (SVL, mass, sex, age class, substrate moisture, notes) and clicks "Save Entry."

The notebook panel slides back down on save (250ms, ease-in).

### Step 9: Return (Camera Stands Up)

The camera reverse-animates from the crouched examination position back to standing height (1.65m) over 500ms. The cover object plays its replacement animation (same as VR Step 9). WASD and mouselook re-enable. The student is back in the `surveying` sub-state.

---

## 3. Unified Input Manager

The `InputManager` class is the abstraction boundary between input hardware and simulation logic. Game logic never checks which mode it's in -- it subscribes to events and calls methods on `InputManager`, and gets back mode-agnostic results.

### 3.1 Class Interface

```js
class InputManager {

    /**
     * @param {THREE.WebGLRenderer} renderer -- needed for WebXR session access
     * @param {THREE.PerspectiveCamera} camera -- updated by input (desktop mouselook, VR head tracking)
     * @param {THREE.Scene} scene -- for raycasting against interactive objects
     */
    constructor(renderer, camera, scene) {
        this._renderer = renderer;
        this._camera = camera;
        this._scene = scene;
        this._raycaster = new THREE.Raycaster();
        this._mode = 'desktop'; // or 'vr', set on XR session start
        this._selectCallbacks = [];
        this._gripCallbacks = [];
        this._interactables = []; // meshes registered as interactive
        this._init();
    }

    /**
     * Returns a ray from the active input device.
     * Desktop: ray from camera center (screen crosshair) into the scene.
     * VR: ray from the right controller's position along its forward axis.
     * @returns {{ origin: THREE.Vector3, direction: THREE.Vector3 }}
     */
    getInteractionRay() { /* ... */ }

    /**
     * Register a callback for "select" actions.
     * Desktop: left mouse click or E key press.
     * VR: right trigger pull.
     * @param {Function} cb -- receives { point, object, inputSource }
     */
    onSelect(cb) { this._selectCallbacks.push(cb); }

    /**
     * Register a callback for "grip" actions.
     * Desktop: mapped to left click (context-dependent -- flip vs examine).
     * VR: grip button squeeze on either controller.
     * @param {Function} cb -- receives { hand, controller, inputSource }
     */
    onGrip(cb) { this._gripCallbacks.push(cb); }

    /**
     * @returns {boolean} true if currently in a WebXR immersive session
     */
    isVR() { return this._mode === 'vr'; }

    /**
     * Register a mesh as interactive (eligible for highlight, raycasting).
     * @param {THREE.Mesh} mesh
     * @param {string} type -- 'cover-object', 'ui-panel', 'animal', etc.
     */
    register(mesh, type) { /* ... */ }

    /**
     * Unregister a mesh (e.g., after it's been checked).
     * @param {THREE.Mesh} mesh
     */
    unregister(mesh) { /* ... */ }

    /**
     * Called every frame from the render loop.
     * Updates raycaster, checks proximity highlights, polls controller state.
     * @param {number} delta -- time since last frame in seconds
     */
    update(delta) { /* ... */ }

    /**
     * Clean up event listeners, XR controller references, pointer lock.
     */
    dispose() { /* ... */ }
}
```

### 3.2 Internal Architecture

The class maintains two internal strategy objects, one for each mode. On construction, it creates the desktop strategy. When a WebXR session starts (detected via `renderer.xr.addEventListener('sessionstart', ...)`), it switches to the VR strategy. On session end, it switches back.

```
InputManager
  +-- DesktopStrategy
  |     Pointer lock, WASD, mouselook, click events
  |     getInteractionRay() -> camera center ray
  |     Highlight via crosshair (CSS cursor changes)
  +-- VRStrategy
        XRInputSource tracking, controller models
        getInteractionRay() -> right controller ray
        Highlight via proximity (rim light shader uniform)
```

Both strategies emit the same events through the parent `InputManager`. Downstream code subscribes once and works in both modes:

```js
inputManager.onSelect(function(event) {
    // event.point -- world-space intersection point
    // event.object -- the Three.js mesh that was hit
    // event.inputSource -- 'mouse', 'keyboard', 'xr-right-trigger', etc.
    if (event.object.userData.type === 'cover-object') {
        sim.flipCoverObject(event.object.userData.id);
    }
});
```

### 3.3 Raycasting

Both modes use `THREE.Raycaster` against the registered interactable meshes. Desktop casts from camera center (NDC 0,0). VR casts from the right controller's world-space transform. The raycast runs every frame in `update()` to maintain highlight state, but only fires callbacks on actual input events (click, trigger pull).

For performance, interactables are stored in a flat array. The transect has 20--60 cover objects plus a handful of UI panels -- well under 100 meshes. Raycasting against 100 meshes per frame is negligible. No spatial partitioning needed.

### 3.4 Mode Transition

The student can enter VR mid-session via the WebXR "Enter VR" button (rendered by Three.js's `VRButton` helper). The `InputManager` handles this cleanly:

1. `sessionstart` fires
2. `_mode` switches to `'vr'`
3. Desktop event listeners are paused (not removed -- the student might exit VR)
4. VR controller references are acquired from `renderer.xr.getSession().inputSources`
5. Controller models (Quest 3 controller meshes) are added to the scene
6. The camera is now driven by the XR reference space, not by mouselook

On `sessionend`, the reverse. The camera snaps back to the position it was at when VR started. Desktop listeners resume.

This means a student could start on desktop, click "Enter VR" to put on the headset, do a few cover objects in VR, exit back to desktop, and continue. The simulation state is unaffected -- only the input method changes.

---

## 4. VR Comfort

Every design decision in the VR mode is filtered through a comfort-first policy. Simulator sickness is not an acceptable tradeoff for immersion. If a student gets nauseous, they stop using the sim entirely. These aren't guidelines -- they're hard constraints.

### 4.1 Locomotion: Teleport Only

No smooth locomotion. No joystick walking. No acceleration. Teleportation with a blink-fade (100ms black, reposition, 150ms fade-in) is the only movement method. This eliminates vection -- the visual-vestibular conflict that causes motion sickness in ~40% of VR users during smooth locomotion.

The teleport arc uses a parabolic trajectory (gravity = 9.8 m/s^2 simulated, initial velocity = 6 m/s along the controller's forward vector). This gives a natural-feeling arc with a maximum range of ~4m, which is more than enough for the transect. The arc is rendered as a series of small spheres (12--16 along the curve) rather than a continuous line, reducing visual noise.

The landing disc is a flat circle (0.3m radius) with a directional arrow showing which way the student will face after teleporting. By default, facing direction is preserved (the student faces the same compass direction before and after teleport). An optional setting lets the student set facing direction by rotating the thumbstick during the arc, but this is off by default because it adds cognitive load.

### 4.2 Rotation: Snap Turn

Smooth rotation causes vection just like smooth locomotion. The left thumbstick rotates the view in 30-degree increments with no interpolation -- the view jumps instantly to the new angle. A brief (50ms) screen-edge darkening on the snap provides a subtle visual anchor that reduces the jarring quality of the jump without introducing motion.

30 degrees is the standard increment. Some users prefer 45 degrees (fewer snaps to turn around) or 15 degrees (finer control). This should be configurable in a comfort settings menu, but 30 is the default because it balances precision with efficiency.

### 4.3 Seated Mode

The sim is designed for seated play. The XR reference space is `local` (seated/standing, origin at head level) rather than `bounded-floor` (room-scale with guardian boundary). The student doesn't need to physically walk around their room. All movement is via teleport.

If a student is standing, everything still works -- the teleport and snap turn are reference-space-agnostic. But the UI panel placement (clipboard at 0.5m in front, ID panel at 0.8m in front) is calibrated for a seated eye height of ~1.2m. If standing (eye height ~1.6m), the panels might feel low. A height calibration step at session start ("look straight ahead and press trigger") adjusts the reference frame.

### 4.4 No World Movement

Nothing in the scene moves relative to the student unless the student initiates it. The forest is static. Trees don't sway toward the camera. The ground doesn't scroll. Particle effects (dust motes, falling leaves) are subtle and non-directional. The only thing that moves is cover objects being flipped (initiated by the student's grip) and animals exhibiting small idle animations.

Weather effects (rain) are the one exception. Rain particles fall vertically and are small enough (~2px) that they don't induce vection. If a student reports discomfort, rain density can be reduced to zero in comfort settings without affecting the simulation logic (weather still applies its encounter modifier; the student just doesn't see rain visually).

### 4.5 Text Legibility

Minimum text size: 0.05m cap height at 1m viewing distance. This corresponds to ~2.86 degrees of visual arc, which is well above the Quest 3's angular resolution limit (~0.6 arcminutes per pixel at the center of the lens, so 0.05m at 1m resolves to roughly 170 pixels -- plenty).

In practice, most text is closer than 1m. The ID panel at 0.8m and the clipboard at 0.5m both allow smaller world-space text dimensions while maintaining the same angular size. But we floor at 0.05m regardless of distance as a hard minimum, because off-axis viewing (text near the edge of the panel) degrades clarity due to lens distortion and reduced PPD at the periphery.

Font choice matters. Sans-serif, medium weight, high x-height. No thin strokes. No italics for body text. Bold for headers only. White or light text on dark semi-transparent backgrounds (not the reverse -- light backgrounds in VR are a flashlight in your face).

### 4.6 Framerate Floor

The simulation must maintain 72 fps minimum on Quest 3 (the hardware's native refresh rate). Dropped frames cause judder, which causes nausea. The Three.js scene budget:

- Draw calls: target < 100 per frame
- Triangle count: target < 200k for the visible transect area
- Texture memory: target < 256MB total (Quest 3 has 12GB system RAM but shared with OS)
- Shader complexity: keep fragment shaders simple. The rim light highlight is the most complex per-object shader; everything else is standard PBR or unlit.

If framerate drops below 72, the first thing to cut is particle effects. Second is shadow map resolution. Third is vegetation density (reduce ground cover mesh instances). These are LOD decisions made at init based on a quick GPU capability probe, not runtime adaptive -- runtime LOD changes cause visible pops that are distracting in VR.

---

## 5. World-Space UI in VR

HTML overlays don't work in VR. The WebXR compositor takes over rendering; the browser's DOM layer is invisible inside the headset. All UI that appears during VR gameplay must be rendered as 3D geometry in the Three.js scene -- world-space UI.

### 5.1 Options Evaluated

**Option A: HTML-to-Canvas-to-Texture**

Render HTML to a hidden DOM element, capture it to a `<canvas>` via `html2canvas` or a similar library, then apply that canvas as a `THREE.CanvasTexture` on a `PlaneGeometry` in the scene.

Pros:
- Full CSS styling -- the UI looks identical to the desktop HTML panels
- Easy to maintain: change the CSS, the texture updates
- Text rendering is high quality (browser's native text rasterizer)

Cons:
- `html2canvas` is heavy (~40KB minified) and slow (100--300ms per capture for a complex panel). Updating the texture on every interaction (checkbox click, radio select) means re-capturing the entire HTML tree each time. At 72 fps, a 200ms capture is a 14-frame hitch.
- Interactive elements don't exist in 3D space. The rendered texture is a flat image. You need a separate hit-testing layer that maps controller ray intersections on the plane back to HTML element coordinates, then simulates click events on the hidden DOM. This is brittle.
- Canvas resolution must be high (at least 1024x1024 for readable text on a 0.6m-wide panel), which means the texture upload is expensive.
- Doesn't work offline or in WebXR-only runtimes that lack a full DOM (not a current concern for Quest 3's browser, but a fragility).

**Option B: ThreeMeshUI**

A dedicated Three.js library for building UI panels directly in 3D. Provides block layout, text rendering (via MSDF fonts), buttons, and input elements as Three.js objects.

Pros:
- Purpose-built for VR. Handles text layout, font rendering, and interaction natively in Three.js.
- No DOM dependency -- pure 3D. Works in any WebXR runtime.
- MSDF (multi-channel signed distance field) text rendering is resolution-independent and sharp at any viewing distance. This is the standard approach for VR text.
- Interactive elements are real 3D objects with their own raycasting targets. No coordinate mapping gymnastics.
- Maintained and reasonably well-documented. Used in production VR web apps.

Cons:
- Learning curve. The API is its own layout system (block, inline-block, content-direction, justify-content). It's CSS-like but not CSS.
- Font preparation: requires generating MSDF font atlases from TTF files using `msdf-bmfont-xml` or similar. One-time setup per font.
- No native form elements (text input, dropdown). Checkboxes and radio buttons must be built from scratch (toggle-able block elements with visual state).
- Adds a dependency (~30KB).

**Option C: Custom Mesh UI**

Build UI panels from raw Three.js primitives. `PlaneGeometry` for backgrounds, `TextGeometry` or bitmap font rendering for text, custom meshes for buttons and checkboxes.

Pros:
- No dependencies.
- Full control over every pixel.
- Lightweight at runtime if done carefully.

Cons:
- Enormous implementation effort. Text layout alone (word wrap, alignment, line spacing) is weeks of work to get right.
- `TextGeometry` (3D extruded text) is heavy -- each character is dozens of triangles. Not suitable for paragraphs.
- Bitmap font rendering is viable but requires building or adopting a text renderer from scratch, which is what ThreeMeshUI already does.
- Every UI element (checkbox, radio button, slider, scroll view) must be designed, built, and tested from zero.
- Maintainability: whoever comes after has to learn a bespoke UI framework.

### 5.2 Recommendation: ThreeMeshUI

Option B is the right choice. The tradeoffs:

- The dependency is small and focused. It solves a problem (VR text rendering and UI layout) that is genuinely hard to do well from scratch.
- MSDF text is the correct technology for VR readability. Building our own MSDF renderer would be reimplementing what ThreeMeshUI already provides.
- The lack of native form elements is manageable. The ID panel needs checkboxes (6--8), radio buttons (3--5), and a submit button. The notebook needs numeric inputs (3--4), radio-style selectors (3), and a save button. These are finite, small UI surfaces. Building toggle and select primitives on top of ThreeMeshUI's block system is a day of work, not a month.
- HTML-to-Canvas (Option A) is tempting because it reuses the desktop UI, but the interaction mapping problem is a dealbreaker. VR interaction needs to feel native -- ray-based selection with immediate haptic feedback. Simulating DOM events on a hidden HTML tree introduces lag and fragility.

### 5.3 Implementation Plan

**ID Panel (world-space, VR):**
- Root: `ThreeMeshUI.Block`, width 0.5m, height 0.6m, background opacity 0.85, dark gray (`#1a1a1a`)
- Title text: "Species Identification", font size 0.035m, white
- Feature checklist: 6--8 rows, each a `ThreeMeshUI.Block` with a toggle square (0.025m) and label text. Toggle state managed by the sim, visual state (filled/empty square) updated on select.
- Species options: 3--5 rows, same structure but radio-style (only one active at a time). Active option highlighted with a left-edge color bar (amber).
- Submit button: bottom of panel, full width, background color changes on hover (controller ray intersection).

**Notebook Clipboard (world-space, VR):**
- Root: `ThreeMeshUI.Block`, width 0.4m, height 0.5m, slightly angled
- Entry form: labeled rows for each field. Auto-populated fields show values as non-interactive text. Editable numeric fields show a value with +/- buttons on either side (the student taps the buttons with the controller ray to adjust values, avoiding the need for a full keyboard).
- For the Notes field (free text), a simplified word-picker or predefined note options ("damp substrate", "found under log edge", "partial tail") presented as selectable chips. Free text input in VR is not worth the implementation pain for V1.
- Save button at the bottom.

**HUD Elements (world-space, VR):**
- Survey progress: a small panel attached to the left controller (wrist-mounted). Shows "12 / 40 objects checked" and elapsed time. Always visible when the student glances at their left wrist. Implementation: a `ThreeMeshUI.Block` parented to the left controller's `Object3D`, offset 0.05m above and 0.02m forward from the grip point.
- Weather strip: small icon + text panel at the top of the left wrist display. "Overcast, 14C, 87% humidity."
- These wrist-mounted panels are small (0.08m wide) but legible at wrist-to-eye distance (~0.4m). Text size 0.012m, which at 0.4m is 0.03m equivalent at 1m -- above the floor.

---

## 6. Accessibility

### 6.1 Desktop as Full-Access Fallback

The desktop mode is not a degraded experience. It's a complete, first-class version of the simulation that produces identical scientific data. A student who cannot use VR (motion sensitivity, disability, no headset access, institutional IT restrictions) loses nothing pedagogically by using desktop mode. The encounter probabilities, species distributions, ID challenge, notebook, and analysis phase are all identical.

This is not a concession -- it's the design intent. The VR mode adds spatial immersion but does not add scientific content. Every piece of data the student collects and every analysis they perform is mode-independent.

### 6.2 ARIA Labels

All HTML UI elements in desktop mode carry ARIA attributes:

- The ID panel's species radio buttons: `role="radiogroup"`, each option has `role="radio"`, `aria-checked`, and `aria-label` with the full species name (not the abbreviation)
- The feature checklist: `role="group"`, each checkbox has `role="checkbox"` and `aria-checked`
- The notebook entry form: standard `<label>` elements associated with `<input>` fields via `for`/`id`
- The 3D canvas: `role="application"`, `aria-label="Field survey simulation. Use WASD to move, mouse to look around, click to interact with objects."`
- Status updates (discovery text, feedback): injected into an `aria-live="polite"` region so screen readers announce them without interrupting

VR mode has limited screen reader support by nature (headset displays don't run screen readers). The accessibility strategy for VR-dependent students is to use desktop mode, which is why desktop must be fully functional and fully accessible.

### 6.3 Colorblind Safety

The simulation uses color as a carrier of information in two places:

1. **Rim light highlight** on interactive objects: amber glow. Amber is safe for protanopia, deuteranopia, and tritanopia.
2. **ID feedback**: correct/incorrect indication. The 2D version uses green/red. In the 3D version, this is replaced with green/orange plus an icon (checkmark / X mark) and text ("Correct" / "Incorrect"). The icon and text carry the information; color reinforces but doesn't replace.

Salamander coloration is a diagnostic feature (red efts vs. red salamanders vs. dark plethodontids). The simulation doesn't alter the animals' colors for colorblind users -- that would compromise the scientific content. Instead, other diagnostic features (skin texture, costal grooves, body shape, behavior) are always available and sufficient for identification. The feature checklist guides students through non-color features explicitly.

A colorblind mode in the settings menu adjusts UI elements only:
- Checked/unchecked objects: adds a small icon (checkmark badge) rather than relying solely on brightness difference
- Chart colors in the analysis phase: uses a colorblind-safe palette (blue/orange/purple rather than red/green)

### 6.4 Keyboard Navigation (Desktop)

All interactions have keyboard equivalents:

| Action | Mouse | Keyboard |
|--------|-------|----------|
| Move | -- | WASD |
| Look | Mouse move | Arrow keys (slower, for users who can't use a mouse) |
| Crouch | -- | Shift (hold) |
| Interact / flip | Left click | E |
| Orbit (examine) | Left drag | Arrow keys (orbit) + Q/Z (zoom in/out) |
| UI navigation | Click | Tab / Shift-Tab |
| UI select | Click | Space / Enter |
| Close panel | Click X | Escape |
| Pause | -- | P |

Arrow-key look is a fallback for students who can't use mouselook (motor impairments, trackpad-only laptops). It's slower and less fluid than mouselook, but functional. Arrow-key sensitivity is configurable.

### 6.5 Motion Sensitivity Settings

Available in both VR and desktop:

| Setting | Options | Default | Effect |
|---------|---------|---------|--------|
| Camera transition speed | Slow / Normal / Instant | Normal | Affects auto-crouch, zoom transitions. "Instant" cuts directly to the target position with no animation. |
| Teleport fade duration | 100ms / 250ms / 500ms | 250ms | Longer fade = more comfortable, slower flow |
| Snap turn angle | 15 / 30 / 45 degrees | 30 | Personal preference |
| Particle effects | Full / Reduced / Off | Full | Reduces or eliminates dust motes, falling leaves, rain |
| Vignette on movement | On / Off | On (VR) / Off (Desktop) | Darkens peripheral vision during teleport. Reduces vection. |
| Screen shake | On / Off | Off | No screen shake by default. The copperhead encounter could justify a startle shake, but it's off by default and should probably stay off. |

These settings persist in `localStorage` and apply across sessions.

---

## 7. Quest 3 Controller Mapping

```
LEFT CONTROLLER                          RIGHT CONTROLLER
+------------------+                     +------------------+
|                  |                     |                  |
|   [Thumbstick]   |                     |   [Thumbstick]   |
|   Snap-turn      |                     |   (reserved)     |
|   L/R = rotate   |                     |                  |
|                  |                     |                  |
|   [Trigger]      |                     |   [Trigger]      |
|   Teleport       |                     |   Select / Click |
|   (aim arc,      |                     |   (ray interaction|
|    release to    |                     |    with UI and   |
|    execute)      |                     |    world objects)|
|                  |                     |                  |
|   [Grip]         |                     |   [Grip]         |
|   Grab / Lift    |                     |   Grab / Lift    |
|   (cover objects,|                     |   (cover objects, |
|    pick up       |                     |    pick up       |
|    animals)      |                     |    animals)      |
|                  |                     |                  |
|   [Menu Button]  |                     |                  |
|   Pause / Resume |                     |                  |
+------------------+                     +------------------+
```

### Detailed Mapping

**Left Thumbstick:**
- Left/Right: snap-turn (30-degree increments, fires on thumbstick deflection past 0.6 threshold, with a 300ms cooldown to prevent rapid multi-snap)
- Up/Down: unused in V1. Could map to height adjustment for accessibility (simulated crouch/stand) in a future version.
- Click (press down): unused

**Left Trigger:**
- Press and hold: show teleport arc from left controller
- Release: execute teleport if arc lands on valid ground
- The arc is always available regardless of sim sub-state. Even during examination or recording, the student can teleport (though doing so interrupts the current interaction and returns them to surveying -- with a confirmation prompt: "Abandon current observation?")

**Left Grip:**
- Press near a cover object (< 0.4m): grab the object, begin flip interaction
- Press near a discovered salamander (< 0.3m): pick up the animal for examination
- The grip is symmetric -- either hand can grab. This accommodates left-handed users. The grip hand determines which side the animal attaches to.

**Right Trigger:**
- Pull while pointing at a UI element: select / activate (equivalent to mouse click)
- Pull while pointing at a cover object: alternative to grip for flipping (single-action flip, no manual lift -- the object auto-animates). This provides a less physical but faster interaction path.
- The right trigger is the primary "click" input for all world-space UI: checkboxes, radio buttons, submit buttons, number pad digits.

**Right Grip:**
- Same as left grip: grab cover objects, pick up animals.
- When holding an animal in the right hand, the UI panel appears to the left. When holding in the left hand, the panel appears to the right. The panel always spawns on the opposite side of the held animal.

**Menu Button (left controller, Meta/Oculus button on Quest 3):**
- Single press: toggle pause menu
- Pause menu is a world-space panel (ThreeMeshUI) at 1m distance, center of view. Options: Resume, Comfort Settings, Return to Desktop, End Survey.
- The simulation clock pauses. The student can take a break, adjust settings, or exit.

### Haptic Feedback

Controller vibration is used sparingly and at low intensity. Heavy rumble is disorienting and annoying in extended sessions.

| Event | Hand | Duration | Intensity | Pattern |
|-------|------|----------|-----------|---------|
| Grab contact (touch an object) | Grabbing hand | 5ms | 0.15 | Single pulse |
| Object flip complete (settles) | Grabbing hand | 10ms | 0.10 | Single pulse |
| Salamander discovered | Both | 15ms | 0.08 | Double pulse (5ms on, 5ms off, 5ms on) |
| UI button hover | Right | 3ms | 0.05 | Single pulse |
| UI button press | Right | 8ms | 0.12 | Single pulse |
| Copperhead encounter | Both | 30ms | 0.25 | Triple pulse |
| Save entry confirmed | Right | 10ms | 0.10 | Single pulse |

Haptic feedback can be disabled entirely in comfort settings for students who find it distracting.

---

## 8. Implementation Priority

The system should be built in this order, each step producing a testable artifact:

1. **InputManager shell** -- constructor, `isVR()`, `getInteractionRay()` for desktop only. Enough to cast rays at the scene and detect what the crosshair is pointing at.

2. **Desktop navigation** -- WASD movement, mouselook, pointer lock. Walk around the forest. No interaction yet.

3. **Desktop cover object interaction** -- crosshair highlight, click-to-flip, auto-crouch camera animation. Flip objects and see what's underneath (hardcoded encounters for testing).

4. **Desktop ID + notebook panels** -- HTML slide-in panels. Wire to the encounter system and notebook data structure.

5. **VR session entry** -- WebXR session start, controller models in scene, teleport locomotion, snap turn. Walk around the same forest in VR.

6. **VR cover object interaction** -- grip-to-flip with hand-tracked animation. Rim light highlight. Discovery flow.

7. **World-space UI (ThreeMeshUI)** -- ID panel and notebook clipboard in VR. Wire to the same data structures as desktop.

8. **Polish** -- haptic feedback, comfort settings menu, accessibility audit, performance profiling on Quest 3 hardware.

Steps 1--4 produce a fully functional desktop simulation. Steps 5--8 add VR on top. At no point does VR development block desktop functionality. A student can complete the entire lab in desktop mode after step 4.

---

## 9. Open Questions

- **Audio spatialization**: Three.js's `PositionalAudio` handles 3D audio well on desktop. WebXR audio spatialization on Quest 3's built-in speakers is less tested. Need to verify that spatial audio cues (leaf crunch on approach, discovery chime) localize correctly in the headset.

- **Quest 3 browser performance**: The Quest 3 browser (based on Chromium) handles WebXR and Three.js, but real-world performance with our scene complexity (forest vegetation, ground detail textures, ThreeMeshUI panels) needs profiling on actual hardware. The triangle and draw call budgets in Section 4.6 are estimates -- they need validation.

- **Hand tracking vs controllers**: Quest 3 supports bare-hand tracking (no controllers). This could make the grab-and-examine interaction feel more natural -- reaching out and picking up an animal with your actual hand. But hand tracking has higher latency, lower precision, and inconsistent availability (direct sunlight kills IR tracking). For V1, controllers only. Hand tracking as a V2 exploration.

- **Multi-user / instructor view**: Out of scope for V1, but worth noting: a future version could let an instructor observe multiple students' transects simultaneously on a desktop dashboard while students work in VR. The shared simulation logic and data structures make this feasible -- the instructor view would be a read-only desktop client consuming the same event stream.
