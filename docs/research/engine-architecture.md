# Engine Architecture and Stack Validation

**Phase 0, Agent 1 -- Borchard Labs Game Engine Overhaul**
**Date:** 2026-04-28
**Status:** Recommendation, not yet ratified

## Executive Summary

Adopt the proposed declarative stack: Three.js r184 driven through React Three Fiber v9 with @react-three/rapier v2, TypeScript, Vite 7 LTS, Tailwind, Zustand, and localforage. The R3F layer is the lower-risk path to AAA visual quality because every battle-tested Pmndrs library (drei, postprocessing, rapier, xr, uikit) is built around it; rolling our own scene graph would force us to rebuild that ecosystem before we wrote a single experiment. Run a single-package Vite app at the repo root with internal path-aliased modules for `engine/`, `experiments/`, and `assets/`. Promote to a pnpm workspace only if a second consumer of the engine appears. Keep scientific simulation state strictly separate from rendering state (deterministic step in a Web Worker, visual state via Zustand selectors), which preserves byte-equal CSV reproducibility while leaving the renderer free to interpolate at 60-90 fps. The existing `deploy.sh` becomes a two-line wrapper around `pnpm build` plus rsync of `dist/`. Confidence: high on stack, medium on monorepo deferral, high on the determinism boundary.

## 1. Stack Validation -- R3F vs Vanilla Three.js

### Decision

**Three.js + React Three Fiber + drei + @react-three/rapier.** Confidence: high.

### Pros and Cons

| Axis | Vanilla Three.js + custom scene graph | Three.js + R3F + drei + Rapier |
|------|---------------------------------------|-------------------------------|
| Developer velocity | Slow. Every scene graph operation, prop diff, lifecycle hook, and resource disposal is hand-coded. Engine-vs-content boundary must be invented from scratch. | Fast. JSX maps 1:1 onto entities. drei provides cameras, controls, environment maps, loaders, postprocessing wiring, gizmos, and HUD primitives out of the box. |
| Runtime performance | Theoretically slightly faster (no React reconciler overhead). In practice the gap is small; R3F's reconciler runs at React priority and most scene churn is tree-stable. | Adequate for AAA browser bar. Pmndrs has profiled R3F at 144 fps on dense scenes when written idiomatically (refs over state for per-frame mutation). |
| Debugging | Custom inspector, custom selection, custom hot reload. We would build it. | Free: drei `<Stats>`, `<StatsGl>`, `r3f-perf`, the React DevTools tree showing the entire scene as components, leva live tweakers, redux-style time travel via Zustand devtools. |
| Visual quality ceiling | Ceiling is identical to R3F (same renderer underneath), but staffing reach to it is much harder. | Identical ceiling, plus pmndrs/postprocessing, three-stdlib, n8ao, drei `<Environment>`, `<Sky>`, `<Cloud>`, `<MeshTransmissionMaterial>`, `<CausticsProjector>` are React components we drop in. |
| Physics | Rapier directly is fine but the bridge to scene graph is hand-written: world step, body sync, collider creation, sensor events, debug renderer, character controller. | `@react-three/rapier` provides `<RigidBody>`, `<CuboidCollider>`, `<CapsuleCollider>`, `useRapier()`, character controller, raycast hooks, debug component. Two days of integration work avoided. |
| VR | Three.js has WebXRManager. Wiring controllers, ray pointers, teleport locomotion, hand tracking, VR UI is multiple weeks of bespoke work. | `@react-three/xr` v6 provides `<XR>`, `<XROrigin>`, `<TeleportTarget>`, `<XRHandModel>`, controller models, ray visualizers, store-based session state. |
| Determinism | Easier to control (no reconciler) but only matters if the science loop runs inside the renderer. We will run science in a worker either way, so this is a non-issue. | Same. Determinism comes from running the simulation step in a Web Worker on a fixed timestep, regardless of which renderer drives the view. |
| Bundle size | Smaller (tree-shake just the bits used). | About 200-300 KB heavier after gzip; acceptable for our budget (initial chunk under 2 MB). Lazy-loaded experiment chunks dominate total weight anyway. |
| Long-term maintenance | We become the maintainers of an in-house framework on top of Three.js. The educational mission does not benefit from owning that surface. | Pmndrs maintains the framework. Our only Three.js-version coupling lives in version pins. |

