# Game Systems -- Save/Load, Progression, HUD

**Document date:** 2026-04-28
**Author:** Systems & UX Research -- Phase 0 Agent 6
**Scope:** Save/load architecture, progression design, HUD component specifications,
settings schema, pause contract, onboarding, telemetry, notifications, localization,
and VR HUD strategy.

---

## Executive Summary

Borchard Labs is a small, high-quality educational simulation site, not a live-service
game. That distinction drives every decision in this document. The save system should
be invisible when things go right and informative when they go wrong. The progression
layer should reward genuine engagement with the science -- a student who sits through
allele fixation in Hardy-Weinberg earns something because they understood what they
were seeing, not because they clicked fast. The HUD must feel like real fieldwork
equipment: a beaten notebook, a clipboard clamped with binder clips, a clouded sample
jar -- surfaces that belong in the same world as the 3D forest and lab bench, never
like a SaaS dashboard accidentally dropped into a game. Every design choice here flows
from three constraints: the Borchard Labs design-system tokens (parchment, earth tones,
Merriweather, Source Sans, Fira Code) are inviolable; VR is an enhancement with
explicit fallback paths for every component; and nothing in the game layer should
compromise the scientific integrity of the simulation math.

---

## 1. Save/Load Architecture

### 1.1 Storage Backend -- localforage

localforage wraps IndexedDB with a clean async API and falls back to WebSQL, then
localStorage when IndexedDB is unavailable. It is the correct choice here: IndexedDB
can hold hundreds of kilobytes of structured JSON without any storage limit prompts on
most browsers, the API is promise-based and works well with async/await, and the
library is mature (actively maintained, ~10 kB gzipped).

Key points:
- One localforage instance per key namespace. Use `localforage.createInstance({ name: 'borchard-labs' })` to isolate from any other apps using the default store.
- Keys follow the pattern `save:global` (global progression) and `save:experiment:<slug>` (per-experiment state).
- The save routine runs on every meaningful state transition (end of each simulation tick batch, on pause, on experiment complete), not on a raw RAF loop. This prevents write storms.
- On first load, check for the key. If missing, treat as a new session. If present, offer "Resume" vs "New Survey."

### 1.2 Versioned Save Schema

Every save file carries a `version` integer. On load, the engine calls
`migrateGlobalSave(raw)` or `migrateExperimentSave(slug, raw)` before handing the
object to the experiment. Each migration function is a switch-case over version
numbers, applying patches in sequence. This is the standard "up-migration" pattern
used in virtually every game with persistent saves.

```typescript
// ---------------------------------------------------------------
// Global save file -- one per browser, tracks cross-experiment
// progression and settings overrides
// ---------------------------------------------------------------

interface DiscoveryEntry {
  id: string;              // unique discovery key, e.g. "hw.allele-fixation"
  experimentSlug: string;
  unlockedAt: number;      // Unix ms timestamp
  label: string;           // display label for the field journal
  note: string;            // one or two sentences the student triggered
}

interface BadgeEntry {
  id: string;              // unique badge key, e.g. "hw.first-survey"
  experimentSlug: string;
  earnedAt: number;        // Unix ms timestamp
  displayName: string;
  description: string;
}

interface GlobalSaveFile {
  version: number;         // increment when schema changes
  createdAt: number;
  updatedAt: number;

  // Progression
  discoveries: DiscoveryEntry[];
  badges: BadgeEntry[];

  // Which experiments the student has touched at all
  experimentVisited: Record<string, number>; // slug -> first visit timestamp

  // Persisted consent flag
  telemetryConsent: boolean | null; // null = not yet asked

  // Settings that override per-experiment defaults (user can adjust globally)
  globalSettingsOverride: Partial<Settings>;
}

// ---------------------------------------------------------------
// Per-experiment save file -- one per experiment slug
// ---------------------------------------------------------------

interface ExperimentSaveFile {
  version: number;
  experimentSlug: string;
  savedAt: number;

  // Opaque blob that the experiment's getSaveState() / loadSaveState() contract
  // defines. The engine does not interpret this; it just stores and returns it.
  simulationState: unknown;

  // Snapshot of config values at time of save (so resume uses the same params)
  configSnapshot: Record<string, unknown>;

  // In-progress data collector rows, so a student can resume mid-survey
  pendingRows: unknown[];

  // Which milestones have already fired this session (so they don't re-trigger on load)
  firedMilestones: string[];
}
```

### 1.3 Migration Strategy

```typescript
// Example migration runner. Each experiment implements its own version of this.
function migrateExperimentSave(slug: string, raw: unknown): ExperimentSaveFile {
  let save = raw as ExperimentSaveFile;

  // Version 0 -> 1: firedMilestones field did not exist
  if (save.version < 1) {
    save = { ...save, firedMilestones: [], version: 1 };
  }

  // Version 1 -> 2: configSnapshot was called "params" in early builds
  if (save.version < 2) {
    const legacy = save as any;
    save = {
      ...save,
      configSnapshot: legacy.params ?? {},
      version: 2,
    };
    delete (save as any).params;
  }

  // Add future migrations here in sequence.
  return save;
}
```

Rules:
- The current target version is defined as a constant (`GLOBAL_SAVE_VERSION`,
  `EXPERIMENT_SAVE_VERSION`) in each respective module. Never hard-code it at the call
  site.
- If a migration cannot be safely completed (corrupted data, missing required field
  with no sensible default), the engine discards the save, logs a warning to the
  browser console, and presents a "Could not resume -- starting fresh" notice. It does
  not throw.
- Saves from a future version (version > current constant) are also discarded with
  the same notice. This handles the case where a student uses a newer version on one
  machine and then opens an older cached version elsewhere.

---

## 2. Progression -- Badges, Discoveries, Anti-Grind

### 2.1 Milestone Events

