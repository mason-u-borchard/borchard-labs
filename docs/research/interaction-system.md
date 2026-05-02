# Interaction System Research

**Date:** 2026-04-28
**Author:** Phase 0, Agent 3 -- Physics, Character Controller, Interaction

---

## Executive Summary

This document specifies the complete physics, character controller, and input system for the Borchard Labs game engine. The recommended player controller is a kinematic capsule driven by Rapier's built-in character controller, surfaced through `@react-three/rapier`. A unified action map decouples all input sources -- keyboard/mouse, gamepad, touch, and VR controllers -- from gameplay logic, so the same `EventEngine`-driven encounter flow works identically regardless of how the student is interacting. The riskiest single decision in this system is the VR input mode: browser-side WebXR on standalone headsets (Meta Quest 3 browser, Chrome on Android) remains viable in 2026 but carries meaningful constraints around physics hand-tracking latency, grip-release jank, and Safari's continued WebXR gaps. Those risks are documented in detail at the end of this document.

---

## 1. Rapier Integration via @react-three/rapier

### 1.1 Setup

`@react-three/rapier` wraps `@dimforge/rapier3d-compat` (the WASM build that skips native SIMD auto-detection in favor of broad compatibility). The `<Physics>` component must wrap any R3F subtree that uses physics:

```tsx
import { Physics } from '@react-three/rapier'

<Canvas>
  <Physics gravity={[0, -9.81, 0]} timeStep="vary">
    {/* all physics-aware scene content */}
  </Physics>
</Canvas>
```

`timeStep="vary"` passes the real delta to the physics step rather than a fixed 1/60 s, which keeps physics synced to actual frame rate without tunneling artifacts at low frame rates. For experiments that require determinism across machines, switch to `timeStep={1/60}` and accept the de-coupling between render and physics frame.

### 1.2 Rigid Body Types

| Type | Rapier prop | Use case |
|---|---|---|
| Dynamic | `type="dynamic"` | Props, rocks, logs that fall and collide freely |
| Kinematic (position-based) | `type="kinematicPosition"` | Player character controller; you set the next translation directly each frame |
| Kinematic (velocity-based) | `type="kinematicVelocity"` | Moving platforms, doors; you drive it with a velocity rather than absolute position |
| Fixed | `type="fixed"` | Terrain, tree trunks, walls; never moves, zero sim cost |

The player should always be `kinematicPosition`. Dynamic players are harder to tune, jitter against walls, and accumulate floating-point drift on slopes. Kinematic position gives deterministic control over where the capsule ends up each frame after the character controller resolves collisions.

### 1.3 Collider Shapes

```tsx
import {
  CapsuleCollider,
  CuboidCollider,
  BallCollider,
  TrimeshCollider,
  HeightfieldCollider,
} from '@react-three/rapier'
```

- **CapsuleCollider** -- player character (radius 0.3 m, halfHeight 0.6 m when standing, 0.2 m when crouched)
- **CuboidCollider** -- cover objects (rocks, logs, boards) before grab; also static furniture
- **TrimeshCollider** -- terrain mesh; concave, fixed only (no dynamic trimesh in Rapier)
- **HeightfieldCollider** -- preferred for open terrain; cheaper than trimesh, still concave
- **BallCollider** -- small physics props, debris

Compound colliders (multiple collider components inside one `<RigidBody colliders={false}>`) are needed for L-shaped or non-convex props.

### 1.4 Sensors / Trigger Zones

Set `sensor` on any collider to make it a non-colliding intersection detector. Use for:

- Approach-zone triggers (auto-crouch when entering a 1 m sphere around a cover object)
- Habitat zone boundaries (stream edge, rock outcrop -- affects `WeatherSystem` encounter modifiers)
- VR teleport landing zones

```tsx
<CuboidCollider
  args={[0.6, 0.6, 0.6]}
  sensor
  onIntersectionEnter={({ other }) => dispatch({ type: 'ENTER_APPROACH_ZONE', payload: other })}
  onIntersectionExit={() => dispatch({ type: 'EXIT_APPROACH_ZONE' })}
/>
```

### 1.5 Joints

Joints are available via `useSphericalJoint`, `useFixedJoint`, `useRevoluteJoint`, `usePrismaticJoint`. For this project the primary use case is a hinge on a hinged log or board cover object that swings open when lifted, rather than being translated. This adds a tactile realism to the flip animation.

### 1.6 Rapier Character Controller

Rapier ships a dedicated `KinematicCharacterController` (separate from the rigid body system) that handles:

