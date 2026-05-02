# Borchard Labs Engine Design

**Status:** Phase 1 synthesis -- ratified for Phase 2 onward
**Date:** 2026-05-02
**Supersedes:** the seven Phase 0 research documents in `docs/research/`. Where this
document and a research doc disagree, this document wins.
**Audience:** every team that will implement Phase 2 through Phase 7.

This is the master design for the Borchard Labs runtime overhaul. It locks the stack,
the architecture, the contracts, and the budgets that every implementation team must
work against. Phase 0 explored the option space; Phase 1 closes it. After this point,
divergence requires an explicit amendment to this document, not a side conversation.

---

## 0. Reading Order

If you only have ten minutes: read sections 1, 2, 3.1-3.3, and 8.

Section index:

1. Final stack decision
2. Repository layout
3. Engine architecture
4. Rendering pipeline
5. Physics, character controller, interaction
6. Audio architecture
7. Asset pipeline
8. Performance contract
9. Migration plan -- Hardy-Weinberg and Batesian Mimicry
10. Roadmap for the remaining experiments
11. Phase boundaries and ratification gates
12. Open questions deferred to implementation

---

## 1. Final Stack Decision

### 1.1 Ratified stack

| Layer | Choice | Pin notes |
|---|---|---|
| Renderer core | Three.js | `^0.184.0`, do not jump major mid-phase |
| Declarative layer | React Three Fiber v9 | `^9.6.0` |
| R3F helpers | drei | `^10.7.0` |
| Physics | @react-three/rapier (wraps @dimforge/rapier3d-compat) | `^2.4.0` / `^0.18.0` |
| Postprocessing | postprocessing + @react-three/postprocessing | `^6.37.0` / `^3.0.0` |
| SSAO | n8ao | `^1.10.0`, fallback to bundled SSAO if it breaks |
| WebXR | @react-three/xr | `^6.6.0` |
| In-VR UI | @react-three/uikit | `^0.10.0` |
| Languages | TypeScript 5.6+ | strict mode, see section 2.3 |
| Build | Vite 7 LTS | not Vite 8 until pmndrs ecosystem certifies |
| UI framework | React 19 | required by R3F v9 |
| Styling | Tailwind 4 (CSS-first) | layered over existing design tokens, no rewrite of `assets/css/main.css` |
| State | Zustand | `^5.0.0` |
| ECS (optional) | Miniplex | `^2.0.0`, only loaded by labs that need it |
| Worker RPC | Comlink | `^4.4.2` |
| Persistence | localforage | `^1.10.0` |
| Validation | zod | `^3.23.0` |
| High-level audio | Howler.js | pinned to `2.2.4` (shared-context behaviour) |
| Spatial audio | three.js PositionalAudio | shared `AudioContext` with Howler |
| Procedural audio | Tone.js | lazy-loaded, gated per lab, default off |
| Animations | Framer Motion + GSAP | Framer for HUD reveals, GSAP for scripted cinematics |
| Tests | Vitest + Playwright | Vitest for math + save round trips, Playwright for end-to-end smokes |
| Lint / format | ESLint 9 flat config + Prettier 3 | `--max-warnings=0` |
| Dev visibility | r3f-perf, stats.js, leva | dev-only |
| Package manager | pnpm | install via corepack in `deploy.sh` if missing |
| Hosting | static `dist/` over rsync | preserves the existing `deploy.sh` flow |

### 1.2 Confirmed divergences from the prompt's starting list

- **Vite 7 LTS** instead of latest Vite 8. Reason: pmndrs stack has not certified against
  Rolldown/Oxc yet. Re-evaluate at the Phase 7 polish gate.
- **WebGL2** is the default renderer; **WebGPU is gated behind a settings toggle** and
  re-evaluates at the Phase 7 polish gate. WebGPU still has Safari and Quest browser gaps
  in Q2 2026.
- **AgX tone mapping** instead of ACESFilmic. Better organic colour rolloff for forest
  scenes, ratified by Phase 0 Agent 2. Per-lab override is allowed via a
  `<SceneLightingConfig>` wrapper (rare).
- **No SharedArrayBuffer in v1.** The science worker uses MessageChannel-only RPC via
  Comlink. This drops the COOP/COEP cross-origin isolation requirement and removes
  hosting risk for the foundation phases. Revisit only if a future lab proves it needs
  it.
- **Service worker / PWA** wired in `vite.config.ts` but `registerType: 'prompt'` and
  marked stretch. Do not auto-install during Phase 2 through Phase 6.
- **Telemetry** is fully suppressed by a compile-time flag (`VITE_TELEMETRY_ENABLED=false`)
  until a first-party backend exists. The consent prompt does not appear until then.
- **Determinism worker.** Both labs run scientific state in a Web Worker, regardless of
  whether they previously did. Hardy-Weinberg moves into a worker as part of the port.
- **Single-package repository, internal modules.** No pnpm workspace. Path aliases
  (`@engine`, `@labs`, `@ui`, `@assets`) are the seam. A future split is mechanical.

### 1.3 What is rejected

- Babylon.js, PlayCanvas, Unity WebGL, Unreal Pixel Streaming. Out of scope for the
  reasons in `docs/research/engine-architecture.md` section 1.
- TAA in Phase 2 through Phase 6. SMAA only. TAA is reserved for the ultra preset and
  ships in Phase 7 once foliage motion vectors are wired correctly.
- A monorepo, a separate engine package, or any cross-package versioning surface. We
  have one consumer of this engine (the public site) and one team. Splitting later is
  cheaper than maintaining a workspace that buys nothing today.

### 1.4 The bar this stack must hit

The litmus is the same as in the prompt: a student opening any lab page should think
"wait, this runs in a browser?" The visual reference is the Phase 0 Agent 2 reference
shots (Firewatch morning forest, Three.js Journey haunted house lighting discipline,
Subnautica god-ray and emissive bloom usage). The interaction reference is Outer Wilds
and Subnautica's diegetic-first HUD. The audio reference is Subnautica's biome
ambience crossfading.

If at any phase boundary the build does not move closer to that bar, the team flags it
in code review and the next phase pauses until the gap is closed. The visual benchmark
checkpoint at the end of Phase 3 is the first hard gate.

---

## 2. Repository Layout

### 2.1 The shape

The repo keeps the existing static field-notebook pages exactly where they live, and
mounts a Vite-built TypeScript application into each experiment page as an island.
This preserves SEO, the resources/publications/about pages, and the reading-room
design without coupling them to React mounting cycles.