Each experiment defines an array of `Milestone` descriptors. The engine evaluates
them after every tick batch. Once a milestone fires, it writes a `DiscoveryEntry`
or `BadgeEntry` to the global save, emits a `milestone:fired` event on the game bus,
and records its key in `firedMilestones` so it never fires again for the same save.

```typescript
interface Milestone {
  id: string;
  // Return true when the condition is met. Receives the experiment's current
  // public state snapshot. Should be pure and cheap to evaluate.
  condition: (state: ExperimentPublicState) => boolean;
  discovery?: {
    label: string;
    note: string; // written in the first person ("I observed...")
  };
  badge?: {
    displayName: string;
    description: string;
  };
}
```

**Hardy-Weinberg milestones (examples):**
- `hw.first-survey` -- badge -- awarded after the first completed generation run (any
  settings). Badge copy: "First Generation. You watched selection move the needle."
- `hw.allele-fixation` -- discovery -- awarded when either p or q reaches >= 0.99 in
  a run. Discovery note: "I watched an allele fix -- the population lost all genetic
  variation at this locus. Drift, selection, or founder effects can make this
  irreversible."
- `hw.bottleneck-observed` -- discovery -- awarded when the user enables drift AND
  sees population size < 20 individuals during any generation.
- `hw.hwe-equilibrium` -- badge -- awarded when the student runs a simulation with no
  selection, no drift, and large population for 20+ generations, and the Chi-squared
  HWE test passes.

**Batesian Mimicry milestones (examples):**
- `bm.first-flip` -- badge -- awarded on the first cover object flip.
- `bm.first-eft` -- discovery -- awarded on first confirmed Red Eft identification.
  Discovery note: "I found a Red Eft -- the terrestrial juvenile stage of the Eastern
  Newt. Its brilliant coloration signals genuine toxicity to predators."
- `bm.mimic-model-ratio` -- badge -- awarded when the student completes a survey with
  a 1:1 mimic-to-model ratio in at least 10 observations.
- `bm.field-journal-full` -- discovery -- awarded when all eight species have been
  encountered at least once across all sessions.

### 2.2 The Field Journal

The Field Journal is a global-progression screen, not an experiment-specific panel.
It is accessible from the main navigation and from the pause overlay. It renders as a
physical notebook: parchment pages, Merriweather headings, ruled lines, field sketches
as SVG or WebP illustrations.

Each `DiscoveryEntry` populates one journal page. Undiscovered pages appear as blank
pages with a species silhouette and the label "Unobserved." This creates a pull -- the
student can see how many pages are blank -- without being manipulative, because each
blank page names the condition needed to fill it. There is no ambiguity or artificial
mystery about what triggers a discovery.

Badge entries appear in a separate "Certifications" tab of the journal, styled as ink
stamps or wax seals on parchment.

### 2.3 Anti-Grind Principles

This is the most important section of the progression chapter, and it is short on
purpose. Three principles govern every milestone and badge decision:

1. **One per meaningful event, not per repetition.** No badge for "run 100
   simulations." If repeating the same action is educationally valuable (which it
   sometimes is in simulation work), the HUD provides visible feedback (stats, charts,
   CSV data) that is its own reward. The badge system does not pile on.

2. **Discoveries must carry scientific content.** Every `DiscoveryEntry.note` is a
   one-to-two sentence scientific statement, written as a field observation, that
   teaches something the student just witnessed. The note is the point. The badge icon
   is incidental.

3. **Nothing is locked behind progression.** Every experiment is fully accessible at
   full difficulty from day one. Progression only adds context and recognition; it
   never gates content. A student who wants to run the Hardy-Weinberg simulation
   without earning any badges can do so without restriction.

---

## 3. HUD Design Language

### 3.1 Core Principle -- Diegetic First

A diegetic UI element is one that exists inside the world the student occupies. A
clipboard the student carries is diegetic. A floating HTML div with a white background
and a shadow is not. The engine targets diegetic UI wherever the component's function
can be expressed through a physical metaphor without compromising clarity.

Reference targets by component type:
- **Outer Wilds Ship Log** -- information surfaces that feel like in-world artifacts
  (wax-sealed documents, aged paper) while remaining fully legible and navigable.
- **Subnautica PDA** -- a handheld device the player consults during play. Data
  readouts look like scanner output, not spreadsheets.
- **Firewatch radio** -- controls that feel tactile. The radio is an object in the
  world with a clear physical affordance. Interaction with it advances the story.

Where diegetic is not viable (e.g., transport controls on a population genetics
simulation, which has no physical world metaphor), the design falls back to the
existing `sim-hud` idiom from `main.css` -- parchment-warm background, earth tones,
Merriweather labels, Fira Code numbers. This is still visually consistent with the
world; it is just not spatially embedded in it.

### 3.2 Design System Token Mapping

The following CSS custom properties from `main.css` are the authoritative source for
all HUD surfaces. Tailwind must be configured to expose these as design tokens.