### Alternatives Considered and Rejected

- **Babylon.js.** First-class engine with a richer feature set (particle authoring, node materials, native physics, IBL probes). Rejected: smaller pmndrs-equivalent ecosystem, weaker integration with React UI, our team and reference projects (Bruno Simon, Three.js Journey) are Three.js-native.
- **PlayCanvas Engine (open-source split).** Real game engine, real editor, but the editor lock-in or self-host complexity adds friction we do not need; and the React/HUD story is poor.
- **Pure Three.js.** See table above. Lower ceiling for the team size we have.
- **Unity WebGL or Unreal Pixel Streaming.** Out of scope. Build size, load time, and editor toolchain make these inappropriate for a public educational site.

### Why R3F Wins on the Specific Bar We Set

Subnautica-grade atmosphere depends on a tight feedback loop between gameplay code and rendering code (a fog density that reacts to camera depth, a particle emitter parented to the player, a postprocessing weight that animates with health). R3F's component tree is the cleanest expression of those parent-child relationships. With vanilla Three.js we either invent that ergonomic layer or our gameplay code becomes a bag of `scene.add()` calls and manual `userData` bookkeeping. We have shipped that style before; it does not scale to sixteen experiments.

## 2. Engine-vs-Content Boundary

Every experiment is a `Lab` (chosen over "Experiment" to avoid the noun collision with the existing class name). The engine knows nothing about biology; the lab knows nothing about renderers, physics worlds, or save serialization formats.

### Lifecycle Contract

```ts
// engine/types/lab.ts

import type { Group } from 'three';
import type { World as RapierWorld } from '@dimforge/rapier3d-compat';
import type { GameStore, AssetManifest } from '../runtime';
import type { ZodSchema } from 'zod';

export interface LabContext {
  /** Stable per-lab seed. CSV outputs must be reproducible from this value. */
  seed: number;

  /** R3F scene root the lab mounts content under. */
  sceneRoot: Group;

  /** Shared physics world. Labs request bodies through the runtime, never via `world.createRigidBody` directly. */
  physics: RapierWorld;

  /** Game store slice scoped to this lab. Read for visual state, write for science events. */
  store: GameStore;

  /** Asset manifest for this lab. Loader resolves these before init() resolves. */
  assets: AssetManifest;

  /** Engine-supplied logger (routes to dev overlay + structured telemetry buffer). */
  log: (level: 'info' | 'warn' | 'error', msg: string, data?: unknown) => void;

  /** Wall-clock seconds since the lab mounted. Distinct from sim ticks. */
  now: () => number;
}

export interface Lab<Save extends object = object> {
  /** Stable kebab-case identifier. Drives URL slug, save key, asset folder. */
  readonly id: string;

  /** Human-readable label. */
  readonly title: string;

  /** Determinism contract. Bumping invalidates older saves and re-runs CSV golden tests. */
  readonly version: string;

  /** Zod schema for the save payload. Used at load time for validation and at dev time for migration tests. */
  readonly saveSchema: ZodSchema<Save>;

  /** Mount the lab. Resolve only once all critical assets are uploaded to the GPU. */
  init(ctx: LabContext): Promise<void>;

  /**
   * Fixed-step science update. Called at the lab's chosen tick rate (e.g. one per
   * sim-generation), independent of frame rate. Determinism boundary lives here.
   */
  tick(dtTicks: number, ctx: LabContext): void;

  /**
   * Per-frame visual update. Called from R3F's useFrame after physics step.
   * Allowed to interpolate between ticks. Forbidden from mutating science state.
   */
  frame(dtSeconds: number, alpha: number, ctx: LabContext): void;

  /** Dispose all GPU resources, unsubscribe stores, free worker, drop physics handles. Must be idempotent. */
  dispose(): Promise<void>;

  /** Return a serializable snapshot. Must round-trip through JSON.stringify. */
  getSaveState(): Save;

  /** Restore a previously serialized snapshot. Throw if version mismatch and no migration is available. */
  loadSaveState(save: Save): void;
}
```