```
borchard-labs/
  AGENTS.md
  README.md
  ENGINE-DESIGN.md                # this document
  CHANGELOG.md                    # added in Phase 2
  deploy.sh
  package.json
  pnpm-lock.yaml
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  eslint.config.js
  .prettierrc

  index.html                      # static site landing -- preserved
  about/                          # preserved
  publications/                   # preserved
  resources/                      # preserved
  experiments/                    # static landing pages -- preserved
    hardy-weinberg/index.html
    batesian-mimicry/index.html
    ...
  assets/css/main.css             # design tokens -- preserved, never rewritten

  src/                            # everything Vite owns
    main.tsx                      # mounts the lab host into <div id="lab-root">
    bootstrap/
      LabBootstrap.tsx
      ErrorBoundary.tsx
    engine/
      runtime/
        LabHost.tsx               # Canvas, Suspense boundary, dispose lifecycle
        loadLabModule.ts          # dynamic import + asset prefetch
        ResourceTracker.ts        # lifecycle disposal accounting
        physicsContext.ts         # one Rapier world per host
        scienceWorker.ts          # generic worker shell, the lab loads in
        comlink.ts                # typed RPC wrappers
      state/
        gameStore.ts              # Zustand root + slice composition
        settingsSlice.ts
        notebookSlice.ts
        progressionSlice.ts       # discoveries + badges
        saveStore.ts              # localforage adapter + zod migration
      input/
        actionMap.ts
        sources/
          keyboardMouse.ts
          gamepad.ts
          touch.ts
          xr.ts
        useAction.ts
        rebindStore.ts
      audio/
        AudioBuses.ts             # Howler + spatial bridge, ducking, captions
        useAudioSource.ts
        AdaptiveAudioProfile.ts   # per-lab adaptive audio interface
        CaptionSystem.ts
      assets/
        AssetManager.ts
        loaders.ts                # GLTF/Draco/Meshopt/KTX2/Audio
        manifest.ts
        LoadQueue.ts              # priority queue
      render/
        Renderer.tsx              # Canvas wrapper, tone mapping, color space
        PostChain.tsx             # SSAO, bloom, DOF, vignette, LUT, SMAA
        presets.ts                # quality presets
        materials/                # shared PBR library
          forestFloor.ts
          bark.ts
          rock.ts
          water.ts
          parchment.ts
          ...
        env/
          Sky.tsx
          Hdri.tsx
          Vegetation.tsx
          Fog.tsx
          GodRays.tsx
        atmospherics/
          DustMotes.tsx
          MistSprites.tsx
      physics/
        RapierProvider.tsx
        FirstPersonController.tsx
        ThirdPersonCamera.tsx
        Interaction/
          GrabSystem.tsx
          HoverHighlight.ts       # rim-light onBeforeCompile injection
          CollisionAudio.ts
      xr/
        XrProvider.tsx
        TeleportSystem.tsx
        HandTracking.tsx
      hud/
        HudPanel.tsx
        DataReadout.tsx
        TransportControls.tsx
        FieldNotebookFrame.tsx
        SettingsMenu.tsx
        PauseOverlay.tsx
        LoadingScreen.tsx
        ToastNotification.tsx
        FieldJournal.tsx
        OnboardingOverlay.tsx
        HelpMenu.tsx
        vr/                       # uikit variants
          FieldNotebookFrame.vr.tsx
          DataReadout.vr.tsx
          ...
      i18n/
        useTranslation.ts
        strings/
          en.ts                   # only locale shipped through Phase 6
      types/
        lab.ts                    # the contract every lab implements
        publicState.ts            # per-lab discriminated unions
      utils/
        prng.ts                   # mulberry32 + xoshiro fallback
        time.ts
        math.ts
        csv.ts                    # RFC 4180, single source of truth
        formatNumber.ts

    labs/
      _template/                  # scaffold a new lab from this
        index.ts
        Lab.ts
        Scene.tsx
        Hud.tsx
        worker.ts
        manifest.ts
        save.ts
        config.ts
        adaptiveAudio.ts
        __tests__/
          determinism.test.ts
      hardy-weinberg/
        ...same shape as _template
        goldens/                  # CSV snapshots per seed
      batesian-mimicry/
        ...same shape
        research/                 # the eleven research documents move here
        goldens/

    ui/                           # React UI not bound to R3F
      site/
      forms/
      icons/

    assets/                       # bundled assets, hashed
      hdri/
      luts/
      shaders/
      textures/                   # only small UI textures live here

  public/                         # large static assets, not hashed
    libs/
      draco/                      # Draco WASM + JS
      basis/                      # Basis transcoder WASM
    labs/
      hardy-weinberg/
        models/
        audio/
      batesian-mimicry/
        models/
        textures/                 # KTX2 PBR sets
        audio/
        captions/

  scripts/
    perf-gate.ts                  # CI perf gate
    capture-goldens.ts            # legacy fixture capture for determinism

  tests/
    e2e/                          # Playwright

  docs/
    ENGINE-DESIGN.md              # this document (also at repo root)
    determinism.md                # added in Phase 2
    research/                     # the seven Phase 0 docs
```

The static `experiments/<slug>/index.html` pages each include a `<script type="module"
src="/src/main.tsx">` style entry that mounts the lab into `<div id="lab-root">`. The
URL slug drives the lab id; no router is needed inside Phase 2 through Phase 6.

### 2.2 `package.json` skeleton

The full pin list lives in `docs/research/engine-architecture.md` section 5 and is
authoritative for Phase 2 scaffolding. Scripts:

```jsonc
{
  "scripts": {
    "dev":          "vite",
    "build":        "tsc -b && vite build",
    "preview":      "vite preview --port 4173",
    "test":         "vitest run",
    "test:watch":   "vitest",
    "test:e2e":     "playwright test",
    "test:determinism": "vitest run --dir src/labs --testNamePattern determinism",
    "lint":         "eslint . --max-warnings=0",
    "format":       "prettier --write .",
    "typecheck":    "tsc -b --noEmit",
    "perf:gate":    "tsx scripts/perf-gate.ts",
    "deploy":       "pnpm build && ./deploy.sh"
  }
}
```

### 2.3 TypeScript posture

The project ships with strict mode plus the following extra strictness flags. They
raise the cost of writing code, on purpose. Every lab inherits them.

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true
}
```

Tests, plans, and golden fixture scripts are exempt from `noUnusedParameters` only
where Vitest's API forces unused destructured callbacks.

### 2.4 Build configuration

`vite.config.ts` is the version in `docs/research/engine-architecture.md` section 5.4
with two amendments:

1. The `Cross-Origin-*` headers are not enabled by default. They are commented in,
   tagged "uncomment when SharedArrayBuffer becomes a requirement." Until then we keep
   the deploy story simple.
2. `vite-plugin-pwa` is included but `registerType: 'prompt'` and the registration
   call is gated behind a `VITE_PWA_ENABLED=false` env flag. Phase 7 ratifies turning
   it on.

### 2.5 Deploy

`deploy.sh` becomes the wrapper described in `docs/research/engine-architecture.md`
section 7. The static field-notebook pages are copied into `dist/` during `vite build`
via a `vite-plugin-static-copy` step. The upload is a single `rsync dist/`. Cache
headers are configured server-side and live in `docs/deploy.md` (added in Phase 2).

---

## 3. Engine Architecture

### 3.1 The Lab contract

Every experiment is a `Lab` plus a `LabModule` wrapper. The engine knows nothing about
biology; the lab knows nothing about the renderer, physics, or save serialization
format. The contract is the one specified in `docs/research/engine-architecture.md`
section 2 and is reproduced here verbatim because it is normative.

```ts
// src/engine/types/lab.ts

import type { Group } from 'three';
import type { World as RapierWorld } from '@dimforge/rapier3d-compat';
import type { ZodSchema } from 'zod';
import type { GameStore, AssetManifest } from '../runtime';

export interface LabContext {
  seed: number;
  sceneRoot: Group;
  physics: RapierWorld;
  store: GameStore;
  assets: AssetManifest;
  log: (level: 'info' | 'warn' | 'error', msg: string, data?: unknown) => void;
  now: () => number;
}

export interface Lab<Save extends object = object> {
  readonly id: string;          // kebab-case, drives slug + save key + asset folder
  readonly title: string;
  readonly version: string;     // determinism contract; bump invalidates saves and goldens
  readonly saveSchema: ZodSchema<Save>;

  init(ctx: LabContext): Promise<void>;
  tick(dtTicks: number, ctx: LabContext): void;       // determinism boundary
  frame(dtSeconds: number, alpha: number, ctx: LabContext): void; // visual interpolation
  dispose(): Promise<void>;                            // idempotent

  getSaveState(): Save;
  loadSaveState(save: Save): void;
}