| Purpose | Token |
|---|---|
| Panel background (parchment) | `--parchment` (#faf8f4) |
| Panel background warm tint | `--parchment-warm` (#f3efe7) |
| Panel stroke / dividers | `--border` (#d4cec4) |
| Body text | `--ink` (#2b2b2b) |
| Secondary text | `--ink-light` (#555) |
| Faint / label text | `--ink-faint` (#888) |
| Primary accent | `--forest` (#2d6a4f) |
| Success / alive state | `--forest-light` (#52b788) |
| Warning / attention | `--gold` (#b8860b) |
| Danger / alert | `--rust` (#bc4749) |
| Data / monospace values | `--font-mono` (Fira Code) |
| Headings | `--font-heading` (Merriweather) |
| Body | `--font-body` (Source Sans 3) |

### 3.3 HUD Component Inventory

| Component | Diegetic? | Desktop mode | VR mode | State managed by | Notes |
|---|---|---|---|---|---|
| `<FieldNotebook>` | Yes | HTML overlay panel, slide-in from bottom, parchment styled, ruled lines | World-space `@react-three/uikit` card at chest height | Zustand: `notebook` slice | Ports existing FieldNotebook.js UI contract. Entry form maps to world-space input widgets in VR. |
| `<Clipboard>` | Yes | HTML overlay panel, right side, clamped header | World-space card, held in non-dominant hand anchor | Zustand: `clipboard` slice | Shows current survey config, checklist of cover objects, progress ticks. |
| `<SampleJar>` | Yes | Small overlay in corner, glass-texture CSS | 3D mesh child of R3F scene, selectable | Zustand: `sampleJar` slice | Displays caught specimen species card + measurements. Appears only during examination phase. |
| `<DataReadout>` | No | Parchment-warm strip below canvas, dl/dt/dd grid in Fira Code | World-space info panel, locked to lower visual field | Zustand: `sim` slice | Replaces existing `sim-stats` dl. Shows live numeric output (p, q, generation, population). |
| `<TransportControls>` | No | Horizontal button strip, `btn btn-sm` styling from main.css | World-space button strip, large hit targets for controller | Zustand: `sim` slice | Play/Pause/Step/Reset + speed slider. Ports existing HUD.js transport. |
| `<SettingsMenu>` | No | Full-screen overlay, three-column layout | Not shown in VR (open from pause menu before entering VR) | Zustand: `settings` slice | See Section 4 for full schema. |
| `<PauseOverlay>` | No | Semi-transparent film over canvas, centered card | World-space card, scene freeze | Zustand: `sim.state === 'paused'` | ESC key triggers. Resume / Restart / Settings / Quit to Menu. |
| `<LoadingScreen>` | Partial | Full-screen parchment, title, progress bar in Fira Code | Same -- 2D plane in front of camera before scene is ready | Zustand: `loading` slice | Shows asset load progress (percentage + current asset name). Styled as a field journal cover. |
| `<ToastNotification>` | No | Bottom-right corner, animated in/out via Framer Motion | Suppressed in VR (discovery events queued and shown on resume) | Local React state, triggered by game bus events | Discovery callouts, badge pops, save indicator. See Section 8. |
| `<FieldJournal>` | Yes | Full-screen overlay, paged notebook | Accessed from pause menu only (not mid-experiment) | Zustand: `global.discoveries` | Cross-experiment discovery log and badge archive. |
| `<OnboardingOverlay>` | No | Tooltip-style overlays tied to DOM elements, Framer Motion | Skipped in VR; user reads instrument labels instead | Zustand: `onboarding` slice | Three-step tutorial. See Section 6. |
| `<HelpMenu>` | No | Slide-out drawer, keybindings + quick reference | Same as desktop (shown from pause overlay) | Local React state | Accessible from main menu and pause overlay. |

### 3.4 Component Specifications

#### `<FieldNotebook>`

The FieldNotebook is the primary data-entry surface for observation experiments. It
replaces the existing `FieldNotebook.js` DOM manipulation approach with a React
component backed by the Zustand `notebook` slice.

Visual treatment:
- Background: `--parchment` (#faf8f4) with `repeating-linear-gradient` ruling at
  24px intervals in `rgba(69,123,157,0.10)` (matching the existing CSS in
  `FieldNotebook.js`).
- Header strip: `--parchment-warm` with a 2px bottom border in `--border`.
- Title: Merriweather 700, 1.25rem, `--ink`.
- Entry fields: two-column grid. Auto-populated fields in `--parchment-warm` chips
  with Fira Code values. Student-editable fields as bordered inputs, `--border` stroke,
  `--forest` focus ring.
- Save / Cancel buttons: `btn btn-primary` / `btn btn-ghost` from main.css.

Behavior contract:
- `openEntry(context: NotebookEntryContext): void` -- shows the entry form populated
  with the current animal and cover object data.
- `closeEntry(): void` -- closes without saving.
- `onSave(callback: (row: NotebookRow) => void): void` -- registers the save callback.
- The component emits `notebook:saved` on the game bus after each confirmed entry.

VR variant: `<FieldNotebook.VR>` renders via `@react-three/uikit`. The two-column
layout is simplified to a vertical stack at 1.2m x 0.8m world dimensions, positioned
at chest height 0.6m in front of the XR reference frame. Entry fields use the uikit
`Input` and `Select` widget equivalents. The keyboard in VR is handled by the XR
system's default text entry or a custom radial picker for categorical fields.

#### `<Clipboard>`

The Clipboard surfaces the current survey config and cover-object checklist. It is
meant to feel like the physical form a field researcher would carry.

Visual treatment:
- Outer shell: a slightly beveled rectangle with a metallic binder clip rendered in
  SVG at the top center. Background `--parchment-warm`. Drop shadow `--shadow-md`.
- Header text: Merriweather 700, site name + experiment date + survey number.
- Checklist: monospace rows, each with a checkbox-style indicator (an `x` mark in
  Fira Code when checked, blank when not). The check mark is `--forest`.
- Footer: weather icon + current weather descriptor in `--ink-faint`.

VR variant: physical clipboard mesh in the R3F scene, attached to the non-dominant
controller's grip anchor. The parchment texture is a canvas-rendered texture updated
via React Three Fiber's `CanvasTexture` pattern, sourcing from an off-screen HTML
canvas that renders the Clipboard component.

#### `<SampleJar>`

Shown only during the specimen examination phase. Represents the physical container
students would use to temporarily hold a caught animal.

Visual treatment: desktop -- bottom-left corner, 120x160px, glass-texture border
(CSS `background: radial-gradient(...)` with `--ocean-pale` tint, slight blur on the
inner area). Inside: species name in Merriweather 700, key measurements in Fira Code,
a small SVG silhouette of the animal's body shape.

VR variant: 3D glass jar mesh child of the XR scene. When a specimen is picked up,
the jar mesh animates open and the animal model moves into it. The species label is
a `uikit` Text node floating above the jar.

#### `<DataReadout>`

This component replaces the existing `sim-stats` dl grid. It surfaces the live
numeric state of the running simulation.

Visual treatment: horizontal strip, background `--parchment-warm`, 1px top and bottom
borders in `--border-light`. Label/value pairs in the existing `sim-stats` grid layout
from main.css. Labels: Source Sans 3, 0.75rem uppercase, `--ink-faint`. Values:
Fira Code, 0.85rem, `--ink`.

VR variant: a small floating card below the player's field of view (world-space,
locked to a comfortable reading angle). Uses `@react-three/uikit` Text and Container
nodes. Updates at most 4Hz in VR to minimize compositor load.

#### `<TransportControls>`

Direct descendant of the existing HUD.js transport strip. In React, this is a set of
buttons bound to the Zustand sim slice actions.

- Play/Pause: `btn btn-sm btn-primary`, toggles on sim state.
- Step: `btn btn-sm btn-secondary`, disabled when sim is running or complete.
- Reset: `btn btn-sm btn-ghost`.
- Speed: `<input type="range">` with Fira Code label, accent `--forest`.

VR variant: world-space button strip using `@react-three/uikit` `Button` nodes.
Hit targets are enlarged to 40x40 world mm to be usable with controller rays. Physical
feeling is reinforced by a `hapticPulse()` call on each button press.

#### `<SettingsMenu>`

Full-screen overlay. Opens from the pause overlay or via the main nav. See Section 4
for the complete settings schema.

Visual treatment: parchment background, Merriweather section headings, Source Sans 3
labels. Three columns on desktop (Graphics / Audio / Controls). One-column stack on
mobile. Preset buttons (`LOW / MEDIUM / HIGH / ULTRA`) styled as `filter-btn` from
main.css.

#### `<PauseOverlay>`

Triggered by ESC key or a visible pause button in the corner of the experiment canvas.
Freezes the simulation (see Section 5 for the pause contract).

Visual treatment: `rgba(43,43,43,0.65)` film over the canvas. Centered card with
parchment background, rounded corners, experiment title at top, four buttons stacked
vertically: Resume / Restart / Settings / Quit to Menu. The card uses `--shadow-lg`.

Framer Motion animation: fade in at 0.2s ease-out. The card slides up 8px on entry.

#### `<LoadingScreen>`

Full-screen parchment-colored cover, shown while assets stream. Styled to look like
the front cover of a field journal: site logo (Merriweather "Borchard Labs"), the
experiment name in smaller Merriweather, a thin ruled line, and a progress bar.

The progress bar is a simple horizontal rule that fills from left to right, colored
`--forest`. Below it, the current asset being loaded in Fira Code, 0.8rem, `--ink-faint`.

VR variant: a 2D plane placed 1.5m in front of the camera origin before the XR scene
is ready. Same visual treatment rendered via `@react-three/uikit`.

---

## 4. Settings Schema

The `settings` Zustand slice is persisted to `save:global` inside `globalSettingsOverride`
on every change. On boot, settings are loaded from the global save and merged with
compile-time defaults.

```typescript
// ---------------------------------------------------------------
// Graphics preset. Applied in one action, individual values can
// still be overridden after applying a preset.
// ---------------------------------------------------------------
type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

interface GraphicsSettings {
  preset: GraphicsPreset;
  targetFPS: 30 | 60 | 90 | 120;
  shadowQuality: 'off' | 'low' | 'medium' | 'high'; // cascade count and resolution
  ssao: boolean;
  bloom: boolean;
  depthOfField: boolean;
  antiAlias: 'none' | 'smaa' | 'taa';
  renderScale: number; // 0.5 | 0.75 | 1.0 | 1.25 | 1.5
  maxLODDistance: number; // world units; controls LOD aggressiveness
}

// Preset definitions (engine applies these as defaults)
const GRAPHICS_PRESETS: Record<GraphicsPreset, Omit<GraphicsSettings, 'preset'>> = {
  low: {
    targetFPS: 60,
    shadowQuality: 'low',
    ssao: false,
    bloom: false,
    depthOfField: false,
    antiAlias: 'none',
    renderScale: 0.75,
    maxLODDistance: 30,
  },
  medium: {
    targetFPS: 60,
    shadowQuality: 'medium',
    ssao: false,
    bloom: true,
    depthOfField: false,
    antiAlias: 'smaa',
    renderScale: 1.0,
    maxLODDistance: 50,
  },
  high: {
    targetFPS: 60,
    shadowQuality: 'high',
    ssao: true,
    bloom: true,
    depthOfField: false,
    antiAlias: 'smaa',
    renderScale: 1.0,
    maxLODDistance: 80,
  },
  ultra: {
    targetFPS: 90,
    shadowQuality: 'high',
    ssao: true,
    bloom: true,
    depthOfField: true,
    antiAlias: 'taa',
    renderScale: 1.25,
    maxLODDistance: 120,
  },
};

// ---------------------------------------------------------------
// Audio bus levels. All values are 0..1.
// ---------------------------------------------------------------
interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  uiVolume: number;
  voiceVolume: number;
}

// ---------------------------------------------------------------
// Input remapping. Actions map to key codes (keyboard), gamepad
// button indices, or VR controller button identifiers.
// ---------------------------------------------------------------
type InputDevice = 'keyboard' | 'gamepad' | 'vr';

interface ActionBinding {
  action: string;        // e.g. "INTERACT", "OPEN_NOTEBOOK"
  keyboard: string;      // KeyboardEvent.code, e.g. "KeyE"
  gamepadButton: number; // standard gamepad button index, -1 = unbound
  vrButton: string;      // e.g. "trigger-right", "a-button", "grip-left"
}

// ---------------------------------------------------------------
// Accessibility settings
// ---------------------------------------------------------------
type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

interface AccessibilitySettings {
  colorblindMode: ColorblindMode;
  // Apply a post-processing LUT that shifts hues for the selected mode.
  // Species identification textures also pick an alternate high-contrast palette.

  reduceMotion: boolean;
  // When true: disables camera shake, disables Framer Motion spring physics
  // (uses tween instead), disables parallax effects, slows particle counts to 10%.

  subtitles: boolean;
  // Show text captions for any audio cues that carry scientific information
  // (species encounter callouts, weather change notices).

  fontScale: number; // 0.8 | 1.0 | 1.2 | 1.4 | 1.6
  // Scales all rem-based HUD text. Applied as a CSS custom property on the HUD root.

  highContrast: boolean;
  // Increases border weight, switches parchment backgrounds to white,
  // ink colors to black. Primarily for screen-reader users.

  screenReaderHints: boolean;
  // When true, all HUD components announce changes via aria-live regions.
  // DataReadout ticks are throttled to 1Hz to avoid spamming the announcer.
}

// ---------------------------------------------------------------
// Root settings object
// ---------------------------------------------------------------
interface Settings {
  graphics: GraphicsSettings;
  audio: AudioSettings;
  bindings: ActionBinding[];
  accessibility: AccessibilitySettings;
}

// ---------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------
const DEFAULT_SETTINGS: Settings = {
  graphics: { preset: 'medium', ...GRAPHICS_PRESETS.medium },
  audio: {
    masterVolume: 1.0,
    musicVolume: 0.7,
    ambienceVolume: 0.8,
    sfxVolume: 0.9,
    uiVolume: 0.8,
    voiceVolume: 1.0,
  },
  bindings: [
    { action: 'MOVE_FORWARD',    keyboard: 'KeyW',      gamepadButton: 12, vrButton: 'thumbstick-up' },
    { action: 'MOVE_BACK',       keyboard: 'KeyS',      gamepadButton: 13, vrButton: 'thumbstick-down' },
    { action: 'MOVE_LEFT',       keyboard: 'KeyA',      gamepadButton: 14, vrButton: 'thumbstick-left' },
    { action: 'MOVE_RIGHT',      keyboard: 'KeyD',      gamepadButton: 15, vrButton: 'thumbstick-right' },
    { action: 'INTERACT',        keyboard: 'KeyE',      gamepadButton: 0,  vrButton: 'trigger-right' },
    { action: 'INSPECT',         keyboard: 'KeyF',      gamepadButton: 2,  vrButton: 'grip-right' },
    { action: 'JUMP',            keyboard: 'Space',     gamepadButton: 1,  vrButton: 'a-button' },
    { action: 'CROUCH',          keyboard: 'ShiftLeft', gamepadButton: 8,  vrButton: 'thumbstick-press-right' },
    { action: 'OPEN_NOTEBOOK',   keyboard: 'KeyN',      gamepadButton: 3,  vrButton: 'b-button' },
    { action: 'PAUSE',           keyboard: 'Escape',    gamepadButton: 9,  vrButton: 'menu-button' },
    { action: 'SNAP_TURN_LEFT',  keyboard: 'KeyQ',      gamepadButton: 4,  vrButton: 'thumbstick-left-vr' },
    { action: 'SNAP_TURN_RIGHT', keyboard: 'KeyR',      gamepadButton: 5,  vrButton: 'thumbstick-right-vr' },
  ],
  accessibility: {
    colorblindMode: 'none',
    reduceMotion: false,
    subtitles: false,
    fontScale: 1.0,
    highContrast: false,
    screenReaderHints: false,
  },
};
```

### 4.1 Settings UI Layout

**Graphics tab:**
- Preset row: four buttons (Low / Medium / High / Ultra), styled as `filter-btn` from
  main.css. Active preset has `background: var(--forest); color: #fff`.
- Below the preset row: individual toggles for SSAO, Bloom, Depth of Field, plus a
  Render Scale slider and a Target FPS selector. Each shows its current value in Fira
  Code.
- When any individual toggle differs from the preset's value, a small "(custom)"
  indicator appears next to the preset name.

**Audio tab:**
- Six horizontal sliders (Master, Music, Ambience, SFX, UI, Voice), each with a Fira
  Code percentage readout. The Master bus slider visually scales the width of the other
  sliders to hint at the bus hierarchy.

**Controls tab:**
- Keybinding table: action name in Source Sans 3, current keyboard binding in a Fira
  Code chip that is click-to-rebind. Gamepad and VR bindings shown as smaller secondary
  chips.
- A "Reset to defaults" button at the bottom.

**Accessibility tab:**
- Colorblind mode: radio-button group.
- Reduce Motion, Subtitles, High Contrast, Screen Reader Hints: toggle switches.
- Font Scale: a five-step segmented control (80% / 100% / 120% / 140% / 160%) with
  a live preview sentence below it in the selected size.

---

## 5. Pause Behavior -- The Pause Contract

Every experiment must honor the following contract. This is not optional; it is
enforced by the engine at the `ExperimentModule` interface level.

### 5.1 What "Paused" Means

When the engine transitions the sim state to `'paused'`:

1. **Physics frozen.** The Rapier world's `step()` is no longer called. The tick loop
   continues to run (for HUD animation) but does not advance the simulation clock.
2. **Audio ducked.** The Howler master bus fades to 20% over 0.3s. Positional audio
   sources are paused. UI sounds still play at full volume.
3. **Scientific state preserved.** The entire simulation state as of the last tick is
   held in the Zustand `sim` slice. No mutation is permitted while paused. The save
   routine fires once immediately on pause entry.
4. **Input routed to the pause overlay.** The game input layer suspends action-map
   processing except for `PAUSE` (which resumes) and UI navigation actions.
5. **Particle systems freeze.** All Three.js particle system updates stop. The frame
   still renders (so the pause overlay composites over a frozen-but-visible scene).
6. **Time-dependent systems hold.** WeatherSystem, day/night cycle, and any other
   wall-clock-driven systems suspend their timers.

### 5.2 ExperimentModule Pause Interface

```typescript
interface ExperimentModule {
  // Called by the engine after physics stop, before the overlay renders.
  // Experiment must immediately return -- no async operations here.
  onPause(): void;

  // Called by the engine when the user chooses "Resume."
  // Audio un-ducts after this returns.
  onResume(): void;

  // Called when the user chooses "Restart" from the pause menu.
  // Must reset state to the config snapshot, clear notebook data, and
  // re-initialize the scene to start-of-session conditions.
  onRestart(): void;

  // Serialize all scientific state needed to recreate this exact moment.
  // The engine calls this on pause, on resume, and on every N-tick interval.
  getSaveState(): unknown;

  // Restore scientific state from a prior getSaveState() result.
  loadSaveState(state: unknown): void;
}
```

### 5.3 ESC Menu Hierarchy

```
Pause Overlay (ESC)
  |-- Resume                --> calls onResume(), dismisses overlay
  |-- Restart               --> confirmation dialog ("All unsaved data will be lost")
  |                              if confirmed: calls onRestart()
  |-- Settings              --> opens <SettingsMenu> over the pause overlay
  |     \-- Back            --> returns to pause overlay
  \-- Quit to Menu          --> navigates to the experiment landing page (index.html)
                                 save is written first
```

The confirmation dialog for Restart uses the same parchment card style as the pause
overlay. It is not a browser `confirm()` dialog.

---

## 6. Onboarding -- First-Launch Tutorial

### 6.1 Structure

The onboarding system shows a sequence of tooltip-style overlays on first launch. It
is stored in Zustand `onboarding.step` (0 = not started, 1-N = step index, -1 = completed
or skipped). The state is persisted to the global save so the tutorial does not replay
across sessions.

On first launch of any experiment, before the sim can be started, the onboarding
overlay renders. The student can skip it at any time with a "Skip tour" button. The
full tour is accessible later via Help Menu -> "Replay tour."

The onboarding overlay is NOT shown in VR. In VR the user encounters instrument labels
and world-space text panels that serve the same orientation function without interrupting
spatial presence. An audio cue ("Check the clipboard in your left hand to begin") covers
the gap.

### 6.2 First Three Tooltip Specifications

Each tooltip is a small parchment card connected to the target element by a subtle
caret. Framer Motion drives the fade-in and position animation (250ms ease-out). In
`reduceMotion` mode the animation is replaced with a simple opacity cut.

---

**Tooltip 1 of 3 -- "Your Equipment"**

Target element: the `<Clipboard>` component (or its DOM anchor).

Position: right of the clipboard, center-aligned vertically.

Copy:
> This is your survey clipboard. It shows your current field parameters -- the number
> of cover objects, your transect number, and today's weather conditions. Check it
> whenever you need to reorient.

Sub-copy (smaller, `--ink-faint`):
> You can also open it any time with the **N** key.

Dismiss button: "Got it" (`btn btn-primary btn-sm`).
Skip button: "Skip tour" (text link, `--ink-faint`).
Progress indicator: "1 of 3" in Fira Code, `--ink-faint`, bottom right of card.

---

**Tooltip 2 of 3 -- "The Transport Controls"**

Target element: `<TransportControls>` play button.

Position: above the transport strip, centered.

Copy:
> Press **Play** to start the simulation clock. Use **Step** to advance one generation
> at a time when you want to watch a specific transition unfold. **Reset** returns
> everything to your configured starting conditions.

Sub-copy:
> Speed controls how many generations per second the simulation advances. Slower speeds
> give you time to read the data as it changes.

Dismiss button: "Got it".
Skip button: "Skip tour".
Progress: "2 of 3".

---

**Tooltip 3 of 3 -- "Your Field Notebook"**

Target element: `<FieldNotebook>` header or the notebook toggle button.

Position: above the notebook panel.

Copy:
> Every animal you identify gets recorded here. The notebook autosaves as you work --
> if you close the browser, your entries will be here when you return. Download your
> data as a CSV file when you're ready to analyze.

Sub-copy:
> Your identifications are also tracked privately. After the survey, the analysis panel
> will show how accurately you distinguished mimics from models.

Dismiss button: "Start surveying" (`btn btn-primary btn-sm`). This button also starts
the simulation (calls `sim.resume()`).
Skip button: not shown on the final step (the dismiss button is the natural exit).
Progress: "3 of 3".

---

## 7. Telemetry -- Recommendation: Include, Opt-In Only, First-Party Only

### 7.1 Decision

Include a minimal opt-in telemetry system. The recommendation is not to include it by
default -- the consent prompt runs once, on first launch, as a one-line notice with a
checkbox. No consent = no data collected, ever. The default state of
`telemetryConsent` in a new global save is `null` (not yet asked), so the engine
knows to prompt once and never again.

### 7.2 Rationale

Borchard Labs is an educational platform. Knowing which experiments students complete,
where they drop off, and which milestones they reach has direct value for improving the
pedagogical design -- not for advertising. A well-designed consent flow does not
damage user trust; a poorly designed one does. Keep the consent UI transparent and
dismissible.

No third-party analytics library (Google Analytics, Mixpanel, PostHog, etc.) is
included at any point. All events are sent to a first-party endpoint -- if and when
a backend exists. Until a backend is built, collected events are batched in
IndexedDB via localforage and discarded after 30 days.

### 7.3 What Gets Collected (if consented)

Only:
- Session start (experiment slug, timestamp, browser feature flags -- no fingerprinting).
- Milestone events (milestone id, experiment slug, time-in-session).
- Experiment completion (experiment slug, total session duration, whether CSV was
  downloaded).
- Settings preset selected (graphics preset name only, no PII).

What is never collected:
- IP address beyond what the HTTP request inherently sends to the server (handle by
  dropping the IP in the server-side log parser before storage).
- Student identity, name, institution, or any PII.
- Individual simulation parameter choices.
- Raw notebook data or CSV content.

### 7.4 Implementation Notes

The consent prompt is shown during the onboarding flow, before tooltip 1. It is a
two-sentence explanation and a single checkbox: "Help us improve Borchard Labs by
sharing anonymous usage data. No personal information is collected." The checkbox is
unchecked by default.

If a backend is never built, the telemetry module is a no-op stub that compiles out.
Do not ship the consent prompt until there is an endpoint to receive the data.

---

## 8. Notification and Toast System

### 8.1 Categories

| Type | Trigger | Duration | Priority |
|---|---|---|---|
| Save indicator | Auto-save completes | 1.5s, fades out | Low |
| Discovery callout | New `DiscoveryEntry` written | 6s, dismissible | Medium |
| Badge pop | New `BadgeEntry` written | 4s, dismissible | Medium |
| Error notice | Save failed, migration discarded | Until dismissed | High |

### 8.2 Visual Specification

Toasts render as a vertical stack in the bottom-right corner of the viewport, with
the most recent at the bottom and older ones above.

Each toast:
- Background: `--parchment-warm`, 1px border `--border`, `border-radius: var(--radius)`,
  `box-shadow: var(--shadow-md)`.
- Left stripe: 4px solid `--forest` (discovery), `--gold` (badge), `--rust` (error),
  `--ink-faint` (save indicator).
- Title: Source Sans 3 600, 0.9rem, `--ink`.
- Body: Source Sans 3 400, 0.85rem, `--ink-light`.
- Dismiss X button: `--ink-faint`, 20x20px, top-right.

Save indicator is the minimal case: no body text, just a single line "Saved." with
the `--ink-faint` left stripe.

Framer Motion `AnimatePresence` drives the entry (slide up 8px + fade) and exit
(fade out, 0.2s). In `reduceMotion` mode: instant appear, instant disappear.

### 8.3 In VR

Toasts are suppressed during active VR sessions. The discovery and badge events are
queued in the Zustand `notifications.vr_queue` slice and presented as world-space
cards when the user opens the pause menu or exits VR. This preserves spatial presence.

The save indicator fires a single controller haptic pulse (50ms, light intensity) as
a substitute for the visual toast.

---

## 9. Localization Hook

### 9.1 Architecture Decision -- Defer But Architect Now

Full i18n is out of scope for Phase 2. However, all user-facing strings in HUD
components must be sourced from a central string table from day one. Adding i18n later
to a codebase where strings are scattered as JSX text literals is significantly more
expensive than building the hook correctly up front.

### 9.2 Where Strings Live

All user-facing strings (including onboarding copy, toast titles, badge descriptions,
and discovery notes) live in:

```
src/i18n/strings/en.ts   -- English (default, the only locale in Phase 2)
src/i18n/strings/es.ts   -- Spanish (stub, Phase 7 stretch)
```

Each locale file exports a flat object with dot-notation keys:

```typescript
// src/i18n/strings/en.ts
export const strings = {
  'hud.notebook.title': 'Field Notebook',
  'hud.notebook.entry.save': 'Save Entry',
  'hud.notebook.entry.cancel': 'Cancel',
  'hud.transport.play': 'Play',
  'hud.transport.pause': 'Pause',
  'hud.transport.step': 'Step',
  'hud.transport.reset': 'Reset',
  'hud.pause.resume': 'Resume',
  'hud.pause.restart': 'Restart',
  'hud.pause.settings': 'Settings',
  'hud.pause.quit': 'Quit to Menu',
  'onboarding.skip': 'Skip tour',
  'onboarding.next': 'Got it',
  'onboarding.tooltip1.title': 'Your Equipment',
  // ... etc
} as const;

export type StringKey = keyof typeof strings;
```

### 9.3 The `t()` Hook

```typescript
// src/i18n/useTranslation.ts
import { useSettingsStore } from '@/store/settings';
import { strings as en } from './strings/en';

const locales: Record<string, typeof en> = { en };

export function useTranslation() {
  const locale = useSettingsStore((s) => s.locale ?? 'en');
  const db = locales[locale] ?? en;

  function t(key: keyof typeof en, vars?: Record<string, string | number>): string {
    let str: string = db[key] ?? en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{{${k}}}`, String(v));
      }
    }
    return str;
  }

  return { t, locale };
}
```

Every HUD component calls `const { t } = useTranslation()` and references all copy
as `t('hud.notebook.title')`. JSX text literals for HUD strings are forbidden by
lint rule (`no-literal-string` or equivalent ESLint plugin) starting from Phase 2.

The `Settings` schema gains a `locale: string` field (default `'en'`) in Phase 7 when
a language selector is added to the Settings menu.

---

## 10. VR HUD Strategy

### 10.1 Core Rule -- HTML Overlay Does Not Exist in VR

The browser's HTML document is not composited into the WebXR frame. Any component that
is an HTML overlay on desktop must have an explicit VR strategy. The strategies are:

- **World-space via `@react-three/uikit`** -- for panels that need to stay readable
  and interactive in the 3D scene. uikit renders to a WebGL framebuffer using
  flexbox-like layout.
- **Suppress + queue** -- for notifications and transient overlays that would break
  spatial presence. These are held in a queue and shown on resume.
- **Pre-session only** -- for settings and onboarding. The user configures settings
  before entering VR; the Settings menu is not accessible mid-VR-session.
- **Scene-embedded** -- for elements that have a natural physical counterpart (the
  clipboard, the field notebook, the sample jar). These become 3D objects in the scene.

### 10.2 Per-Component VR Strategy

| Component | Desktop mode | VR strategy |
|---|---|---|
| `<FieldNotebook>` | HTML overlay panel | World-space `uikit` card at chest height |
| `<Clipboard>` | HTML overlay panel | Physical 3D mesh with canvas texture, grip-anchored |
| `<SampleJar>` | Corner overlay | 3D mesh child of R3F scene |
| `<DataReadout>` | Parchment strip below canvas | World-space `uikit` info card, lower FOV |
| `<TransportControls>` | Button strip | World-space `uikit` button panel (or wrist-mounted) |
| `<SettingsMenu>` | Full-screen overlay | Pre-session only. Inaccessible mid-VR. |
| `<PauseOverlay>` | Semi-transparent overlay | World-space `uikit` card, scene frozen |
| `<LoadingScreen>` | Full-screen overlay | 2D `uikit` plane in front of camera, pre-scene |
| `<ToastNotification>` | Bottom-right overlay | Suppressed; queued for post-session review |
| `<FieldJournal>` | Full-screen overlay | Pause menu only; not mid-experiment |
| `<OnboardingOverlay>` | Tooltip overlays | Skipped entirely; replaced by world-space labels |

### 10.3 `@react-three/uikit` Integration Notes

uikit provides a flexbox layout engine inside the R3F scene. Key integration points:

- Wrap world-space panels in `<Root>` with `pixelSize={0.001}` to convert pixel
  dimensions to world units (1000 CSS px = 1m).
- Text uses `@react-three/uikit` `<Text>` nodes. Font loading must be pre-loaded into
  uikit's font cache; the engine pre-loads Fira Code and Source Sans 3 subsets (Latin
  only) as SDF font atlases.
- Colors must be resolved from the CSS custom properties at mount time and passed as
  hex strings (uikit does not read CSS variables). A utility
  `resolveDesignToken(varName: string): string` reads from a singleton computed style
  at startup.
- Interactive uikit panels (the FieldNotebook entry form) require XR controller ray
  intersection. uikit handles this natively via its `<Root interactive>` prop when
  paired with `@react-three/xr`'s `RaycastTarget`.

### 10.4 What Falls Back to Non-VR

Anything with a `Pre-session only` or `Suppressed` strategy above effectively does
not exist inside the VR session. The student's workflow in VR must be self-contained
using only the world-space components. This means:

- The survey config must be set before entering VR, not mid-session.
- Settings changes require exiting VR.
- Notifications accumulate silently and are readable in the Field Journal after
  the session.
- Onboarding for VR is handled by a separate VR-specific orientation experience
  (three short audio cues + world-space arrow indicators, not HTML tooltips).

This is the correct tradeoff. Attempting to surface a full settings menu or a
multi-page onboarding flow inside a VR session would require significant custom
engineering for marginal gain. Keep VR focused on the experiment itself.

---

## Risks and Open Questions

**R1 -- localforage IndexedDB quota.** Browsers set per-origin storage quotas that
vary significantly (Firefox is generous, Safari is aggressive). If a student's save
grows large due to many notebook entries, the write may fail silently on Safari.
Mitigation: limit `pendingRows` in the experiment save to 500 rows (enforced by the
engine before writing). Above 500, prompt the student to download their CSV.

**R2 -- Save schema versioning discipline.** The migration pattern described in Section
1.3 works only if every developer increments the version constant before changing the
schema. A lint-time or test-time check should enforce this. Open question: write a
Vitest test that loads a fixture of the current schema, bumps the version constant, and
verifies the migration runs without throwing. This test should be required before any
PR that touches the save schema.

**R3 -- uikit maturity.** `@react-three/uikit` is relatively young (1.x as of this
writing). The layout engine is capable but has known gaps around text input widgets
and complex nested scroll containers. The FieldNotebook entry form in VR may require
custom input handling. Evaluate at the start of Phase 4B whether uikit's `Input`
component is usable or whether a custom radial/wheel input picker is needed for VR
categorical fields.

**R4 -- Colorblind mode for species ID.** The settings schema includes `colorblindMode`
and the system description references alternate high-contrast species textures. Those
alternate textures do not yet exist as art assets. This is a Phase 7 deliverable, but
the texture naming convention and material-swap infrastructure should be designed in
Phase 2 so the swap point is wired correctly even if the alternate textures are
placeholders.

**R5 -- Telemetry backend.** Section 7 recommends including the consent UI and
localforage event buffer, but deferring the backend endpoint. If the backend is never
built, the consent prompt should never appear. There must be a compile-time flag
(`VITE_TELEMETRY_ENABLED=false` by default) that suppresses the entire telemetry
subsystem. Shipping a consent prompt that collects nothing erodes trust for no benefit.

**R6 -- Anti-grind enforcement.** The anti-grind principles in Section 2.3 are
enforced by design review, not by code. Every milestone definition should include a
brief rationale comment explaining what the student actually witnessed (one sentence).
If the author cannot write that sentence, the milestone should not ship.

**R7 -- Framer Motion + R3F performance.** Framer Motion animates HTML DOM elements.
Inside an R3F scene, it has no awareness of the WebGL frame budget. Toast animations
and HUD reveal animations must be profiled at Phase 2C with `r3f-perf` to confirm
they do not cause frame drops. If they do, the animations are scaled back or replaced
with CSS transitions (which are also GPU-composited and cheap).

**R8 -- Field Journal content authorship.** Discovery notes (the scientific text that
appears when a milestone fires) require subject-matter review. They should read like
field notes written by a practicing biologist, not like a textbook definition. Budget
time for this review in Phase 5 and Phase 6 when the Hardy-Weinberg and Batesian
Mimicry milestones are finalized.