### Why the Two-Step Design (`tick` vs `frame`)

Scientific determinism requires a fixed-step integrator that runs in a separate logical timeline from rendering. The renderer interpolates between the last and current science state by a factor `alpha` (0..1). This is the pattern Glenn Fiedler describes in "Fix Your Timestep" and what Outer Wilds and Subnautica use to make physics frame-rate-independent. CSV outputs come from `tick()` only.

### Renderer-Side Adapter

Each `Lab` is paired with an R3F component that pulls visual state out of the store:

```ts
// engine/types/lab.tsx

export interface LabComponent<P = Record<string, never>> {
  (props: P): JSX.Element;
}

export interface LabModule<Save extends object = object, P = Record<string, never>> {
  /** Logic side. Owns the science state. */
  lab: Lab<Save>;
  /** Render side. R3F components, HUD overlays, audio sources. */
  Scene: LabComponent<P>;
  /** HTML overlay for diegetic HUD. Optional. */
  HUD?: LabComponent<P>;
}
```

Hardy-Weinberg is one `LabModule` whose `lab` does the population genetics math and whose `Scene` renders a stratigraphic data column. Batesian mimicry is another whose `lab` runs the encounter engine and whose `Scene` renders the forest.

## 3. Scene Management -- Multiple Experiments Coexisting

### Single-Lab-At-A-Time Runtime

We do not need many labs co-resident. A student visits one experiment page; that page mounts exactly one `LabModule`. The site shell remains static HTML; Vite emits a per-experiment chunk that boots an R3F root inside `<div id="lab-root">`.

```ts
// engine/runtime/LabHost.tsx

export function LabHost({ moduleId }: { moduleId: string }) {
  const moduleRef = useRef<LabModule | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let mounted: LabModule | null = null;

    (async () => {
      const mod = await loadLabModule(moduleId);     // dynamic import + asset prefetch
      if (cancelled) { await mod.lab.dispose(); return; }
      const ctx = await buildLabContext(mod);        // scene root, physics, store slice
      await mod.lab.init(ctx);
      mounted = mod;
      moduleRef.current = mod;
      setPhase('ready');
    })().catch(() => setPhase('error'));

    return () => {
      cancelled = true;
      if (mounted) {
        mounted.lab.dispose();                       // GPU buffers, RAF subscriptions
        disposeLabContext(mounted);                  // physics bodies, store slice, audio
      }
      moduleRef.current = null;
    };
  }, [moduleId]);

  // ... render Canvas, mod.Scene, mod.HUD
}
```

### Resource Freeing

Three.js leaks are notoriously hard. Three things must be released on `dispose()`:

1. **Geometry, material, texture handles.** drei's `useGLTF.preload` caches model graphs across remounts. Use `useGLTF.clear(url)` on lab teardown for assets the student is unlikely to revisit.
2. **Physics bodies.** Rapier's `World.free()` releases all colliders and rigid bodies in one call. We instantiate one Rapier world per lab, not a global one, so disposal is a single call.
3. **Audio sources.** Howler exposes `Howl.unload()`; PositionalAudio sources need `source.disconnect()` plus DOM media element revocation if streamed.

We add a `ResourceTracker` utility that wraps `init()` and tags every imported asset; `dispose()` walks the tag set and frees in reverse order. This is the single most common source of WebGL memory bloat in long-lived tabs and we treat it as a hard contract.