export interface LabModule<Save extends object = object, P = Record<string, never>> {
  lab: Lab<Save>;
  Scene: (props: P) => JSX.Element;
  HUD?: (props: P) => JSX.Element;
  AdaptiveAudio?: AdaptiveAudioProfile;
}
```

The two-step design (`tick` for science, `frame` for visuals) is the Glenn Fiedler
"Fix Your Timestep" pattern. CSV outputs come from `tick()` only. The renderer
interpolates between the last two ticks by an `alpha` factor in the (0, 1) range.

### 3.2 Where state lives

Two stores. They never share an address. They synchronize through a typed event
boundary.

**Layer 1 -- Scientific state (authoritative, deterministic)**

Lives in a Web Worker per lab. The worker holds the seeded PRNG, all population /
environment / event state, the `tick(dt)` step, and the CSV row buffer. The worker
exposes `STEP`, `RESET`, `LOAD_SAVE`, `DUMP_SAVE`, `EXPORT_CSV` messages and emits
`TICK_COMMITTED` deltas. Comlink wraps the RPC.

**Layer 2 -- Visual / UI state (Zustand on the main thread)**

Holds transport state, hovered object id, current public state delta, settings,
notebook, progression, save slot metadata. Subscribes to `TICK_COMMITTED` events and
forwards public-state deltas into a per-lab slice.

**Sync rule**

Worker -> main thread is one-way under normal play. The main thread sends control
messages (`STEP`, `SET_PARAMS`, `RESET`); the worker emits deltas. The visual layer
never writes back into science state mid-tick. This is the contract that makes CSV
outputs reproducible.

### 3.3 Scene management

We mount one lab at a time. Each static experiment HTML page mounts its own
`LabHost`. There is no in-experiment-to-in-experiment navigation in v1; that is a
Phase 7 stretch.

The `LabHost` lifecycle:

1. Resolve the dynamic import for the lab module.
2. Build a `LabContext` (scene root group, Rapier world, store slice, asset manifest).
3. Call `lab.init(ctx)`. Suspend until critical assets (Tier 1, see section 7) are
   uploaded.
4. Mount `<Canvas>` and the lab's `Scene` plus `HUD` components.
5. On unmount, call `lab.dispose()`, walk the `ResourceTracker` and free all GPU
   handles in reverse order, drop the Rapier world, disconnect audio sources,
   terminate the worker.

GPU resource leaks are the single most common bug class in long-lived WebGL tabs. We
treat the `ResourceTracker` as a hard contract: every `BufferGeometry`, `Material`,
`Texture`, audio buffer, and Rapier handle is tagged at allocation, freed at
disposal.

### 3.4 Tick loop

There are two clocks per lab.

| Clock | Source | Drives |
|---|---|---|
| Sim clock | Worker fixed-step accumulator | `lab.tick()` -- science state, CSV rows |
| Render clock | R3F `useFrame` (RAF) | `lab.frame()` -- visual interpolation, audio scheduling, HUD |

The default sim tick rate is per-lab. Hardy-Weinberg defaults to 4 ticks/sec (one
generation per 250 ms at speed 1.0). Batesian Mimicry is event-driven: the worker
ticks whenever an encounter must be resolved, not on a wall clock.

**Pause semantics**

When transport state is `paused`:

- The worker stops accepting `STEP` messages. The accumulator does not advance.
- Rapier `world.step()` is skipped.
- Audio buses duck (master fades to 20% over 0.3 s, ambience pauses, UI sounds
  unaffected).
- Particle systems freeze. The render frame still composites so the pause overlay
  draws over a frozen-but-visible scene.
- Wall-clock-driven systems (WeatherSystem, day/night) suspend their timers.
- The save routine fires once on pause entry.
- Input action map suspends except for `PAUSE` (resumes) and UI navigation actions.

This is enforced by the engine, not by lab authors. Labs implement `onPause()` /
`onResume()` to flush any per-lab transient state, but the global pause is engine-owned.

### 3.5 Save / load

Two file types.

| File | Key pattern | Owner | Lifetime |
|---|---|---|---|
| Global | `save:global` | Engine | Cross-lab progression, settings, telemetry consent flag |
| Per-lab | `save:lab:<id>` | Engine writes, lab provides payload | Resume mid-run, config snapshot, in-progress notebook rows |

Each file carries an integer `version`. Migrations are switch-case ladders -- standard
up-migration -- gated by zod validation. If a migration fails or the save is from a
future version, the engine discards the file and surfaces a "could not resume,
starting fresh" toast. It never throws into the user's lap.

Per-lab save schema validation:

- Zod schema lives in `src/labs/<id>/save.ts`.
- The engine round-trips the payload through `JSON.stringify` and `JSON.parse` before
  writing, so any cycles or non-serializable values fail fast in dev.
- The save routine fires on transport transitions, on pause entry, on lab dispose,
  and at most once per N seconds (debounced by 2 s) during sustained running.
- The save payload includes the worker's RNG state (mulberry32 = one 32-bit integer)
  so resume produces a byte-identical event stream.

`pendingRows` (notebook rows) cap at 500 entries per save to stay under Safari's
IndexedDB quota. Above 500 the engine prompts for a CSV download and clears the
buffer.

### 3.6 HUD framework

HUD components are React, styled with Tailwind 4 utilities layered over the existing
design tokens in `assets/css/main.css`. The token map is in
`docs/research/game-systems.md` section 3.2 and is normative.

Diegetic-first principle: when a component has a believable physical metaphor
(clipboard, notebook, sample jar) it gets one. When it does not (transport controls
on a population genetics simulation), it falls back to the existing `sim-hud` parchment
idiom -- still consistent with the world, just not spatially embedded in it.

VR variants: every component in section 3 of `docs/research/game-systems.md` table 3.3
either renders inside `@react-three/uikit`, becomes a 3D mesh in the scene
(clipboard, sample jar), or is suppressed and queued. The mapping is normative.

A lint rule (`no-literal-string` or equivalent) forbids JSX string literals in HUD
components from Phase 2 onward. Every visible string lives in `src/engine/i18n/strings/en.ts`.

### 3.7 Settings

The settings store is the schema in `docs/research/game-systems.md` section 4.
Persisted into `save:global` under `globalSettingsOverride`. Defaults are the
`DEFAULT_SETTINGS` constant.

Three named graphics presets (Low / Medium / High / Ultra) drive the renderer. The
preset table is in section 4 of this document. Individual toggles can override a
preset; when they do, the preset name displays "(custom)".

Audio bus levels: master, music, ambience, sfx, ui, voice, spatial. All 0..1.
`muteOnTabBlur` defaults true. `duckOnNotebookOpen` defaults true at 0.3.

Accessibility flags: `colorblindMode`, `reduceMotion` (defaults to the OS
`prefers-reduced-motion` value), `subtitles`, `fontScale`, `highContrast`,
`screenReaderHints`, `oneHanded`, `crouchToggle`, `runToggle`, `interactHold`. Each
flag has a single owning subsystem listed in section 11 of
`docs/research/interaction-system.md`.

### 3.8 Input

Single unified action map. Every input source (keyboard + mouse, gamepad, touch, VR
controllers, hand tracking) writes into the same `ActionMap` slice each frame. The
gameplay layer never queries raw input devices.

The full schema is in `docs/research/interaction-system.md` sections 8-9. Normative
points:

- Default bindings live in `src/engine/input/actionMap.ts`.
- Rebinds live in `src/engine/input/rebindStore.ts`, persisted under
  `save:global -> globalSettingsOverride.bindings`.
- The input system runs in a `useFrame` at priority `-100` so it resolves before any
  gameplay consumer.
- `justPressed` / `justReleased` are emitted via a thin event bus alongside the
  Zustand state writes; consumers that need one-shot semantics subscribe to the bus
  to avoid React re-render churn at 90+ Hz.
- Touch and VR bindings are fixed in v1; rebind UI covers keyboard and gamepad only.
  Filed as a known accessibility gap (issue tag `[ui][accessibility]`) for Phase 7.

### 3.9 Progression

Per-lab `Milestone[]` definitions evaluate after every committed tick. A milestone
fires at most once per save; once fired, its key lands in `firedMilestones`. Two
output types:

- `DiscoveryEntry` (a field-journal page, written in first-person voice, carries
  scientific content)
- `BadgeEntry` (a stamp, listed under Certifications)

Anti-grind discipline (normative):

1. One milestone per meaningful event, never per repetition.
2. Discovery notes must teach something the student just witnessed.
3. Nothing is gated behind progression.

Milestone copy must be reviewed by a domain expert before each lab ships. Discovery
notes that read like textbook definitions get sent back.

---

## 4. Rendering Pipeline

### 4.1 Renderer

WebGL2. `WebGLRenderer` configured per `docs/research/rendering-pipeline.md` section
1.1. Pixel ratio capped at 2 by default; Ultra preset uncaps. AA disabled at the
renderer level (SMAA owns it in post). `outputColorSpace = THREE.LinearSRGBColorSpace`
because the post composer writes the final sRGB conversion. `toneMapping =
THREE.NoToneMapping` because tone mapping lives in the post chain. This is a known
silent bug class -- documented prominently in the renderer module header.

WebGPU is detected at startup and offered as a settings toggle marked "experimental".
It does not ship as default until pmndrs/postprocessing parity is reached.

### 4.2 Lighting

- Directional sun (`#FFF5E0` warm white, intensity 3.5 fair weather).
- Hemisphere fill (`#B4C8D8` sky, `#6B5B47` ground, intensity 0.6).
- HDRI environment via `PMREMGenerator` for diffuse irradiance and specular
  reflections.