- Slope climbing up to a configured max angle
- Stair/ledge stepping up to a configured offset
- Slide along walls instead of stopping dead
- Snap-to-ground on short descents

Access it through `useRapier`:

```tsx
import { useRapier } from '@react-three/rapier'

const { rapier, world } = useRapier()
const characterController = world.createCharacterController(0.01) // offset from collider
characterController.setUp({ x: 0, y: 1, z: 0 })
characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
characterController.setMinSlopeSlideAngle((30 * Math.PI) / 180)
characterController.enableAutostep(0.35, 0.1, true) // maxHeight, minWidth, dynamic
characterController.enableSnapToGround(0.3)
```

Each frame, call `characterController.computeColliderMovement(collider, desiredMovement)` then read `characterController.computedMovement()` and apply it to the kinematic body's next translation. Clean up with `world.removeCharacterController(characterController)` on unmount.

---

## 2. First-Person Controller

### 2.1 Architecture Recommendation

Use a kinematic capsule as the physics body. The camera lives as a child Three.js Object3D offset to eye height; it is NOT a physics body. Mouse/pointer lock drives yaw on the capsule root and pitch on the camera node separately (clamped to +/- 85 degrees to prevent gimbal flip).

### 2.2 Movement

| State | Speed | Notes |
|---|---|---|
| Walk | 4.0 m/s | Default |
| Run | 8.0 m/s | Held sprint input; triggers FOV punch and head bob |
| Crouch | 1.8 m/s | Capsule halfHeight shrinks; camera lowers by ~0.5 m |
| Jump | 5.5 m/s initial vertical velocity | Allowed only when grounded (`characterController.computedGrounded()`) |

### 2.3 Head Bob

Head bob is a sinusoidal vertical + small lateral oscillation applied to the camera's local position, not to the physics body. Parameters:

```ts
interface HeadBobParams {
  walkBobFrequency: number     // Hz, default 1.8
  walkBobAmplitudeY: number    // meters, default 0.04
  walkBobAmplitudeX: number    // meters, default 0.02
  runBobFrequency: number      // Hz, default 2.6
  runBobAmplitudeY: number     // meters, default 0.07
  runBobAmplitudeX: number     // meters, default 0.035
  crouchBobFrequency: number   // Hz, default 1.2
  crouchBobAmplitudeY: number  // meters, default 0.02
}
```

Bob phase drives footstep audio sync: emit a footstep sound event at each downward zero-crossing of the vertical bob sine (twice per cycle). This eliminates a separate footstep timer.

Head bob must be completely disabled when `accessibility.motionReduction` is true (see Section 11).

### 2.4 FOV Punch on Sprint

On sprint start, GSAP or a manual lerp eases the camera FOV from the base value (70 deg) to a sprint value (78 deg) over ~200 ms. On sprint release, it returns over ~400 ms. The easing curve should be an ease-out so the punch feels immediate but the recovery feels natural.

### 2.5 Camera Shake

A lightweight trauma/shake system: `trauma` is a float 0--1 that decays toward 0 at ~2/s. Applying an event adds to trauma (capped at 1). Each frame, `shake = trauma^2`. Camera position and rotation receive random offsets scaled by shake, sampled from a noise function (simplex or just a seeded sinusoid is fine at this amplitude). Maximum shake offsets: +-0.05 m position, +-3 degrees rotation. Camera shake must be disabled under `accessibility.motionReduction`.

### 2.6 TypeScript Signature

```ts
// Controller props
interface FirstPersonControllerProps {
  /** Physics capsule half-height when standing (default 0.85 m) */
  standingHalfHeight?: number
  /** Physics capsule half-height when crouched (default 0.3 m) */
  crouchedHalfHeight?: number
  /** Capsule radius (default 0.3 m) */
  radius?: number
  /** Camera eye offset from top of capsule (default -0.1 m) */
  eyeOffset?: number
  /** Walking speed in m/s */
  walkSpeed?: number
  /** Running speed in m/s */
  runSpeed?: number
  /** Crouching speed in m/s */
  crouchSpeed?: number
  /** Jump impulse m/s */
  jumpSpeed?: number
  /** Mouse/pointer sensitivity multiplier (default 1.0) */
  lookSensitivity?: number
  /** Base camera FOV in degrees (default 70) */
  fovBase?: number
  /** Sprint FOV in degrees (default 78) */
  fovSprint?: number
  /** Whether head bob is enabled -- overridden to false by accessibility.motionReduction */
  headBob?: boolean
  /** Whether camera shake is enabled -- overridden to false by accessibility.motionReduction */
  cameraShake?: boolean
  /** Called each frame with current grounded state and velocity */
  onLocomotionUpdate?: (state: LocomotionState) => void
}

interface LocomotionState {
  isGrounded: boolean
  isRunning: boolean
  isCrouching: boolean
  speed: number          // m/s, horizontal
  position: THREE.Vector3
  yaw: number            // radians
}

// The component wraps a RigidBody + camera subtree:
export const FirstPersonController: React.FC<FirstPersonControllerProps>
```