### Preloading and Swapping

Because each lab is its own page, "swapping" only matters if we add a meta-game shell that lets a student travel between labs without a hard nav. That is a Phase 7 stretch, not foundation work. For Phase 2-6 we treat each `LabHost` mount as a fresh navigation and let the browser handle teardown of the previous tab's resources.

## 4. Game State Architecture

Two distinct stores. They do not share a memory address. They synchronize through a typed event boundary.

### Layer 1 -- Scientific State (Authoritative, Deterministic)

Lives in a Web Worker per lab. The worker holds:

- The seeded PRNG (we use a SplitMix64 -> xoshiro256** chain implemented in-repo, not Math.random).
- All population, environment, and event state.
- The `tick(dt)` step.
- The CSV row buffer.

The worker accepts `STEP`, `RESET`, `LOAD_SAVE`, `DUMP_SAVE`, `EXPORT_CSV` messages and emits `TICK_COMMITTED` events containing a small public-state delta (what the visual layer needs to know to render this tick). We use `Comlink` for the typed RPC.

```ts
// engine/runtime/scienceWorker.ts (skeleton, runs in worker)

self.addEventListener('message', (e) => {
  const msg = e.data as ScienceMessage;
  switch (msg.type) {
    case 'STEP':         step(msg.dtTicks); break;
    case 'RESET':        reset(msg.seed); break;
    case 'LOAD_SAVE':    loadSave(msg.payload); break;
    case 'DUMP_SAVE':    self.postMessage({ type: 'SAVE', payload: dumpSave() }); break;
    case 'EXPORT_CSV':   self.postMessage({ type: 'CSV', payload: csvBuffer.serialize() }); break;
  }
});
```

Why a worker:
- Determinism is preserved even if the main thread frame budget blows up (a 60ms bloom pass cannot rewrite history).
- `Math.random()` collisions across visual code and science code are impossible by construction.
- CSV exports do not block the renderer when generating large tables.

### Layer 2 -- Visual / UI State (Zustand, Main Thread)

Holds anything the UI needs to render: current tick, transport state, hovered object id, HUD panel open flag, settings, controller mappings, save slot metadata. Subscribes to `TICK_COMMITTED` events from the worker and pulls forward the public-state delta into a Zustand slice.

```ts
// engine/state/gameStore.ts (skeleton)

interface GameStore {
  transport: 'setup' | 'running' | 'paused' | 'complete';
  speed: number;
  tick: number;

  current: {
    labId: string | null;
    publicState: unknown; // typed per-lab via discriminated union
  };

  settings: SettingsSlice;
  notebook: NotebookSlice;

  setTransport(t: GameStore['transport']): void;
  setSpeed(n: number): void;
  ingestTickCommit(delta: TickDelta): void;
}

export const useGame = create<GameStore>()(/* ... */);
```

### Sync Rule

The boundary is one-directional in normal play: worker -> main thread. The main thread sends control messages (`STEP`, `RESET`, `SET_PARAMS`) and receives observable deltas. The visual layer never writes back into the science state mid-tick. This is the contract that keeps CSV outputs reproducible.

### Determinism Test Strategy

For each lab, we record a "golden" CSV from the existing vanilla-JS implementation for a curated set of seeds. The new lab's CSV must match byte-for-byte. We enforce this via Vitest:

```ts
// experiments/hardy-weinberg/__tests__/determinism.test.ts

it.each(GOLDEN_SEEDS)('seed %s reproduces 200 generations exactly', async (seed) => {
  const harness = await runHeadless('hardy-weinberg', { seed, generations: 200 });
  const actual = harness.exportCsv();
  const expected = await readGolden(`hardy-weinberg.${seed}.csv`);
  expect(actual).toBe(expected);
});
```

The headless harness runs the lab without the renderer (the lab logic must be importable as a pure module; the worker wrapper is optional for tests).