- Sky shader (`three-stdlib` `Sky`) renders the visible dome; HDRI does not paint
  the background.
- Cascaded shadow maps via `three-csm` (or `three-stdlib` CSM, whichever is more
  maintained at Phase 3 ratification): 3 cascades on High, 2 on Medium, 1 on Low.
  Cascade distances tuned per scene.
- Contact shadows (drei `<ContactShadows>`) under interactive objects.
- Ambient occlusion is N8AO in post (section 4.3).

PBR discipline: metalness is 0 for organic / wood / rock surfaces and 1 for bare
metal. No intermediate values on non-metals. Roughness is texture-driven, not a flat
scalar. `normalScale` defaults 1, dialled to 0.5-0.8 on wet surfaces. Emissive only
for bioluminescence, UI, fireflies. Double-sided only on alpha-tested foliage.

### 4.3 Post-processing chain

Order is normative. Effects render left to right:

```
RenderPass
  -> N8AOPass                       (linear-space, separate pass)
  -> EffectPass [
       BloomEffect,
       DepthOfFieldEffect,          (off / examination / always per preset)
       VignetteEffect,
       ChromaticAberrationEffect,   (Medium and below: off)
       LUTEffect,
       ToneMappingEffect (AgX),
       SMAAEffect
     ]
```

Parameters live in `src/engine/render/PostChain.tsx`. Defaults match
`docs/research/rendering-pipeline.md` section 3.

GodRays is its own `EffectPass`, gated behind sun-occlusion ray test (smoothed over a
4-frame rolling average). High and Ultra preset only.

### 4.4 Materials library

`src/engine/render/materials/` exports named PBR factories. Labs import named
materials; no inline `new MeshStandardMaterial` is allowed in lab code. The 16
materials in `docs/research/rendering-pipeline.md` section 5 are the v1 catalogue.

Texture set conventions:

- Albedo: `THREE.SRGBColorSpace`.
- Normal / roughness / AO / ORM: `THREE.LinearSRGBColorSpace` (KTX2 sets this from
  metadata).
- Tile via `THREE.RepeatWrapping` with anisotropy 16 by default.
- Channel-pack to ORM (R = AO, G = roughness, B = metalness, A = optional height) to
  cut binds from 4 maps to 2.

### 4.5 Atmospherics

- Exponential height fog (`FogExp2`), density tied to weather state.
- Mist sprites (low-lying, billboarded, 30-50 instances) on ground near streams.
- Dust motes (`Points` with custom shader) in sun shafts. High and Ultra only.
- Volumetric god rays via `GodRaysEffect`. High and Ultra only, sun occlusion gated.

### 4.6 Vegetation

- All repeated geometry uses `InstancedMesh`.
- Wind shader injected via `material.onBeforeCompile` on bark and foliage materials.
  Driven by `uTime` and `uWindStrength`. Off on Low.
- Alpha-tested foliage (`alphaTest: 0.5`, `depthWrite: true`) with
  `customDepthMaterial` so shadow casts respect the alpha.

### 4.7 Water

Stream and pond materials are `MeshPhysicalMaterial` with `transmission`. Flow map
on Medium and above. Three-stdlib `Water` object on Ultra only. VR water is flat
`MeshStandardMaterial` with a flow-mapped normal -- transmission is too expensive on
Quest 3.

### 4.8 Quality presets

The preset table is normative. Source: `docs/research/rendering-pipeline.md` section
10. Lives at `src/engine/render/presets.ts`.

| Feature | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Shadow cascades | 1 | 2 | 3 | 3 |
| Shadow map size | 512 | 1024 | 2048 | 4096 |
| SSAO (N8AO) | off | half-res x8 | full x16 | full x32 |
| Bloom | off | on | on | on |
| Depth of field | off | off | examination only | always |
| Vignette | on | on | on | on |
| Chromatic aberration | off | off | subtle | on |
| God rays | off | off | on | on |
| LUT colour grade | off | on | on | on |
| SMAA | LOW | MEDIUM | HIGH | HIGH (TAA static-region in P7+) |
| Foliage wind shader | off | on | on | on |
| Foliage instance count | 50 | 150 | 300 | 500 |
| Mist sprites | 0 | 10 | 30 | 50 |
| Dust motes | 0 | 0 | 250 | 500 |
| Water | flat | flow map | flow + env | Water object |
| Sky | gradient | Sky shader | Sky shader | Sky + HDRI |
| Texture max | 512 | 1024 | 2048 | 4096 |
| Pixel ratio cap | 1.0 | 1.5 | 2.0 | uncapped |

Presets are applied by rebuilding the EffectComposer pass list and updating renderer
parameters. No page reload required. The settings UI shows `(custom)` next to the
preset name when any toggle differs.

### 4.9 Visual benchmark

End of Phase 3 has a hard gate: render the "demo cove" scene (a representative slice
of the Batesian Mimicry forest using every system at once) and compare side by side
to the three reference shots in `docs/research/rendering-pipeline.md` section 9. If
mood and quality do not match, Phase 3 iterates before Phase 4 begins.

---

## 5. Physics, Character Controller, Interaction

### 5.1 Rapier setup

One `<Physics>` provider per `LabHost`. Default `gravity={[0, -9.81, 0]}` and
`timeStep="vary"` for pure-render labs, `timeStep={1/60}` for any lab whose physics
needs cross-machine determinism. Hardy-Weinberg has no physics. Batesian Mimicry uses
`timeStep="vary"` because the deterministic CSV output comes from the worker, not
from the cover-object physics.

Body types per use case match `docs/research/interaction-system.md` section 1.2.
Player capsule is always `kinematicPosition`. Cover objects switch between `dynamic`
and `kinematicPosition` during the grab lifecycle (section 5.4).

Trimesh / Heightfield colliders for terrain (concave; fixed bodies only). Sensors
fire `onIntersectionEnter` / `onIntersectionExit` for approach zones, habitat
boundaries, VR teleport landing zones.

Joints (revolute, fixed, spherical, prismatic) available for hinged props (a board
that swings rather than translates). Phase 4 uses revolute on at least one cover
object as a tactile reference.

### 5.2 First-person controller

Built on Rapier's `KinematicCharacterController`. The capsule is the physics body;
the camera is a child Object3D at eye height. Yaw on the capsule, pitch on the
camera (clamped +-85 degrees).