---

## 3. Third-Person Camera Option

### 3.1 Spring-Arm Follow Camera

The third-person mode is optional and used for the "observe" perspective in experiments where the player watches an agent (e.g., an eft moving through leaf litter). It is not the primary interaction mode.

Architecture:

- A `springArmLength` target distance (default 5 m behind and 1.5 m above the pivot)
- Each frame, the actual arm length lerps toward the target at a configurable `springStiffness`
- The camera position is recomputed from the pivot + arm direction each frame after lerp

### 3.2 Collision Avoidance

Before applying the lerped arm length, fire a ray from the pivot point toward the camera's target position. If the ray hits geometry before reaching `armLength`, clamp the actual length to `hitDistance - 0.15 m` (a small margin to prevent clipping). This is a single raycast per frame using `world.castRay()` from Rapier, or Three.js `Raycaster.intersectObjects()` against the static scene mesh.

```ts
interface ThirdPersonCameraProps {
  target: React.RefObject<THREE.Object3D>
  armLength?: number         // default 5.0 m
  armHeight?: number         // default 1.5 m
  springStiffness?: number   // lerp factor per second, default 8.0
  collisionMargin?: number   // default 0.15 m
  pitchMin?: number          // degrees, default -30
  pitchMax?: number          // degrees, default 60
}
```

---

## 4. Object Interaction

### 4.1 Interaction Lifecycle

```
hover -> grab -> hold -> release -> impact
```

**Hover:** A ray fires from the camera center (or VR controller tip) each frame. If it hits an interactable rigid body, a rim-light highlight activates on that mesh. The cursor or reticle changes state. Hovering is purely visual -- no physics state changes.

**Grab:** The INTERACT action is triggered. The grabbed rigid body's type switches from `dynamic` to `kinematicPosition`. A "hold socket" transform is computed (a fixed offset in camera space), and each frame the kinematic body's next position is set to match that socket. The body's collider remains active, so it can push other objects.

**Hold:** The held object tracks the hold socket with a configurable lag (lerp factor ~12/s) to simulate weight and inertia. Heavier objects (higher `mass`) should use a lower lerp factor to feel sluggish. Angular orientation follows the camera look direction for grabbed objects that are meant to be examined.

**Release:** The rigid body type switches back to `dynamic`. Its linear velocity is set to the camera's estimated velocity (delta position / delta time from the last two frames) times a `throwMultiplier`. Angular velocity is zeroed to avoid uncontrolled spin.

**Impact:** On `onCollisionEnter`, read the `manifold.solverContactPoint(0)` and the relative velocity magnitude. If `|impactVelocity| > impactThreshold`, emit a collision audio event tagged with the object's material type (rock, wood, soil) and trigger controller haptic feedback (see Section 10). The `EventEngine` does not need to know about this -- it's purely a presentation concern.

### 4.2 Hover Highlight -- Rim-Light Shader

Rim lighting is applied as a post-pass outline or as an emissive rim term injected into the material's `onBeforeCompile` hook. The `onBeforeCompile` approach is preferred because it works per-material without a full outline pass and has near-zero frame budget cost.

The rim factor is `pow(1.0 - dot(normalize(vNormal), normalize(vViewPosition)), rimPower)` multiplied by a highlight color (warm white `#e8dfc0` by default, orange for high-urgency objects). Intensity animates from 0 to 1 via a simple lerp on `hover` entry and back on `hover` exit over ~100 ms.

### 4.3 Weight Feel via Mass and Damping

Set these per-prop class on the `<RigidBody>`:

| Prop class | mass | linearDamping | angularDamping | throwMultiplier |
|---|---|---|---|---|
| Small rock (<0.5 kg) | 0.4 | 0.5 | 0.8 | 1.4 |
| Medium rock (1-3 kg) | 2.0 | 1.2 | 1.5 | 0.9 |
| Log section | 5.0 | 2.5 | 3.0 | 0.6 |
| Board | 1.5 | 1.0 | 1.2 | 1.0 |
| Bark piece | 0.3 | 0.4 | 0.6 | 1.6 |
| Salamander (examination) | 0.05 | 4.0 | 4.0 | 0.0 (never thrown) |

---

## 5. Gamepad Input Mapping