## 5. Build Tool Config

### `package.json`

```jsonc
{
  "name": "borchard-labs",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "engines": {
    "node": ">=20.11"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 4173",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint . --max-warnings=0",
    "format": "prettier --write .",
    "typecheck": "tsc -b --noEmit",
    "deploy": "pnpm build && ./deploy.sh"
  },
  "dependencies": {
    "three": "^0.184.0",
    "@react-three/fiber": "^9.6.0",
    "@react-three/drei": "^10.7.0",
    "@react-three/rapier": "^2.4.0",
    "@react-three/postprocessing": "^3.0.0",
    "@react-three/xr": "^6.6.0",
    "@react-three/uikit": "^0.10.0",
    "@dimforge/rapier3d-compat": "^0.18.0",
    "three-stdlib": "^2.36.0",
    "postprocessing": "^6.37.0",
    "n8ao": "^1.10.0",
    "maath": "^0.10.0",
    "leva": "^0.10.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.0",
    "miniplex": "^2.0.0",
    "comlink": "^4.4.2",
    "localforage": "^1.10.0",
    "zod": "^3.23.0",
    "howler": "^2.2.4",
    "framer-motion": "^11.10.0",
    "gsap": "^3.13.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/howler": "^2.2.12",
    "@types/three": "^0.184.0",
    "vite": "^7.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "vite-plugin-glsl": "^1.3.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.0",
    "@playwright/test": "^1.52.0",
    "eslint": "^9.18.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "prettier": "^3.4.0",
    "@types/node": "^22.0.0",
    "stats.js": "^0.17.0",
    "r3f-perf": "^7.2.0"
  }
}
```