| State | Speed | Notes |
|---|---|---|
| Walk | 4.0 m/s | default |
| Run | 8.0 m/s | sprint, FOV punch, head bob amplitude up |
| Crouch | 1.8 m/s | capsule halfHeight 0.3 |
| Jump | 5.5 m/s initial vertical | grounded check via `characterController.computedGrounded()` |

Head bob: sinusoidal vertical + lateral on the camera local position only. Footstep
audio fires at the downward zero-crossing of vertical bob. Disabled when
`accessibility.reduceMotion`.

FOV punch on sprint: ease 70 -> 78 over 200 ms; release ease back over 400 ms.
Disabled when `reduceMotion`.

Camera shake via a `trauma` value (0..1, decays at 2/s). Max +-0.05 m position,
+-3 deg rotation. Disabled when `reduceMotion`.

Interpolation: when the physics step rate diverges from the render rate (90 Hz
monitor, VR), the controller manually interpolates the rendered position between
physics steps. This is implementation-required, not optional. R-04 / risk #4 in
`docs/research/interaction-system.md` calls this out.

Third-person spring-arm camera is available as an opt-in toggle for "observer"
labs, with collision-aware arm length lerp. Not the primary mode in Phase 5 or 6.

### 5.3 Interaction system

Lifecycle: `hover -> grab -> hold -> release -> impact`.

- Hover: camera-centre raycast (or VR controller-tip raycast) per frame against
  interactables. Rim-light shader injected via `material.onBeforeCompile` on hover
  enter, removed on hover exit. Highlight intensity lerps over 100 ms.
- Grab: INTERACT action triggered. Body type switches `dynamic -> kinematicPosition`.
  Hold socket = fixed offset in camera space. Each frame the kinematic body's next
  position lerps toward the socket at a per-mass damping factor (heavier objects
  feel sluggish).
- Hold: angular orientation follows camera look direction for objects meant to be
  examined.
- Release: body type switches back to `dynamic`. Linear velocity = camera estimated
  velocity * `throwMultiplier`. Angular velocity zeroed.
- Impact: `onCollisionEnter` reads relative velocity; if `> impactThreshold` (~0.3
  m/s), emit a `CollisionAudioEvent` tagged with both bodies' material tags and
  trigger controller haptic.

Per-prop mass / damping / throw multiplier table is in
`docs/research/interaction-system.md` section 4.3 and is the authoritative tuning
sheet.

### 5.4 Input layer

The action map type is the one in `docs/research/interaction-system.md` section 8.
Implementation lives at `src/engine/input/`. Each source is a separate file under
`src/engine/input/sources/` so adding or replacing a source touches one file.