### 5.1 Standard Gamepad Mapping

The browser Gamepad API exposes a `standard` mapping for most modern controllers. Axis 0/1 is the left stick, axis 2/3 is the right stick. Buttons follow the standard layout index.

| Button index | Xbox | PS5 | Switch Pro |
|---|---|---|---|
| 0 | A | Cross | B |
| 1 | B | Circle | A |
| 2 | X | Square | Y |
| 3 | Y | Triangle | X |
| 4 | LB | L1 | L |
| 5 | RB | R1 | R |
| 6 | LT | L2 | ZL |
| 7 | RT | R2 | ZR |
| 8 | Select/View | Create | Minus |
| 9 | Start/Menu | Options | Plus |
| 10 | L3 | L3 | L3 |
| 11 | R3 | R3 | R3 |
| 12 | D-up | D-up | D-up |
| 13 | D-down | D-down | D-down |
| 14 | D-left | D-left | D-left |
| 15 | D-right | D-right | D-right |

Default bindings:

| Action | Button/Axis |
|---|---|
| Move | Left stick (axis 0/1) |
| Look | Right stick (axis 2/3) |
| Jump | Button 0 (A/Cross/B) |
| Interact | Button 2 (X/Square/Y) |
| Inspect | Button 3 (Y/Triangle/X) |
| Crouch (hold) | Button 6 (LT/L2/ZL) or Button 10 (L3) |
| Run (hold) | Button 7 (RT/R2/ZR) |
| Open Notebook | Button 4 (LB/L1/L) |
| Pause | Button 9 (Menu/Options/Plus) |

### 5.2 Dead Zones

Apply a radial dead zone to each stick: discard input where `sqrt(x^2 + y^2) < 0.12`. After dead zone removal, remap the remaining range to [0, 1] so the first perceptible movement maps to a small but non-zero action value.

```ts
function applyDeadZone(x: number, y: number, deadZone = 0.12): [number, number] {
  const magnitude = Math.sqrt(x * x + y * y)
  if (magnitude < deadZone) return [0, 0]
  const normalized = (magnitude - deadZone) / (1 - deadZone)
  const scale = normalized / magnitude
  return [x * scale, y * scale]
}
```

### 5.3 Aim Curve

Right-stick look uses a square curve to give fine control in the center and faster rotation at the extremes: `output = sign(input) * input^2`. This reduces the over-sensitivity at low deflections that makes aiming feel twitchy with a linear curve. Default look sensitivity: 120 deg/s at full deflection. Expose this as a settings value.

---

## 6. Touch Input for Tablets

### 6.1 Virtual Joystick

The left virtual joystick is a fixed-position zone in the lower-left quadrant of the screen (center at roughly 15% width, 80% height). It does not float to the first touch -- a fixed position reduces accidental activation and is easier for one-handed use.

The joystick consists of:
- A static outer ring rendered as an HTML canvas overlay or SVG
- An inner knob that tracks the touch point clamped to the outer ring radius (60 px)
- Normalized x/y output feeds directly into the MOVE_LEFT/MOVE_RIGHT/MOVE_FORWARD/MOVE_BACK actions

The joystick only appears when the experiment is in a walking/navigating state. During the ID challenge panel or notebook entry, the joystick hides to give full touchscreen access to the UI.

### 6.2 Tap to Interact

The rest of the screen surface is the look/pan zone on touch drag, and a single tap (< 200 ms, < 10 px drift) fires INTERACT. A two-finger tap fires INSPECT. Holding two fingers fires OPEN_NOTEBOOK.

On tablet the JUMP action is omitted or moved to a small on-screen button in the lower right, since the batesian mimicry experiment does not require jumping.

---

## 7. VR Input

### 7.1 Setup and Session

```tsx
import { createXRStore, XR, XROrigin } from '@react-three/xr'

const xrStore = createXRStore({
  controller: { teleportPointer: true },
  hand: { teleportPointer: true },
  handTracking: true,
  originReferenceSpace: 'local-floor',
  frameRate: 'high',
  foveation: 1,
})

// Conditionally render the Enter VR button:
const vrSupported = useXRSessionModeSupported('immersive-vr')
{vrSupported && <button onClick={() => xrStore.enterVR()}>Enter VR</button>}
```

### 7.2 Ray-Based Selection

`@react-three/xr` v6 provides pointer events that work exactly like R3F pointer events on the desktop. Interactable meshes receive `onPointerEnter`, `onPointerLeave`, `onPointerDown`, `onPointerUp` from controller rays with no additional setup. The same rim-light hover logic from Section 4.2 fires on `onPointerEnter`.