Notes on pins:
- We pin minor for the React-Three ecosystem because cross-package compatibility (R3F v9 / drei v10 / rapier v2 / xr v6) is a single coordinated stack.
- Vite 7 LTS over Vite 8 for now: Vite 8 is current as of March 2026 but switched bundlers (Rolldown/Oxc); we wait one quarter for the Pmndrs ecosystem to certify against it before adopting.
- Tailwind 4 uses CSS-first configuration; no `tailwind.config.js` needed, only a `@theme` block in our root CSS.

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [
    react(),
    glsl({ compress: mode === 'production' }),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,glb,ktx2,hdr,ogg,woff2}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/labs/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'labs-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
      '@labs':   resolve(__dirname, 'src/labs'),
      '@ui':     resolve(__dirname, 'src/ui'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],   // WASM, must not be pre-bundled
    include: ['three', 'react', 'react-dom'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Hashed filenames give us cache-busting for free.
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          physics: ['@react-three/rapier', '@dimforge/rapier3d-compat'],
          post: ['postprocessing', '@react-three/postprocessing', 'n8ao'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    headers: {
      // Cross-origin isolation enables SharedArrayBuffer for the science worker.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}));
```

### `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "useDefineForClassFields": true,
    "types": ["vite/client", "@react-three/fiber"],
    "baseUrl": ".",
    "paths": {
      "@engine/*": ["src/engine/*"],
      "@labs/*":   ["src/labs/*"],
      "@ui/*":     ["src/ui/*"],
      "@assets/*": ["src/assets/*"]
    }
  },
  "include": ["src", "vite.config.ts", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

A sibling `tsconfig.node.json` covers the build scripts and `vite.config.ts`.

## 6. Project Structure

### Decision -- Single Package, Internal Modules

Borchard Labs has one consumer of the engine: the public-facing site itself. There is no separate npm publication, no second app, and no team boundary that requires versioned package contracts. A pnpm workspace introduces install graph complexity, dual `tsconfig.json` files per package, build orchestration, and cross-package import friction that buys nothing today.

We keep the door open: every internal module (`@engine`, `@labs`, `@ui`) is path-aliased and has no upward imports. If we ever publish the engine, splitting `src/engine/` into `packages/engine/` is a mechanical refactor.

### Layout

```
borchard-labs/
  README.md
  AGENTS.md
  ENGINE-DESIGN.md                    # Phase 1 synthesis output
  package.json
  pnpm-lock.yaml
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  eslint.config.js
  .prettierrc
  index.html                          # site landing (preserved from existing)
  about/                              # static field-notebook pages (preserved)
  publications/                       # (preserved)
  resources/                          # (preserved)
  experiments/                        # static experiment landing pages (preserved)
    hardy-weinberg/index.html
    batesian-mimicry/index.html
    ...                               # one folder per experiment
  assets/css/main.css                 # design system tokens (preserved)

  src/                                # everything Vite owns
    main.tsx                          # boots the lab host into <div id="lab-root">
    bootstrap/                        # routing, error boundary, splash
      LabBootstrap.tsx
      ErrorBoundary.tsx

    engine/                           # zero domain knowledge
      runtime/
        LabHost.tsx                   # host component, owns Canvas + dispose lifecycle
        loadLabModule.ts              # dynamic import + asset prefetch
        ResourceTracker.ts            # asset disposal accounting
        physicsContext.ts             # Rapier world provisioning per host
        scienceWorker.ts              # generic worker shell, lab loads in
        comlink.ts                    # typed RPC wrappers
      state/
        gameStore.ts                  # Zustand root
        settingsSlice.ts
        notebookSlice.ts
        saveStore.ts                  # localforage adapter, schema migrations
      input/
        actionMap.ts                  # keyboard, mouse, gamepad, touch, XR
        useAction.ts
      audio/
        AudioBuses.ts                 # Howler + PositionalAudio bridge
        useAudioSource.ts
      assets/
        AssetManager.ts               # GLTF + KTX2 + DRACO loaders, caching
        manifest.ts                   # typed asset declarations
      render/
        Renderer.tsx                  # Canvas wrapper, tone mapping, color space
        PostChain.tsx                 # SSAO, bloom, DOF, vignette, LUT, SMAA
        materials/                    # shared PBR library
          forestFloor.ts
          bark.ts
          rock.ts
          water.ts
          parchment.ts
        env/
          Sky.tsx
          Hdri.tsx
          Vegetation.tsx
          Fog.tsx
      hud/
        HudPanel.tsx
        DataReadout.tsx
        TransportControls.tsx
        FieldNotebook.tsx
        SettingsMenu.tsx
        PauseOverlay.tsx
        LoadingScreen.tsx
      types/
        lab.ts                        # interfaces from section 2
        rng.ts                        # seeded PRNG
      utils/
        prng.ts                       # SplitMix64 / xoshiro256**
        time.ts
        math.ts
        csv.ts                        # RFC 4180 escape, identical to current

    labs/                             # one folder per experiment
      _template/                      # scaffold a new lab from this
        index.ts                      # exports LabModule
        Lab.ts                        # Lab implementation (logic)
        Scene.tsx                     # R3F scene
        Hud.tsx                       # diegetic HUD
        worker.ts                     # science worker entry
        manifest.ts                   # asset list
        save.ts                       # zod schema + migrations
        config.ts                     # default parameters
        __tests__/
          determinism.test.ts
      hardy-weinberg/
        ...same shape as _template
        goldens/                      # CSV snapshots per seed for regression tests
      batesian-mimicry/
        ...

    ui/                               # React UI not bound to R3F
      site/                           # any new dynamic site shell components
      forms/
      icons/

    assets/                           # bundled assets (small, hashed)
      hdri/
      luts/
      shaders/
      textures/                       # only small UI textures; large terrain assets go in /public

  public/                             # large static assets, not hashed
    labs/
      hardy-weinberg/
        models/
        audio/
      batesian-mimicry/
        models/
        textures/                     # KTX2 PBR sets
        audio/

  docs/
    research/
      engine-architecture.md          # this document
      rendering-pipeline.md
      interaction-system.md
      audio-architecture.md
      asset-pipeline.md
      game-systems.md
      migration-plan.md

  tests/
    e2e/                              # Playwright

  deploy.sh                           # rewritten in section 7
```

### Why `experiments/` (HTML pages) and `src/labs/` (TypeScript) Are Distinct

The static landing pages live where they always lived. Each one mounts the SPA via a single script tag. This preserves SEO, meta tags, and the existing field-notebook reading-room aesthetic. The TypeScript lab modules are loaded into those pages by id; the URL path drives the lab id.

## 7. Continuous Deployment Evolution

### New `deploy.sh`

```bash
#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# Build with cache-busting hashes already configured in vite.config.ts.
pnpm install --frozen-lockfile
pnpm build

# Composite uploaded tree:
#   - the static site shell (index.html, about/, publications/, resources/, experiments/*.html, assets/css)
#   - the Vite-built bundle in dist/ (hashed JS, hashed assets)
#
# Vite build output is rooted at dist/. We copy the static site shell into dist/
# during build via a vite-plugin-static-copy step (or a prebuild script), so the
# upload is one rsync of dist/.
#
# The service worker registered in vite-plugin-pwa lives at dist/sw.js. It is
# served with no-cache headers below.

rsync -vhrla --delete \
  --exclude '.DS_Store' \
  --exclude '*.map' \
  "$PWD/dist/" timothason:/var/www/borchardlabs.com/

# sw.js and index.html are served with no-cache; everything else with long-cache
# because filenames are content-hashed. This is configured server-side in nginx;
# no client-side change required. Document the nginx block separately.
```

### Cache Strategy

- `index.html`, `experiments/*/index.html`, `sw.js` -> `Cache-Control: no-cache, must-revalidate`. These are the "manifest" of fresh deploys.
- `assets/[name].[hash].js`, `assets/[name].[hash].css`, hashed images, fonts -> `Cache-Control: public, max-age=31536000, immutable`. Hashes guarantee correctness.
- `public/labs/**` (large GLB / KTX2 / OGG) -> `Cache-Control: public, max-age=2592000`. A separate manifest URL inside the SW lets us invalidate per-lab if needed.

### Service Worker (Stretch)

`vite-plugin-pwa` is wired in section 5 with `registerType: 'prompt'`. On first visit a student gets a quick install dialog ("Take Borchard Labs offline?"). Once installed, all bundled JS and any visited lab's assets are cached. We do not auto-install; the prompt is opt-in to keep the trust contract clean.

For Phase 0 we mark the service worker as a stretch goal: it pays off for students on flaky campus Wi-Fi but adds a debug surface (cache poisoning, stale assets) we should not introduce until the engine is stable. The plumbing is already in the Vite config so flipping it on is a one-line change.

## Risks and Open Questions

### Risks

1. **R3F v9 / Three.js r184 / drei v10 version drift.** The Pmndrs stack moves quickly. We pin coordinated minor versions and revisit at each commit boundary. A bad upgrade can cascade across postprocessing, rapier, and xr in a single afternoon; we treat the upgrade as a planned task with a determinism test gate.
2. **Rapier determinism caveats.** Rapier guarantees determinism only when stepped at a fixed timestep with identical initialization order and the same WASM build. The science worker enforces this; the renderer cannot perturb it. If a future experiment needs physics inside the determinism boundary (rare for our biology-heavy domain), the worker must own the Rapier world too, not the main thread. Plan: revisit at Phase 4.
3. **Worker + WASM + COOP/COEP headers.** SharedArrayBuffer requires cross-origin isolation. Our static host (nginx on a single VPS) needs the headers configured. Without them we fall back to MessageChannel-only RPC, which is fine for current science loops but caps throughput.
4. **Bundle size creep.** Adding @react-three/uikit, @react-three/xr, postprocessing, drei, and rapier together pushes the initial chunk near 1.6 MB gzipped before any lab content loads. Manual chunks in `vite.config.ts` keep the critical path lean; we lazy-load `xr` and `uikit` only when a VR session is requested.
5. **Tailwind 4 + existing `assets/css/main.css`.** Tailwind 4 is CSS-first and integrates by importing the existing tokens with `@theme` directives. We do not rewrite `main.css`; we layer Tailwind utilities for new HUD components only.
6. **HMR with Web Workers.** Vite handles worker HMR but losing the science worker's in-memory state on every reload is annoying during debug. Acceptable tradeoff, mitigated by a "freeze and rehydrate" devtool that snapshots worker state on hot reload.
7. **CSV byte-equality across implementations.** The biggest content risk in the migration. If `Math.random()` was used anywhere in the existing experiments, the new seeded PRNG will produce different sequences. We plan to read the existing experiments' source line-by-line in Phase 0 Agent 7 and budget for a forensic determinism pass.

### Open Questions for the Orchestrator

1. **Do we adopt Vite 7 LTS or jump to Vite 8?** Recommendation: Vite 7 today, Vite 8 by Phase 7. Confirm with build pipeline owner.
2. **WebGPU vs WebGL2 default?** Three.js r184 ships WebGPURenderer with auto-fallback. WebGPU coverage is approximately 95% as of Q1 2026 (Chrome, Edge, Firefox, Safari 26+). The R3F community is mid-transition; some drei components still optimize for WebGL2 paths. Recommendation: default to WebGL2 in Phase 2, gate WebGPU behind a settings toggle, promote it to default once drei v11 lands. Defer in-depth call to Phase 0 Agent 2 (Rendering Pipeline).
3. **pnpm vs npm.** Recommend pnpm for install speed and strict node_modules hygiene. If the deploy environment lacks pnpm, we install it via corepack in `deploy.sh`. Confirm corepack is available on the target.
4. **Does the science worker need SharedArrayBuffer at all in v1?** Probably not; existing experiments are well under 1 MB of state. Recommend deferring SAB until a lab proves it needs it. Removes the COOP/COEP header requirement entirely for the foundation phase.
5. **Save schema versioning policy.** Recommend `saveSchema` is owned per lab, with a top-level `engineSaveVersion` tracked separately for cross-lab progression (notebook, settings). When a lab bumps its `version`, old saves are migrated through Zod-defined transforms or rejected with a clear message. Confirm policy with the migration owner.
6. **Experiment-level routing.** The existing site uses static HTML pages per experiment. Do we keep that and mount a SPA "island" per page, or move to a single SPA with client-side routing? Recommend: keep static pages, mount islands. Preserves the field-notebook reading-room and SEO. Confirm with site shell owner.
7. **Error telemetry.** Are we shipping any client-side error reporting (Sentry, self-hosted GlitchTip, none)? If yes, opt-in only and behind a settings toggle; if no, the engine logger writes to a local ring buffer the student can copy on demand. Confirm policy.

---

## Sources

- [@react-three/fiber on npm](https://www.npmjs.com/package/@react-three/fiber)
- [R3F v9 migration guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)
- [@react-three/rapier on npm](https://www.npmjs.com/package/@react-three/rapier)
- [react-three-rapier on GitHub](https://github.com/pmndrs/react-three-rapier)
- [three.js releases on GitHub](https://github.com/mrdoob/three.js/releases)
- [What's New in Three.js 2026 (Utsubo)](https://www.utsubo.com/blog/threejs-2026-what-changed)
- [WebGPURenderer docs](https://threejs.org/docs/pages/WebGPURenderer.html)
- [Vite 7.0 release notes](https://vite.dev/blog/announcing-vite7)
- [Vite 8.0 release notes](https://vite.dev/blog/announcing-vite8)
- [pnpm workspaces](https://pnpm.io/workspaces)