Touch joystick is a fixed-position overlay (lower-left or lower-right under
`oneHanded`). The overlay calls `event.stopPropagation()` on its touch events so
they do not reach the R3F raycaster (risk #5 in the research doc).

Gamepad standard mapping is the table in section 5.1 of the research doc. Default
sensitivity 120 deg/s at full deflection, square aim curve.

Settings-driven rebind covers keyboard + gamepad in v1. Touch and VR remain fixed.
This is documented as an accessibility gap in the Phase 7 backlog.

### 5.5 VR

`@react-three/xr` v6. The Enter VR button only renders when
`useXRSessionModeSupported('immersive-vr')` returns true. Locomotion defaults to
teleport with snap-turn (45 deg, configurable to 30 / 60). Smooth locomotion is an
opt-in accessibility toggle.

Hand tracking: when available, pinch replaces trigger and palm-up serves as an
alternate grab. Hand tracking joint positions arrive ~1 frame later than controller
input -- in hand-tracking mode, held objects bypass the kinematic body and attach
their transform directly to the hand joint to avoid lag (risk #1 in the research
doc). Physics resumes on release.

VR HUD strategy follows section 10 of `docs/research/game-systems.md`: HTML overlays
do not exist in VR. World-space components use `@react-three/uikit`. Pre-session-only
components (Settings, Onboarding) are not reachable mid-VR. Notifications queue
silently and surface on session end.

### 5.6 Collision audio and haptics

Collision audio is dispatched by the interaction system, consumed by the audio
system. The event payload is `Readonly<CollisionAudioEvent>` -- audio cannot mutate
simulation state (section 6.6). Material tags on rigid bodies are required:
`'rock' | 'wood' | 'soil' | 'bark' | 'leaf' | 'water' | 'metal' | 'generic'`.

Haptic table is in section 10.2 of the research doc. In VR, haptics use the XR
session's input-source `hapticActuators` array. Both keep the same event vocabulary.

---

## 6. Audio Architecture

### 6.1 Two-layer pipeline

- **Howler.js** owns non-positional audio: music, ambience beds, UI, voice.
- **three.js PositionalAudio** owns in-world point sources where direction and
  distance carry meaning.

Decision rule: if the perceived direction or distance of a sound carries information,
PositionalAudio. Otherwise, Howler. When unsure, Howler.

Both libraries share a single `AudioContext`. Howler is pinned to `2.2.4` because
the shared-context pattern depends on `Howler._audioContext` being assignable before
the first Howl is created. Risk #4 in the research doc; mitigated by the version pin
and a try/catch fallback that downgrades to separate contexts with a logged warning.

### 6.2 Bus graph

Six buses, all `GainNode`, all feeding a master `GainNode` to `ctx.destination`:
master -> { music, ambience, sfx, ui, voice, spatial }. The "spatial" bus is wired
between the Three.js `AudioListener` destination and the master, intercepting the
default direct connection.

Per-bus volume comes from the settings store. Updates use
`gainNode.gain.setTargetAtTime(value, ctx.currentTime, 0.05)` to avoid clicks.

Ducking: opening the field notebook ramps ambience + sfx + spatial to 30% over 0.3
s, restores over 0.5 s. Music and voice are never ducked.

Mute on tab blur: `visibilitychange` ramps master to 0 over 0.2 s; restore on
return. Toggle `audio.muteOnTabBlur` (default on).

### 6.3 Adaptive audio

Each lab implements an `AdaptiveAudioProfile`:

```ts
export interface AdaptiveAudioProfile {
  states: string[];                             // FSM states, lab-defined
  zones: string[];                              // spatial FSM, lab-defined
  resolveState(world: AdaptiveAudioContext): string;
  resolveZone(world: AdaptiveAudioContext): string;
  layers: Record<string, LayerSource>;          // layerId -> Howl source descriptor
  matrix: Record<string, Record<string, LayerGains>>;  // [state][zone] -> layerId -> gain
}
```

Crossfades default to 4000 ms for state transitions and 2000 ms for zone
transitions. The Batesian Mimicry profile is the canonical example
(`docs/research/audio-architecture.md` section 3). Hardy-Weinberg may use a simpler
parameter-driven profile or none at all.

The `AdaptiveAudioManager` polls profiles once per second, reads only -- it never
writes to simulation state.

### 6.4 Spatial audio and HRTF

Set `panner.panningModel = 'HRTF'` on every PositionalAudio. Safari falls back to
`equalpower` silently. Mixes must be directionally legible at both qualities. Risk
#1 in the research doc.

Optional `ConvolverNode` with a short (~0.5 s) IR, shared across all spatial sources
through the spatial bus. Per-source convolution is too expensive in a browser frame.
On VR, IR cap is 0.4-0.6 s to avoid HRTF smearing.

Resonance Audio is a Phase 7 evaluation if VR audio quality becomes a differentiator;
not adopted in v1.

### 6.5 Audio formats and sourcing

Opus in OGG container is the primary format. AAC fallback in M4A only when needed
(Howler picks per-browser via the `format` array). Music tracks 96 kbps stereo;
ambience beds 48-64 kbps; foley / UI 32 kbps mono; voice 64 kbps mono; weather
one-shots 48 kbps stereo. Total per-experiment audio budget: 6.2 MB (1.5 MB initial,
2.5 MB lazy positional, 2.2 MB optional music).

Source library is the curated CC0 list in `docs/research/audio-architecture.md`
section 4 plus the asset-pipeline list in section 9 of the asset-pipeline doc. License
verification is required at download time -- Freesound licenses are per-file even
within a single uploader.

Music is a ratification gap. Open question A in the audio research doc. The choice
(CC0 from Incompetech, itch.io free packs, or original composition) is deferred to
the Phase 4 audio team and tracked as a beads issue.

### 6.6 Captions and accessibility

WCAG 2.1 AA SC 1.2.1 requires captions for any pre-recorded audio carrying
information. Implementation is the `CaptionSystem` in section 9 of the audio
research doc:

- One `captions.json` file per voice or significant ambient asset, WebVTT-cue subset.
- `captionBus.emit({ id, text, speakerLabel?, durationMs, priority })` at sound
  start.
- `<CaptionOverlay>` consumes the bus, renders bottom-third, semi-transparent dark
  container. Font from `--font-mono` for data-feel ambient cues, `--font-body` for
  voice. `aria-live="polite"` for ambient, `assertive` for voice.
- VR caption overlay is a `@react-three/uikit` panel at 1.8 m forward, 0.5 m below
  eye level, billboarded.

### 6.7 Determinism boundary

Audio reads simulation state through read-only accessors and a one-way event bus.
Audio never writes to `WeatherSystem`, `EventEngine`, `FieldNotebook`, any entity
state, or any data destined for CSV. Audio settings live in their own slice (`state.audio`),
isolated from `state.simulation`. Audio time (`AudioContext.currentTime`) is never
used as a seed, timestamp in CSV, or RNG input.

The CI determinism test runs every snapshot with audio enabled and disabled (env
flag suppresses `AudioContext` creation). CSV outputs must be byte-identical in both
runs.

---

## 7. Asset Pipeline

### 7.1 Formats

- **Meshes:** GLB (binary glTF 2.0) with Draco geometry compression and Meshopt
  vertex attribute encoding. Quantization 14 / 10 / 12 bits for position / normal /
  UV; 16 bits for animated joints.
- **Textures:** KTX2 with Basis Universal supercompression. UASTC for normals and
  close-up albedo; ETC1S for distant or background atlases. Mip chains are
  pre-generated.
- **Audio:** Opus in OGG container. AAC in M4A fallback when needed.

These are the only runtime asset formats. PNG / JPG / WebP / OBJ / FBX / WAV / MP3
are source-side only.

### 7.2 Loaders

`src/engine/assets/loaders.ts` configures `GLTFLoader + DRACOLoader + KTX2Loader +
MeshoptDecoder` once per renderer and reuses them across all labs. Direct loader
instantiation in lab code is forbidden.

WASM decoders live in `public/libs/draco/` and `public/libs/basis/`. They are
versioned against the Three.js version, not the Vite asset hash, so they can be
cached for one year. Do not use CDN URLs -- CORS adds risk and breaks offline.

### 7.3 Asset manager

API contract from `docs/research/asset-pipeline.md` section 3. Highlights:

- `useGLTF`, `useTexture`, `useAudio` are hooks delegating to drei but wrapped with
  the engine's progress and disposal accounting.
- Cache keyed on URL. `useGLTF` returns a cloned scene; underlying geometry /
  material are shared.
- `disposeScene(labId)` walks the per-lab tag set and frees every
  `BufferGeometry / Material / Texture / AudioBuffer` not shared with another
  active scene.
- `prefetchNextExperiment(labId)` runs on the priority queue at tier 4 background.

### 7.4 Streaming

Four priority tiers:

| Tier | Blocks display | Contents |
|---|---|---|
| 1 | yes | ground mesh + textures, sky / HDRI, player capsule, nearest 3 cover objects |
| 2 | no | other cover objects, surface PBR sets, interactive SFX |
| 3 | no | trees, ferns, canopy planes, ambient audio |
| 4 | no | distant LODs, species-specific assets, next-experiment prefetch |

Tier 1 completion drops the loading screen. Tier 2-4 stream in without blocking. The
`LoadQueue` defaults to `maxConcurrent = 4`.

Nearest-objects-first ordering for cover objects: the EventEngine determines the
transect layout, the asset manager sorts cover-object GLBs by distance to the
player spawn, enqueues at tier 2.

### 7.5 LOD policy

Three discrete LODs per object category with manual thresholds (not auto-LOD).
Tables in section 6 of the asset-pipeline doc are normative. Cover objects: LOD0
0-3 m, LOD1 3-8 m, LOD2 8-20 m, culled beyond. Vegetation: LOD0 0-5 m, LOD1
billboard 5-15 m, culled beyond. Trees: LOD0 0-8 m, LOD1 cylinder proxy 8-20 m,
LOD2 quad billboard 20-40 m, culled beyond. Salamanders: LOD0 examination, LOD1
0.5-3 m, LOD2 sprite at distance.

VR adjustment: LOD0 thresholds extend to 1.5 m (arm length), LOD1 thresholds stay
where they are. Aggregate triangle budget compensates by being lower in VR.

### 7.6 Author-side workflow

Blender export settings, glTF Validator, and the gltf-transform optimization
pipeline are the authoritative recipes in `docs/research/asset-pipeline.md` section
10. The pipeline is:

```
weld -> prune -> simplify (LOD bake) -> draco -> meshopt -> ktx2 (UASTC critical)
     -> ktx2 (ETC1S secondary) -> validate -> ship
```

A `scripts/asset-bake.sh` script encodes this for batch processing in Phase 7. Until
then, asset authors run the commands by hand. Asset reviews check that every
shipped GLB went through the full pipeline; raw Blender exports do not enter
`public/labs/`.

### 7.7 CDN strategy

Cache headers on the static host:

| Path | Cache-Control |
|---|---|
| `index.html`, `experiments/*/index.html`, `sw.js` | `no-cache, must-revalidate` |
| `assets/[name].[hash].js / .css`, hashed images, fonts | `public, max-age=31536000, immutable` |
| `public/libs/draco/`, `public/libs/basis/` | `public, max-age=31536000, immutable` (versioned) |
| `public/labs/**` (GLB / KTX2 / OGG) | `public, max-age=2592000` |

Vite hashes JS / CSS / asset filenames automatically. The `deploy.sh` rsync uploads
`dist/` as-is.

### 7.8 Open asset gaps

- **Salamander mesh.** No CC0 source meets the bar for VR close-up examination of
  diagnostic features. Decision required before Phase 6: custom Blender base mesh
  with eight texture variants (preferred per migration plan), or stylized base mesh
  with photographic decals. Filed as `[asset][P1]` blocking the Batesian Mimicry
  port.
- **Music.** No tracks sourced. Filed as `[audio][P2]` blocking Phase 4 audio team.

---

## 8. Performance Contract

### 8.1 Budgets

These are gates. An experiment does not ship if it fails any row.

| Metric | Desktop 60 fps | Desktop 90 fps | VR Quest 3 (72 fps) | Tablet 60 fps |
|---|---:|---:|---:|---:|
| Visible triangles | 800K | 600K | 400K | 200K |
| Draw calls | 150 | 120 | 100 | 75 |
| Texture VRAM | 256 MB | 200 MB | 128 MB | 96 MB |
| Frame budget total | 16.7 ms | 11.1 ms | 13.9 ms | 16.7 ms |
| JS frame budget | 3.0 ms | 2.5 ms | 2.0 ms | 2.5 ms |
| Shadow map size | 4096 | 2048 | 2048 | 1024 |

VR frame breakdown: scene traversal + cull 1.0 ms, shadow pass 1.8 ms, main render
(stereo multiview) 5.5 ms, post (SSAO half-res, tone mapping) 2.0 ms, XR compositor
0.8 ms, JS sim tick 1.0 ms, headroom 1.8 ms.

Adaptive quality: 30-frame moving average of frame time. If above 12 ms (VR) or 14
ms (desktop 60 fps), drop one preset. If below 10 ms for 60 frames, step back up.
This is engine-owned, not lab-owned.

### 8.2 Initial bundle

Hard cap: 2 MB gzipped initial bundle. Estimated split (`docs/research/asset-pipeline.md`
section 8.1):

| Chunk | Size (gzip) |
|---|---:|
| React + React DOM | ~45 KB |
| Three.js (named imports only) | ~250 KB |
| R3F + drei | ~80 KB |
| Zustand | ~3 KB |
| Engine core | ~120 KB |
| App shell | ~80 KB |
| **Total** | **~580 KB** |

Rapier WASM (~500 KB), `@react-three/xr`, and `@react-three/uikit` lazy-load on
first lab mount or first VR session, not in the initial bundle.

### 8.3 Per-experiment budget

13 MB total per experiment download. Tier 1 (~3-5 MB) completes in ~1 s on a 30 Mbps
connection; the scene is visible while tier 2-4 streams in. Return visits hit the
browser cache.

### 8.4 Profiling tools

- `r3f-perf` and `stats.js` overlays in dev only.
- `leva` for live tweaking material parameters during scene authoring.
- Chrome DevTools Performance for JS profiling.
- Chrome `chrome://gpu` and Quest Browser developer overlay for GPU accounting.

### 8.5 CI perf gate

`scripts/perf-gate.ts` runs each lab in headless Puppeteer with WebGL enabled,
collects renderer stats from `window.__BORCHARD_STATS`, and exits non-zero if any
budget is exceeded. Triangle count and draw call number gate hard from Phase 4
onward. Frame time is warning-only in CI until a GPU-equipped runner is provisioned
(Puppeteer with software EGL is not representative). Texture VRAM is warning-only
until the manual approximation is replaced with a tracked allocator.

The gate runs on every PR that touches `src/engine/`, `src/labs/`, `public/labs/`, or
`scripts/budgets.ts`. Skipped on doc-only PRs.

Budget definitions live in `scripts/budgets.ts`. New labs add an entry there as part
of their PR; missing entries fail the gate by default.

---

## 9. Migration Plan -- Hardy-Weinberg and Batesian Mimicry

This section ratifies the migration plan in `docs/research/migration-plan.md` with
two amendments:

1. The eleven research documents at
   `borchard-labs/sim/experiments/batesian-mimicry/research/` move to
   `src/labs/batesian-mimicry/research/` as a copy. The legacy directory is deleted
   in the migration commit. One canonical location avoids drift.
2. Both labs run their scientific state in a Web Worker. Hardy-Weinberg's existing
   main-thread tick loop is replaced; the visual hook subscribes to worker
   `TICK_COMMITTED` events. This unifies the architecture and removes a path of
   nondeterminism risk.

### 9.1 Hardy-Weinberg port

**Preserved (port verbatim to TypeScript):**

| Source module | New location | Role |
|---|---|---|
| `HWPopulation.js` | `src/labs/hardy-weinberg/sim/population.ts` | Force application, history, expected, chi-square |
| `config.js` `DEFAULTS` | `src/labs/hardy-weinberg/config.ts` | Parameter defaults |
| `HWDataCollector.js` columns | `src/labs/hardy-weinberg/csv.ts` | Column ordering + 4-decimal formatting |
| Engine RNG helpers | `src/engine/utils/prng.ts` (and friends) | Seeded RNG, gaussian, binomial sampler |
| `binomialSample` (Bernoulli loop) | `src/engine/utils/prng.ts` | DO NOT replace with normal approximation |

**Discarded:**

- `HardyWeinbergSim.render()` and the entire stacked-area chart canvas code.
- `Simulation.js` RAF loop, hand-rolled HUD, hand-rolled ConfigScreen.
- `HWOrganism.js` (stub).

**New visual treatment:**

A 3D stratigraphic column. Each generation contributes one ring; the column grows
upward by `STRATUM_HEIGHT` (~0.05 world units) per generation. Each ring stacks
three coloured slabs whose heights are `freqaa / freqAa / freqAA`. Implemented as a
single instanced hex-prism mesh with per-instance attributes; one draw call for the
full history.

Adjacent: a hovering 2D stacked-area chart (drei `<Html>` in transform mode) for
traditional reading. The 3D column is the headline; the 2D chart is the data
companion.

Optional `<AlleleField>` (`populationSize / 50` low-poly organism instances) is
deferred to Phase 7 polish.

**Tests:**

Determinism harness at `src/labs/hardy-weinberg/__tests__/determinism.test.ts`.
Seeds 1, 7, 13, 17, 23, 31, 47 (table in section 5.3 of the migration doc). CSV
must match byte-for-byte.

Fixtures captured by `scripts/capture-goldens.ts`, which runs the legacy modules
with `Math.random` shimmed to mulberry32 with the matching seed, writes
`fixtures/hardy-weinberg/<seed>/expected.csv`.

### 9.2 Batesian Mimicry port

**Preserved (port verbatim to TypeScript):**

| Source module | New location | Role |
|---|---|---|
| `config.js` (~743 LOC) | `src/labs/batesian-mimicry/config.ts` | Species, weights, weather tables |
| `EventEngine.js` | `src/labs/batesian-mimicry/sim/eventEngine.ts` | Encounter generation, special events |
| `WeatherSystem.js` | `src/labs/batesian-mimicry/sim/weatherSystem.ts` | Temperature, humidity, rain, encounter modifier |
| `FieldNotebook.js` (logic side) | `src/labs/batesian-mimicry/sim/fieldNotebook.ts` | Row recording, hidden truth, CSV export |
| `AnalysisPanel.js` `_computeStats` family | `src/labs/batesian-mimicry/sim/analysis.ts` | Stats, ratio, confusions |
| `Salamander.js` constructor + trait rolls | `src/labs/batesian-mimicry/sim/salamanderTraits.ts` | Per-individual measurements |
| Eleven research documents | `src/labs/batesian-mimicry/research/` | Verbatim copy |

**Discarded (~3000 LOC):**

- All canvas rendering, ViewManager, click handling.
- `ForestEnvironment.js`, `CoverObject.js` rendering, `TextureGenerator.js`,
  `ParticleSystem.js`.
- All Salamander drawing routines.
- `IdentificationChallenge.js` DOM panel, `FieldNotebook.js` injected stylesheet
  and entry-form DOM, `AnalysisPanel.js` chart canvas drawing.

**New visual treatment:**

The cove hardwood forest as a true 3D walkthrough using Phase 3 environment
systems. Cover-object physics through Phase 4 grab system. Salamander reveal beats
with audio cues. ID challenge as a dual-mount panel (uikit in VR, drei `<Html>` on
desktop). Field notebook as a HUD-framework component. Analysis overlay as a React
component reusing the ported stats logic.

The migration plan section 4.4-4.8 enumerates the scene composition, encounter loop,
weather audio mapping, and the cove-hardwood-forest cinematic beats.

**Tests:**

Determinism harness at `src/labs/batesian-mimicry/__tests__/determinism.test.ts`.
Seeds 101, 103, 107, 109, 113. Asserts both the CSV (16 columns including the 2
hidden) and the encounter event log (a richer signal that includes empty and
invertebrate events).

### 9.3 Cross-cutting determinism work

- Mulberry32 in `src/engine/utils/prng.ts`. The interface is `{ next(): number }`;
  every consumer of randomness (RNG helpers, `gaussianRandom`, `binomialSample`,
  `weightedChoice`, salamander trait rolling, EventEngine, WeatherSystem) takes
  `Rng` as a constructor or function parameter.
- A consolidated CSV escape helper (RFC 4180) at `src/engine/utils/csv.ts`. Two
  copies exist in legacy code; one canonical location with unit tests covering the
  spec.
- `scripts/capture-goldens.ts` produces fixtures by running legacy modules with the
  RNG shim. Run once per seed; commit the outputs.
- Save round-trip test: run 50 generations, save, reload, run 50 more, compare to
  100-generation reference. Mulberry32 state must round-trip in the save schema.

### 9.4 Specific risks to monitor

| Risk | Mitigation |
|---|---|
| `gaussianRandom` Box-Muller pulls two values per call -- order matters | Port preserves the exact two-pull sequence. Snapshot tests catch drift. |
| `binomialSample` could be replaced by normal approximation later | `assertExactBinomial` unit test for `(10000, 0.5)` at fixed seed. Comment "DO NOT REPLACE" at the top of the file. |
| `WeatherSystem.update` discrete vs continuous time semantics | Driven by discrete minute chunks emitted by the controller (3-min tick or per-flip), not by a continuous timer. Snapshot tests assert weather at known elapsed-minute checkpoints. |
| StrictMode double-invokes effects -- could double-roll RNG | Sim hook stores the RNG and engine instances in `useRef`. Unit test wraps in StrictMode and asserts identical CSV. |
| Save round-trip without RNG state would corrupt encounter sequence | Save schema includes the mulberry32 32-bit state. Round-trip test as in 9.3. |

The full risk register is `docs/research/migration-plan.md` section 6, normative.

---

## 10. Roadmap for the Remaining Experiments

The site lists 16 experiments. Two are migrated in Phase 5 and Phase 6. The
remaining are tracked under existing beads issues and reshaped to the new
Lab contract. Each one becomes an issue tagged `[migration]` or `[engine][lab]`
with a one-paragraph engine-shaped scope describing:

1. The science loop (deterministic worker payload, tick rate, save shape).
2. The visual treatment (which Phase 3 environment systems it uses; which it adds).
3. The interaction model (first-person walkable, observer camera, parameter UI
   only, etc.).
4. The HUD profile (which HUD components ship; whether a custom diegetic surface is
   needed).
5. The audio profile (`AdaptiveAudioProfile` shape, ambience source list).
6. The asset budget (within the table in section 8).

The list, ordered by science complexity and asset reuse from the cove forest:

| Lab | Reuses | New systems required |
|---|---|---|
| Plant Phenology | forest, weather, time-of-year | scaled time controls, growth shader |
| Thermal Biology | forest, weather | temperature heatmap layer, organism thermoregulation traits |
| Tide Pool | -- | water surface, intertidal terrain, tidal time controller |
| Water Quality | tide pool water | sample collection HUD, chemistry parameter UI |
| Whale Migration | open ocean (new) | open-ocean environment, large-scale waypoint navigation, time compression |
| Walrus Acoustics | -- | hydrophone HUD, audio analysis tools |
| Plant Phenology / Natural Selection / Predator-Prey | forest | population dynamics math (similar to HW) |
| Mark-Recapture | shared trapping mechanic | recapture ledger UI |
| Optimal Foraging | forest, organism instancing | foraging path optimisation visualisation |
| Territorial Behavior | forest | territory boundary visualisation, conflict events |
| Natural Selection | forest | trait inheritance math, generation tick loop |
| Species Diversity | forest | sampling protocol UI, diversity index calculator |
| IFD framework + Bumblebee / Starling / Stickleback / Mallard / Coot | -- | shared IFD framework, per-species behaviour models |
| Mimicry framework + Hoverfly/Wasp / Kingsnake/Coral / Viceroy/Monarch / Salamander/Newt | cove forest | shared mimicry framework, per-pair species models |
| Elephant Seal | -- | beach environment, seal behavior model |

These break into seven new "framework" issues (IFD framework, mimicry framework,
predator-prey core, trait inheritance core, etc.) plus per-species content issues
that hang off them. Filed in beads at P3 or P4 until prerequisites land.

The Phase 7 polish pass also adds one beads issue per non-shipped lab to capture
the remaining engine-shaped scope work above.

---

## 11. Phase Boundaries and Ratification Gates

Each phase commits once on completion. Code review (the `feature-dev:code-reviewer`
agent) runs at every team boundary. The gates are:

- **Phase 1 (this document) -> Phase 2.** Mason ratifies `ENGINE-DESIGN.md`. Beads
  issues for Phase 2 are filed and visible. Open questions in section 12 either
  resolved or explicitly deferred.
- **Phase 2 -> Phase 3.** Vite + React + R3F builds. The lab host mounts a placeholder
  scene. The asset manager loads a sample GLB end to end. The settings menu round
  trips a value through localforage. All Phase 2 unit tests green. CI lint and type
  checks green.
- **Phase 3 -> Phase 4.** The visual benchmark (a "demo cove" scene) renders and
  matches reference quality side by side with the Phase 0 reference shots. r3f-perf
  shows 60+ fps on mid-range desktop with the High preset.
- **Phase 4 -> Phase 5.** First-person walkable in the demo cove. Cover objects can be
  grabbed. VR mode enters and exits cleanly. Audio buses, ducking, and adaptive
  ambience demoed. The CI determinism placeholder test passes.
- **Phase 5 -> Phase 6.** Hardy-Weinberg ported. CSV golden tests green for all seven
  seeds. Stratigraphic column renders. 2D chart overlay reads correctly. Save round
  trip works.
- **Phase 6 -> Phase 7.** Batesian Mimicry ported. CSV + encounter log golden tests
  green for all five seeds. Cove hardwood forest demoed end-to-end. Eleven research
  documents copied; legacy directory deleted.
- **Phase 7 ship.** All experiments roadmapped (section 10), accessibility pass,
  cross-browser pass, cross-device pass, performance profiling pass. PWA may be
  enabled if the team is satisfied with the cache invalidation story.

---

## 12. Open Questions Carried Into Implementation

These do not block Phase 2 but require a decision before the phase that needs them.

| # | Question | Decision needed by | Owner |
|---|---|---|---|
| Q1 | Music sourcing (CC0 catalogue vs original composition) | Phase 4 audio team | Mason |
| Q2 | Salamander mesh authoring approach (custom Blender base mesh vs base + decals) | Phase 6 start | asset / migration team |
| Q3 | WebGPU promotion to default (track Safari + Quest browser parity) | Phase 7 polish | render team |
| Q4 | Service worker / PWA enable | Phase 7 polish | infra team |
| Q5 | Telemetry backend (build it or remove the consent UI entirely) | before any backend work | Mason |
| Q6 | `<AlleleField>` for Hardy-Weinberg (ship in Phase 5 vs Phase 7 polish) | Phase 5 mid-point | render team |
| Q7 | i18n scope expansion beyond `en` | Phase 7 polish | UI team |
| Q8 | Whether the static experiment HTML pages stay as island mounts or convert to full SPA per page | Phase 5 design checkpoint | Mason |

These are tracked in beads as `[design][P2]` issues so they do not get lost.

---

## Appendix A. Document History

| Date | Change |
|---|---|
| 2026-04-28 | Phase 0 research documents committed |
| 2026-05-02 | This document published as the Phase 1 synthesis |

## Appendix B. Source Documents

The seven Phase 0 research documents in `docs/research/` are the working notes
behind every decision in this document. When this document leaves a question open,
those documents are the next reading.

- `docs/research/engine-architecture.md`
- `docs/research/rendering-pipeline.md`
- `docs/research/interaction-system.md`
- `docs/research/audio-architecture.md`
- `docs/research/asset-pipeline.md`
- `docs/research/game-systems.md`
- `docs/research/migration-plan.md`