### 7.3 Grip and Release

Grip button state is read through `useXRInputSourceState`:

```tsx
import { useXRInputSourceState } from '@react-three/xr'

function GrabSystem() {
  const rightController = useXRInputSourceState('controller', 'right')
  const gripPressed = rightController?.gamepad['xr-standard-squeeze']?.state === 'pressed'
  // drive grab lifecycle from gripPressed
}
```

On grip press: run hover raycast to find nearest interactable; if within grab distance (0.4 m), enter grab state (see Section 4.1 lifecycle). On grip release: release with the controller's velocity as the throw impulse.

### 7.4 Teleportation Locomotion

```tsx
const xrStore = createXRStore({
  controller: { teleportPointer: true },
  hand: { teleportPointer: true },
})

// Mark walkable surfaces:
<TeleportTarget onTeleport={(pos) => setOriginPosition(pos)}>
  <ForestFloorMesh />
</TeleportTarget>

<XROrigin position={originPosition} />
```

Teleport is the only locomotion mode in VR. Smooth locomotion is not offered by default due to motion sickness risk. Users who opt into smooth locomotion (settings toggle) can use `useXRControllerLocomotion` with the left thumbstick for translation.

### 7.5 Snap Turn

`useXRControllerLocomotion` supports snap turn natively:

```tsx
useXRControllerLocomotion(originRef, false, {
  type: 'snap',
  degrees: 45,             // configurable in settings: 30, 45, or 60
  deadZone: 0.6,
})
```

Smooth turn is available as an accessibility option for users who do not experience comfort issues.

### 7.6 Hand Tracking

Hand tracking works through the same pointer event model when the user's headset and browser support it. In 2026-04-28 terms:

- **Meta Quest 3 (Meta Browser / Meta Quest Browser):** hand tracking fully supported via WebXR Hand Input module. Pinch gesture on index-thumb replaces trigger; palm-facing-up can serve as an alternate grab. Reliable for ray selection; latency on physics manipulation is ~20 ms higher than controller input.
- **Chrome on Android (XR-capable devices):** hand tracking support through Chrome's WebXR implementation; less reliable than Meta native browser, pinch detection thresholds vary by device.
- **Safari (iOS/visionOS):** visionOS WebXR support arrived in Safari 17.4 for `immersive-vr` on Apple Vision Pro. Hand/eye tracking exposure through WebXR is still limited to gaze + pinch as of early 2026; full hand joint API (`XRHand`) is available behind a flag on visionOS. Do not depend on it for the core interaction model.
- **Firefox Reality / Wolvic:** niche; do not optimize for, but do not break.

When hand tracking is unavailable, the XR session falls back to controller mode gracefully. The "Enter VR" button should not appear on browsers that lack `'immersive-vr'` support (use `useXRSessionModeSupported`).

---

## 8. Unified Input Layer -- Action Map

### 8.1 Design Principle

All input sources write into a single reactive action state object. Gameplay code (EventEngine hooks, locomotion, UI) reads only from this object and never queries raw input devices. This means the batesian mimicry encounter flow works identically whether the student is on a keyboard, a PS5 controller, a tablet, or inside a Quest 3.

### 8.2 TypeScript Schema

```ts
// -----------------------------------------------------------------------
// Action identifiers
// -----------------------------------------------------------------------

export type ActionId =
  | 'MOVE_FORWARD'
  | 'MOVE_BACK'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'LOOK_X'           // continuous axis: -1 (left) to +1 (right)
  | 'LOOK_Y'           // continuous axis: -1 (down) to +1 (up)
  | 'JUMP'
  | 'RUN'
  | 'CROUCH'
  | 'INTERACT'
  | 'INSPECT'
  | 'OPEN_NOTEBOOK'
  | 'PAUSE'
  | 'NAVIGATE_UP'      // for menu / notebook navigation
  | 'NAVIGATE_DOWN'
  | 'NAVIGATE_LEFT'
  | 'NAVIGATE_RIGHT'
  | 'CONFIRM'          // menu confirm / ID challenge submit
  | 'CANCEL'           // menu back / close panel

// -----------------------------------------------------------------------
// Action value types
// -----------------------------------------------------------------------

/** An action that is either on or off this frame */
export interface ButtonAction {
  kind: 'button'
  pressed: boolean    // true if held this frame
  justPressed: boolean
  justReleased: boolean
}

/** An action with a continuous scalar value (sticks, triggers) */
export interface AxisAction {
  kind: 'axis'
  value: number       // [-1, 1] with dead zone applied
}

export type ActionValue = ButtonAction | AxisAction

// -----------------------------------------------------------------------
// The full action map, updated once per frame by the input system
// -----------------------------------------------------------------------

export interface ActionMap {
  MOVE_FORWARD:   ButtonAction
  MOVE_BACK:      ButtonAction
  MOVE_LEFT:      ButtonAction
  MOVE_RIGHT:     ButtonAction
  LOOK_X:         AxisAction
  LOOK_Y:         AxisAction
  JUMP:           ButtonAction
  RUN:            ButtonAction
  CROUCH:         ButtonAction
  INTERACT:       ButtonAction
  INSPECT:        ButtonAction
  OPEN_NOTEBOOK:  ButtonAction
  PAUSE:          ButtonAction
  NAVIGATE_UP:    ButtonAction
  NAVIGATE_DOWN:  ButtonAction
  NAVIGATE_LEFT:  ButtonAction
  NAVIGATE_RIGHT: ButtonAction
  CONFIRM:        ButtonAction
  CANCEL:         ButtonAction
}

// -----------------------------------------------------------------------
// Binding definition -- how one physical input maps to one action
// -----------------------------------------------------------------------

export type InputSource = 'keyboard' | 'mouse' | 'gamepad' | 'touch' | 'vr'

export interface Binding {
  source: InputSource
  /** For keyboard: KeyboardEvent.code. For gamepad: 'button_N' or 'axis_N'. For touch/vr: semantic name. */
  physicalInput: string
  /** Optional axis inversion */
  invert?: boolean
}

export interface ActionBinding {
  actionId: ActionId
  bindings: Binding[]
}

export type BindingConfig = ActionBinding[]
```

### 8.3 Binding Table

| Action | Keyboard | Mouse | Gamepad | Touch | VR Controller |
|---|---|---|---|---|---|
| MOVE_FORWARD | `KeyW` / Arrow Up | -- | Axis1 negative | Left joystick up | Left thumbstick Y- |
| MOVE_BACK | `KeyS` / Arrow Down | -- | Axis1 positive | Left joystick down | Left thumbstick Y+ |
| MOVE_LEFT | `KeyA` / Arrow Left | -- | Axis0 negative | Left joystick left | Left thumbstick X- |
| MOVE_RIGHT | `KeyD` / Arrow Right | -- | Axis0 positive | Left joystick right | Left thumbstick X+ |
| LOOK_X | -- | MouseMove X | Axis2 | Touch drag X (right zone) | Right thumbstick X |
| LOOK_Y | -- | MouseMove Y | Axis3 | Touch drag Y (right zone) | Right thumbstick Y |
| JUMP | `Space` | -- | Button0 | -- | -- |
| RUN | `ShiftLeft` / `ShiftRight` | -- | Button7 (RT) | -- | Left thumbstick press (Button10) |
| CROUCH | `ControlLeft` / `KeyC` | -- | Button6 (LT) | -- | -- |
| INTERACT | `KeyE` | Left click | Button2 (X/Square/Y) | Single tap | Trigger (right) |
| INSPECT | `KeyF` | Right click | Button3 (Y/Triangle/X) | Two-finger tap | Trigger (left) |
| OPEN_NOTEBOOK | `KeyN` / `Tab` | -- | Button4 (LB/L1/L) | Two-finger hold | B button (right) |
| PAUSE | `Escape` | -- | Button9 (Menu/Options/+) | -- | Menu button |
| NAVIGATE_UP | Arrow Up / `KeyW` | Scroll up | Button12 (D-up) | Swipe up in panel | D-pad up |
| NAVIGATE_DOWN | Arrow Down / `KeyS` | Scroll down | Button13 (D-down) | Swipe down in panel | D-pad down |
| NAVIGATE_LEFT | Arrow Left / `KeyA` | -- | Button14 (D-left) | Swipe left | D-pad left |
| NAVIGATE_RIGHT | Arrow Right / `KeyD` | -- | Button15 (D-right) | Swipe right | D-pad right |
| CONFIRM | `Enter` / `Space` | Left click (UI) | Button0 (A/Cross/B) | Tap (on UI) | Trigger (ray on UI) |
| CANCEL | `Escape` / `Backspace` | Right click (UI) | Button1 (B/Circle/A) | Swipe back | B/Y button |

### 8.4 Input System Implementation Notes

The input system runs in a `useFrame` at negative priority (-100) so it resolves before any gameplay `useFrame` consumers run. It reads:

- `document` keyboard events (cached into a `Set<string>` of currently held keys)
- `navigator.getGamepads()` polled every frame
- Touch state from `touchstart/touchmove/touchend` listeners on the canvas
- XR controller gamepad state via `useXRInputSourceState`

It writes a fresh `ActionMap` into a Zustand store slice each frame. Gameplay components subscribe to specific actions with `useStore((s) => s.input.INTERACT)`.

---

## 9. Settings-Driven Rebind

### 9.1 Data Model

```ts
export interface InputSettings {
  /** User-defined overrides. Key is ActionId, value is array of bindings that REPLACE defaults. */
  rebinds: Partial<Record<ActionId, Binding[]>>
  /** Per-source sensitivity multipliers */
  mouseSensitivity: number      // default 1.0
  gamepadLookSensitivity: number // default 1.0
  gamepadDeadZone: number        // default 0.12
  /** Whether crouch is hold-to-crouch (false) or toggle (true) */
  crouchToggle: boolean
  /** Whether run is hold-to-run (false) or toggle (true) */
  runToggle: boolean
  /** Whether INTERACT fires on press (false) or requires hold for 0.3 s (true) */
  interactHold: boolean
}
```

Rebinds are stored in `localforage` under `borchardlabs/settings/input`. On load, the input system merges `rebinds` over the default binding config.

### 9.2 Rebind UI Flow

1. Settings menu shows the binding table.
2. User clicks a row -- it enters "listening" state (displays "press a key").
3. The input system captures the next physical input on any source.
4. It checks for conflicts with existing bindings; if a conflict exists, it shows a warning and offers to swap.
5. The new binding is written into `InputSettings.rebinds`.
6. The input system rebuilds its lookup structure from defaults + rebinds.

Rebind persists across sessions. A "Reset to defaults" button clears `rebinds`.

---

## 10. Collision Audio and Haptics

### 10.1 Collision Audio

Physics collision events emit audio signals through a thin bridge to the audio system (Agent 4's domain). The interaction system's responsibility is to determine:

- Which material tag the colliding body has (rock, wood, soil, bark, leaf, metal)
- The impact velocity magnitude (used by the audio system to select a soft/hard variant)
- The contact point world position (used for spatial audio placement)

```ts
export interface CollisionAudioEvent {
  materialA: MaterialTag
  materialB: MaterialTag
  impactVelocity: number   // m/s
  contactPoint: THREE.Vector3
}

export type MaterialTag = 'rock' | 'wood' | 'soil' | 'bark' | 'leaf' | 'water' | 'generic'
```

Attach a `materialTag` user data property to every `<RigidBody>`. The `onCollisionEnter` callback reads both bodies' tags and dispatches a `CollisionAudioEvent` to the audio bus (via Zustand action or a simple event emitter).

Low-velocity contacts (< 0.3 m/s) are suppressed to avoid a constant drizzle of quiet audio.

### 10.2 Controller Haptics

Haptic feedback uses the Gamepad API's `hapticActuators`:

```ts
function rumble(gamepadIndex: number, duration: number, weakMagnitude: number, strongMagnitude: number) {
  const gp = navigator.getGamepads()[gamepadIndex]
  const actuator = gp?.hapticActuators?.[0]
  if (actuator && 'playEffect' in actuator) {
    (actuator as any).playEffect('dual-rumble', {
      duration,
      weakMagnitude,
      strongMagnitude,
    })
  }
}
```

Haptic events by scenario:

| Event | Duration (ms) | Weak | Strong | Notes |
|---|---|---|---|---|
| Pick up object | 80 | 0.3 | 0.1 | Brief acknowledgment |
| Release + impact (light) | 100 | 0.4 | 0.2 | Rock on soil |
| Release + impact (heavy) | 180 | 0.6 | 0.5 | Log on rock |
| Salamander found | 200 | 0.1 | 0.0 | Soft pulse, sense of discovery |
| Survey event (e.g., copperhead) | 300 | 0.8 | 0.7 | Startle response |

In VR, haptics use the XR session's input source `hapticActuators` array rather than the Gamepad API directly.

---

## 11. Accessibility

### 11.1 Motion Reduction

A global `accessibility.motionReduction` boolean (stored in settings, defaulting to false) disables all vestibular-stressful effects:

- Head bob (Section 2.3) -- completely disabled
- Camera shake (Section 2.5) -- completely disabled
- FOV punch on sprint (Section 2.4) -- disabled; FOV stays constant
- VR teleport arc animation -- instant fade-cut instead of arc
- GSAP menu transition animations -- replaced with zero-duration cuts

This flag respects `prefers-reduced-motion` from the OS media query and defaults to true if the browser reports it.

### 11.2 One-Handed Mode

When `accessibility.oneHanded` is true:

- The virtual joystick on tablet moves to the right side of the screen
- Gamepad: right stick can drive both look and movement via a mode-toggle button (D-pad center or click R3)
- OPEN_NOTEBOOK and INSPECT are moved to gamepad D-pad long-press combinations rather than dedicated buttons

### 11.3 Hold-to-Toggle vs Press-to-Toggle

Crouch and run can each be configured as either:
- **Hold:** active only while the button is held (default for run; feels natural for sprinting)
- **Toggle:** press once to activate, press again to deactivate (default for crouch; reduces fatigue in long survey sessions)

The INTERACT action optionally supports a "hold to interact" mode (accessible setting) where the action requires a 300 ms hold before firing, reducing accidental triggers for users with motor control differences.

### 11.4 Additional Flags

- `accessibility.largeText` -- scales HUD font sizes by 1.4x
- `accessibility.highContrast` -- swaps earth-tone palette for a higher-contrast variant; species identification UI never relies on red/green discrimination alone (shape and pattern information always present)
- `accessibility.subtitles` -- enables text captions for any positional audio events (footsteps, weather, environmental cues) that carry gameplay information

---

## Risks and Open Questions

**1. VR hand tracking latency on physics grab (HIGH RISK)**
The grip-and-physics-handoff lifecycle in Section 4.1 assumes that the controller's position update and the physics step happen within the same frame. On Meta Quest 3 via the browser, hand tracking joint positions arrive with ~1 frame of additional latency compared to controller input. Objects held with hand tracking will lag noticeably. Mitigation: in hand-tracking mode, skip the physics kinematic body and instead attach the held object's transform directly to the hand joint transform, bypassing the physics body while held. Re-enable physics on release.

**2. Safari WebXR gaps (HIGH RISK)**
Safari on iOS does not support `immersive-vr` as of 2026-04-28. visionOS Safari supports it for Apple Vision Pro but the `XRHand` joint API is behind a flag. The interaction model must degrade cleanly: hide the Enter VR button when `useXRSessionModeSupported('immersive-vr')` returns false. Do not block the desktop experience on Safari parity.

**3. Gamepad API browser inconsistency (MEDIUM RISK)**
The `standard` mapping is not uniformly implemented. Some controllers on Firefox report a non-standard layout. Some Bluetooth PS5 controllers on Chrome report the DualSense in standard mapping but with the touchpad click on an unexpected index. Test the default binding table against at least three physical controllers before shipping, and expose easy per-game rebind as the safety net.

**4. Kinematic controller vs Rapier world step rate (MEDIUM RISK)**
If the physics world runs at a fixed 60 Hz step and the render loop runs at 90+ Hz (high-refresh monitor or VR), the character controller's output position will stutter unless the rendered position is interpolated between physics steps. `@react-three/rapier` does not perform kinematic body interpolation by default. The player controller implementation must handle this with a manual interpolation pass or by switching to `timeStep="vary"` (accepting non-determinism in physics).

**5. Touch joystick interaction with the R3F canvas (MEDIUM RISK)**
R3F captures pointer events on the canvas, which can interfere with a fixed-position virtual joystick rendered as an HTML overlay. The joystick overlay must call `event.stopPropagation()` on its touch events to prevent them from reaching the canvas raycaster. This is straightforward but easy to miss during integration and can cause double-firing of INTERACT when tapping the joystick zone.

**6. Rapier character controller and sloped forest terrain (LOW-MEDIUM RISK)**
The forest floor terrain will have gentle slopes and exposed root geometry. The Rapier character controller handles slopes well up to the configured `maxSlopeClimbAngle`, but convex bumps on the trimesh (roots, rocks embedded in soil) can cause the capsule to briefly lose ground contact and re-land with an audible impact sound. Tuning `enableSnapToGround` and the collider offset should resolve this, but it requires playtesting on the actual terrain mesh.

**7. Action-map rebind UI scope (LOW RISK, scope creep)**
Full cross-source rebind (remapping a keyboard key AND its gamepad equivalent AND its touch gesture simultaneously) is complex UI work. For the initial engine release, limit rebind to keyboard/gamepad only. Touch and VR bindings are fixed. This is a known gap and can be revisited as a V2 accessibility feature.

**8. Open question -- Zustand vs event emitter for input delivery**
The action map is written to Zustand each frame (Section 8.4). For actions that fire once (justPressed), React re-renders triggered by Zustand subscription could be a performance concern at 90 Hz. An alternative is a plain event emitter for one-shot actions and Zustand only for continuous state (held buttons, axis values). This tradeoff needs a brief prototype to measure.
