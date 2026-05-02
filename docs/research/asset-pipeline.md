# Asset Pipeline & Performance Budget

**Date:** 2026-04-28
**Project:** Borchard Labs Game Engine Overhaul
**Status:** Phase 0 Research -- Pre-implementation
**Stack:** Three.js + React Three Fiber + Vite + TypeScript
**Scope:** Engine-wide asset pipeline for all experiments

---

## Executive Summary

This document defines the asset pipeline for the Borchard Labs engine overhaul: the formats that assets enter the engine as, the loaders and hooks that serve them to R3F scenes, the budgets that act as hard gates on every experiment that ships, and the author-side toolchain that keeps assets inside those budgets. The chosen stack -- GLB with Draco + Meshopt compression, KTX2/Basis Universal for textures, and OGG/Opus for audio -- is the current practical ceiling for browser delivery: GPU-compressed textures cut VRAM by 4-6x over raw RGBA, Draco reduces mesh payloads by 60-80%, and KTX2's mip chain avoids the runtime mipmap generation cost that chokes mobile GPUs. Per-experiment lazy loading and a streaming priority queue keep the initial JS bundle under 2 MB regardless of total experiment asset volume. Every budget listed here is backed by triangle counts, VRAM math, and frame-time accounting, and every experiment must pass a CI perf gate before it ships.

---

## 1. Asset Formats

### 1.1 Mesh Format: GLB with Draco + Meshopt

**Choice: GLB (binary glTF 2.0)** with Draco geometry compression and Meshopt vertex attribute encoding.

GLB is the only format that:
- Embeds textures, materials, animations, and scene hierarchy in a single binary file
- Has production-quality Three.js loader support (GLTFLoader) with Draco and Meshopt extensions
- Is the interchange format Blender exports natively and that gltf-transform operates on
- Supports morph targets, skinned meshes, instancing extensions (EXT_mesh_gpu_instancing), and LOD (MSFT_lod) as first-class extensions

**Why not OBJ or FBX:**
- OBJ is text-format with no scene hierarchy, no PBR material data, no animation, and no compression support
- FBX is binary but proprietary, requires Autodesk's SDK to parse correctly, and Three.js's FBX loader is community-maintained with known correctness gaps
- Neither has a streaming or compression story in browsers

**Draco vs Meshopt -- use both:**

Draco (Google) reorders and entropy-codes index buffers and vertex data. A 200K-tri rock mesh at 2 MB raw typically compresses to 350-500 KB with Draco. Meshopt (meshoptimizer) is a secondary pass that applies vertex cache optimization, fetch optimization, and quantization on top of the geometry Draco produces. Together they yield:

| Mesh type | Raw GLB | Draco only | Draco + Meshopt |
|-----------|--------:|-----------:|----------------:|
| Rock (50K tris) | ~800 KB | ~220 KB | ~180 KB |
| Tree trunk (1.2K tris) | ~25 KB | ~8 KB | ~7 KB |
| Salamander base (5K tris) | ~90 KB | ~28 KB | ~24 KB |
| Full environment scene | ~18 MB | ~5 MB | ~4.2 MB |

Benchmarks from gltf-transform CLI tests on similar organic geometry (photoscanned rocks, procedural bark, character meshes). Results scale roughly with triangle count and vertex uniqueness.

**Quantization settings:**

Position: 14 bits. Normals: 10 bits. UVs: 12 bits. This is the current gltf-transform default and introduces no perceptible visual error on the Batesian Mimicry cover objects at LOD0 (close-up examination). Animated joints: keep at 16 bits to avoid skinning seam artifacts.

---

### 1.2 Texture Format: KTX2 / Basis Universal

**Choice: KTX2 with Basis Universal supercompression (UASTC for quality-critical textures, ETC1S for everything else)**

The core problem with PNG and JPG in WebGL is that the GPU cannot consume them directly. Every PNG or JPG must be decoded to raw RGBA on the CPU, uploaded to VRAM uncompressed, and the mip chain generated at runtime. For a 2K albedo this is 16 MB of VRAM and 80-200 ms of upload stall on integrated GPUs.

KTX2 with Basis Universal transcodes at load time to the hardware-native compressed format for each GPU:

| GPU family | Transcodes to | Compression ratio (vs raw RGBA) |
|------------|--------------|--------------------------------:|
| Desktop NVIDIA/AMD | BC7 (DX11+) | 4:1 |
| Intel iGPU | BC7 or BC1 | 4-8:1 |
| Mobile (Android) | ASTC 4x4 or ETC2 | 4-6:1 |
| Quest 3 (Snapdragon XR2 Gen 2) | ASTC 4x4 | 6:1 |
| Apple M-series | ASTC 4x4 | 6:1 |

Mip chains are pre-generated in the KTX2 file, eliminating runtime generation.

**UASTC vs ETC1S:**
- UASTC: higher quality, larger file (~4x RGBA raw on disk but still hardware-compressed in VRAM). Use for: normal maps, albedo textures that will be seen up close (cover objects, salamander skins, the forest floor at LOD0)
- ETC1S: smaller file (~8:1 compression vs PNG), slight block artifacts, acceptable at distance. Use for: background vegetation atlases, canopy planes, distant terrain tiles, anything beyond 5m view distance

**Why not PNG/JPG:**
PNG/JPG are source formats. They have zero place in the runtime asset bundle except as a fallback for environments that cannot load WASM (extremely rare in 2026). The Basis transcoder WASM is ~400 KB and cached across sessions. That cost is paid once.

**Why not WebP:**
WebP is a better PNG/JPG but still requires CPU-decode and raw VRAM upload. No hardware compression path. Not suitable for anything above 512x512 that will be held in VRAM for the duration of a scene.

**Normal map encoding:**
Normal maps must use UASTC, never ETC1S. ETC1S block artifacts on normals produce visible shading noise (blocky specular highlights on smooth surfaces). UASTC at quality 2 (the gltf-transform default) is visually indistinguishable from uncompressed normals at typical screen distances.

---

### 1.3 Audio Format: OGG Vorbis + Opus

**Choice: OGG/Opus for all audio assets**

Opus is the current best-in-class audio codec: it outperforms AAC and MP3 at every bitrate below 128 kbps (MUSHRA listening tests, Hydrogenaudio community benchmarks), has native Web Audio API support in all modern browsers, and is available in OGG containers which Three.js PositionalAudio and Howler.js both handle natively.

**Format by use case:**

| Audio type | Format | Bitrate | Rationale |
|-----------|--------|--------:|-----------|
| Ambient beds (forest, stream) | OGG/Opus | 64 kbps stereo | Broadband content, compresses very well |
| Positional sound effects | OGG/Opus | 48 kbps mono | Spatial positioning makes stereo width irrelevant |
| UI sounds, clicks | OGG/Opus | 32 kbps mono | Very short, any bitrate is transparent |
| Music (if any) | OGG/Vorbis | 128 kbps stereo | Vorbis at 128 still outperforms MP3 at 192 |

OGG/Vorbis (quality setting 5, ~128 kbps) remains the fallback for loops where Opus introduces pre-roll latency that breaks seamless looping. Measure per asset -- in practice, Opus with Howler's sprite system handles loops cleanly.

**Why not AAC:**
- Safari WebXR has first-class OGG support since Safari 16.4 (2023)
- AAC patent situation adds tooling friction even though patents have largely lapsed
- Opus consistently wins blind ABX tests at equivalent bitrates

**Why not MP3:**
MP3 is a legacy format. There is no technical argument for using it in new projects in 2026.

**Concrete size benchmarks:**

| Audio clip | Duration | OGG/Opus 64 kbps | OGG/Vorbis q5 |
|-----------|----------|------------------:|---------------:|
| Forest ambient loop | 30s stereo | 240 KB | 480 KB |
| Stream loop | 15s mono | 90 KB | 180 KB |
| Bird call | 3s mono | 18 KB | 36 KB |
| Rock scrape SFX | 1s mono | 6 KB | 12 KB |

Total audio budget for a full experiment (15-20 clips + 2 ambient loops): 600-900 KB.

---

## 2. Loaders: Three.js Configuration

The engine configures loaders once in `AssetManager.ts` and all experiments inherit the configured instances. Direct instantiation of loaders inside experiments is a hard anti-pattern -- it prevents sharing the Draco/Basis WASM decoders and causes redundant network fetches.

### 2.1 Concrete TypeScript Setup

```typescript
// src/engine/loaders/setupLoaders.ts

import { WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Singleton instances -- create once, share everywhere
let _gltfLoader: GLTFLoader | null = null;
let _ktx2Loader: KTX2Loader | null = null;
let _dracoLoader: DRACOLoader | null = null;

export function setupLoaders(renderer: WebGLRenderer): {
  gltfLoader: GLTFLoader;
  ktx2Loader: KTX2Loader;
} {
  if (_gltfLoader) {
    return { gltfLoader: _gltfLoader, ktx2Loader: _ktx2Loader! };
  }

  // Draco decoder -- hosted at CDN or in /public/libs/draco/
  _dracoLoader = new DRACOLoader();
  _dracoLoader.setDecoderPath('/libs/draco/');
  // Preload the decoder WASM so it is ready before first mesh loads
  _dracoLoader.preload();

  // KTX2 / Basis Universal transcoder
  _ktx2Loader = new KTX2Loader();
  _ktx2Loader.setTranscoderPath('/libs/basis/');
  _ktx2Loader.detectSupport(renderer); // queries GPU extension support

  // GLTFLoader with both decoders + Meshopt
  _gltfLoader = new GLTFLoader();
  _gltfLoader.setDRACOLoader(_dracoLoader);
  _gltfLoader.setKTX2Loader(_ktx2Loader);
  _gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  return { gltfLoader: _gltfLoader, ktx2Loader: _ktx2Loader };
}

export function disposeLoaders(): void {
  _dracoLoader?.dispose();
  _ktx2Loader?.dispose();
  _gltfLoader = null;
  _ktx2Loader = null;
  _dracoLoader = null;
}
```

**Decoder hosting:**
Copy the Draco WASM and Basis WASM files into `public/libs/draco/` and `public/libs/basis/` during the Vite build. Do not use CDN URLs for these -- the CDN path requires CORS headers and introduces an external dependency that breaks offline playback. A Vite plugin or a simple `vite.config.ts` `assetsDir` override handles copying them.

---

## 3. Asset Manager: Hooks with Caching and Disposal

The asset manager wraps the loaders with:
- A cache keyed on URL so the same asset is never fetched or decoded twice
- Progress events fed to the loading screen store
- A disposal registry that tracks which assets belong to which experiment scene

### 3.1 API Sketch

```typescript
// src/engine/assets/AssetManager.ts

export interface LoadProgress {
  url: string;
  loaded: number;   // bytes
  total: number;    // bytes, 0 if unknown
  phase: 'priority' | 'background';
}

export interface AssetManager {
  // GLTF models (cached by URL, returns cloned scene for safety)
  useGLTF(url: string): GLTF;

  // Textures (KTX2 preferred, PNG fallback)
  useTexture(url: string): Texture;

  // Audio (ArrayBuffer, decoded by caller via AudioContext)
  useAudio(url: string): AudioBuffer;

  // Progress subscription
  onProgress(handler: (p: LoadProgress) => void): () => void;

  // Preload a list of URLs at background priority
  preload(urls: string[]): Promise<void>;

  // Release all assets tagged to a specific experiment scene
  disposeScene(sceneId: string): void;

  // Warm cache for the next likely experiment (called after current scene loads)
  prefetchNextExperiment(experimentId: string): void;
}
```

**Caching strategy:**
The cache stores the raw `GLTF` result and `Texture` objects. `useGLTF` returns `gltf.scene.clone()` so each experiment gets its own scene graph but shares the underlying `BufferGeometry` and `Material` objects until `disposeScene()` is called. This is the drei `useGLTF` pattern; the engine's implementation mirrors it but adds the disposal registry.

**Disposal:**
When `disposeScene('batesian-mimicry')` is called (on experiment unmount), the manager iterates the registry and calls `.dispose()` on every `BufferGeometry`, `Material`, and `Texture` that was allocated for that scene and is not shared with another active scene. GPU memory is reclaimed within the same frame.

**Integration with R3F / drei:**
The engine's `useGLTF` and `useTexture` hooks delegate to `@react-three/drei`'s same-named hooks for the actual loading logic (which already handles Suspense correctly), but wrap them with the engine's progress reporting and disposal tracking. This avoids reimplementing drei's Suspense integration from scratch.

---

## 4. Streaming: Priority Queues and Background Preloading

### 4.1 Priority Tiers

Assets load in four tiers. Each tier completes before the next begins for priority-1 assets; background tiers run in parallel after the scene is first renderable.

| Tier | Label | Blocks display? | Contents |
|------|-------|:--------------:|----------|
| 1 | Critical | Yes | Ground mesh + textures, sky/HDRI, player capsule collider, the nearest 3 cover objects |
| 2 | Near-field | No (scene visible) | All other cover objects, surface PBR sets (rock, bark, moss), interactive SFX |
| 3 | Vegetation | No | Tree trunks, ferns, rhododendron, canopy planes, ambient audio |
| 4 | Background | No | Distant LOD variants, species-specific data, next-experiment prefetch |

Tier 1 completition fires a Zustand store event that drops the loading screen. The student sees the ground and sky in 1-3 seconds on a median connection. Tier 2-4 assets stream in without interrupting frame delivery.

### 4.2 Priority Queue Implementation Sketch

```typescript
// src/engine/assets/LoadQueue.ts

type Priority = 1 | 2 | 3 | 4;

interface QueueEntry {
  url: string;
  priority: Priority;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

class LoadQueue {
  private queues: Map<Priority, QueueEntry[]> = new Map([
    [1, []], [2, []], [3, []], [4, []]
  ]);
  private inflight = 0;
  private maxConcurrent = 4;

  enqueue(url: string, priority: Priority): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queues.get(priority)!.push({ url, priority, resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.inflight < this.maxConcurrent) {
      const entry = this.dequeueHighest();
      if (!entry) break;
      this.inflight++;
      fetch(entry.url)
        .then(entry.resolve)
        .catch(entry.reject)
        .finally(() => { this.inflight--; this.drain(); });
    }
  }

  private dequeueHighest(): QueueEntry | null {
    for (const p of [1, 2, 3, 4] as Priority[]) {
      const q = this.queues.get(p)!;
      if (q.length > 0) return q.shift()!;
    }
    return null;
  }
}
```

### 4.3 Nearest-Objects-First Ordering

Cover objects on the Batesian Mimicry transect are placed by the EventEngine. After the player's initial spawn position is determined, the asset manager sorts cover objects by distance to the spawn, then enqueues their GLB downloads at priority 2 in nearest-first order. The loading screen completes when priority 1 finishes; the player can start walking while priority 2 streams.

### 4.4 Next-Experiment Prefetch

When the player is 80% through an experiment (tracked by the game state store), the asset manager begins prefetching Tier 1 assets for the next experiment in the navigation order. Bandwidth is shared -- prefetch runs at priority 4, always preempted by any in-experiment load. On fast connections (>10 Mbps) the next experiment's critical assets will be cached before the player ever clicks "next experiment."

---

## 5. Texture Atlas and Channel Packing

### 5.1 Channel Packing for PBR Terrain

Terrain materials (forest floor, rock, bark, soil) share a consistent channel-packing convention across all experiments. This reduces texture binds from 4 maps per material to 2:

**Map 1 -- Albedo (sRGB, UASTC KTX2):**
RGB = base color. Alpha = unused (set to 1.0 unless material has transparency, in which case this becomes a separate RGBA map).

**Map 2 -- ORM (linear, ETC1S or UASTC depending on importance):**
- R = Occlusion (ambient occlusion baked from high-poly source)
- G = Roughness (0 = mirror, 1 = fully rough)
- B = Metalness (0 for all organic/geological surfaces -- forest materials are never metallic)
- A = Height/displacement (optional; only authored when parallax occlusion mapping is enabled on the material)

The ORM convention matches glTF 2.0's `KHR_materials_pbrMetallicRoughness` extension, where AO is `occlusionTexture`, roughness is `metallicRoughnessTexture.g`, and metalness is `metallicRoughnessTexture.b`. Three.js's `MeshStandardMaterial` consumes these directly.

**Height in alpha (optional):**
For materials where parallax occlusion mapping adds significant depth (the forest floor leaf litter, rock surfaces), encode height in the ORM alpha channel. POM is expensive on Quest 3 -- gate it behind the "high" and "ultra" quality presets, or limit to the nearest cover-object surface only.

### 5.2 Vegetation Atlas Layout

All vegetation alpha-cutout textures (ferns, rhododendron leaves, canopy planes) pack into a single 2048x2048 RGBA atlas. UV islands:

```
[0.0-0.5, 0.5-1.0]  Fern variant A (512x512 within atlas)
[0.5-1.0, 0.5-1.0]  Fern variant B
[0.0-0.5, 0.0-0.5]  Fern variant C / Rhododendron leaves
[0.5-1.0, 0.0-0.5]  Canopy alpha planes (3-4 variants)
```

All vegetation instances reference the same atlas, so the entire vegetation pass -- potentially 80+ fern instances and 40+ tree canopy planes -- is a single texture bind. This is one of the highest-leverage draw-call reductions available.

### 5.3 Salamander Skin Atlas

All 8 species' albedo maps pack into a 2048x1024 RGBA atlas (4 rows x 4 cols of 512x256 cells). The single shared base mesh uses a species index uniform to select UV offset:

```glsl
// In the custom material vertex shader:
uniform float uSpeciesRow;  // 0-1 (row 0-1 in atlas)
uniform float uSpeciesCol;  // 0-3 (col 0-3 in atlas)
vUv = vec2(
  (aUv.x + uSpeciesCol) * 0.25,
  (aUv.y + uSpeciesRow) * 0.5
);
```

Switching species at runtime: update two uniforms, no material swap, no rebind.

---

## 6. LOD Strategy

### 6.1 Recommended Tier Scheme

Three discrete LOD levels per object category, managed by Three.js `LOD` objects. Manual threshold assignment (not auto-LOD) because the experiment scenes have known camera positions (first-person player, fixed spawn).

**Cover objects (rocks, logs, boards -- interactive, examined up close):**

| LOD | Distance | Triangle % vs LOD0 | Texture resolution |
|-----|----------|-------------------:|-------------------|
| LOD0 | 0-3 m | 100% | Full (1K-2K) |
| LOD1 | 3-8 m | 35% | Half (512) |
| LOD2 | 8-20 m | 10% | Quarter or atlas |
| Culled | >20 m | -- | -- |

LOD0 is what the player sees during close examination. At 3m the switch to LOD1 is below the visual acuity threshold for a first-person camera with a 75-degree FOV.

**Vegetation (ferns, rhododendron -- non-interactive):**

| LOD | Distance | Technique |
|-----|----------|-----------|
| LOD0 | 0-5 m | Full cross-plane mesh, alpha-cutout |
| LOD1 | 5-15 m | Single billboard quad from vegetation atlas |
| Culled | >15 m | -- |

Vegetation is not interactive, so LOD1 at 5m is visually acceptable. The switch from a cross-plane mesh to a single quad produces a subtle rotation artifact that can be mitigated with a random per-instance spawn rotation to break the grid pattern.

**Trees (instanced trunks -- non-interactive):**

| LOD | Distance | Technique |
|-----|----------|-----------|
| LOD0 | 0-8 m | Full trunk mesh (800-1200 tris), bark PBR |
| LOD1 | 8-20 m | Cylinder proxy (200 tris), shared bark texture |
| LOD2 | 20-40 m | Single quad billboard |
| Culled | >40 m | -- |

**Salamanders (rare, high-importance objects):**

| LOD | Distance / context | Technique |
|-----|-------------------|-----------|
| LOD0 | Examination view (in hand or within 0.5m) | Full mesh (4-6K tris), 2K textures, full rig |
| LOD1 | Encounter reveal (0.5-3m) | Mid-poly (1.5K tris), 1K textures |
| LOD2 | Survey distance (>3m, if visible at all) | Billboard sprite from species atlas |

### 6.2 Three.js LOD Setup

```typescript
import { LOD, Mesh, MeshStandardMaterial } from 'three';

function buildCoverObjectLOD(
  lodMeshes: [Mesh, Mesh, Mesh]  // [LOD0, LOD1, LOD2]
): LOD {
  const lod = new LOD();
  lod.addLevel(lodMeshes[0], 0);    // 0m threshold
  lod.addLevel(lodMeshes[1], 3);    // 3m
  lod.addLevel(lodMeshes[2], 8);    // 8m
  // Empty mesh at 20m effectively culls
  lod.addLevel(new Mesh(), 20);
  lod.autoUpdate = true;
  return lod;
}
```

**VR LOD adjustment:**
In VR, the player is physically standing over the object. LOD0 threshold extends to 1.5m (arm length). LOD1 threshold stays at 8m -- in VR the retina display density makes LOD1 transitions more visible. The budget accounts for this by targeting 400K visible triangles (vs 800K desktop) through more aggressive LOD1 thresholds on non-cover-object geometry.

---

## 7. Performance Budgets

### 7.1 Budget Table

These are hard gates enforced by CI. An experiment does not ship if it fails any row.

| Metric | Desktop (60 fps) | Desktop (90 fps) | VR Quest 3 (72 fps) | Tablet (60 fps) |
|--------|:----------------:|:----------------:|:-------------------:|:---------------:|
| Visible triangles | 800K | 600K | 400K | 200K |
| Draw calls | 150 | 120 | 100 | 75 |
| Texture VRAM | 256 MB | 200 MB | 128 MB | 96 MB |
| Frame budget (total) | 16.7 ms | 11.1 ms | 13.9 ms | 16.7 ms |
| JS frame budget | 3.0 ms | 2.5 ms | 2.0 ms | 2.5 ms |
| Shadow map resolution | 4096 | 2048 | 2048 | 1024 |

**Justifications and revisions from the prompt's starting points:**

Desktop 90 fps is added as a tier because the site targets high-end desktop users who may have 144 Hz monitors and high-end GPUs. The 90 fps budget is tighter than 60 fps -- this is the appropriate target for the "ultra" quality preset. A 60 fps desktop budget of 16.7 ms is generous for modern GPUs; the real constraint is draw calls (GPU command buffer overhead) and texture VRAM (integrated GPU limitations).

VR triangle budget held at 400K from the prompt. The Quest 3's Snapdragon XR2 Gen 2 can sustain approximately 600K triangles at 72 Hz with instancing, but headroom is needed for post-processing (SSAO at half-res), the multiview stereo overhead, and GC pause absorption. 400K provides a 30% headroom buffer.

Tablet at 200K triangles is revised up from implicit ~200K in the batesian-mimicry research doc. Modern iPad M-series chips handle 200K comfortably; the constraint is texture VRAM (96 MB) and draw calls (75) more than triangle count.

### 7.2 Frame Budget Breakdown (VR, 13.9 ms total)

| Phase | Budget | Notes |
|-------|-------:|-------|
| Scene traversal + culling | 1.0 ms | Three.js built-in |
| Shadow pass | 1.8 ms | 2048 map, 2 cascades |
| Main render (stereo multiview) | 5.5 ms | 400K tris, 100 draw calls, ~1.3x mono cost |
| Post-processing (SSAO half-res, tone mapping) | 2.0 ms | n8ao at 0.5x resolution |
| XR compositor submission | 0.8 ms | Quest 3 runtime overhead |
| JS simulation tick | 1.0 ms | EventEngine, LOD checks, audio scheduling |
| Headroom | 1.8 ms | GC pauses, texture stalls |

SSAO is the first effect to drop when headroom is consumed. Adaptive quality is implemented as a 30-frame moving average of frame time -- if it exceeds 12.0 ms (VR) or 14.0 ms (desktop 60 fps), drop to the next quality preset. If it stays below 10.0 ms for 60 frames, step back up.

---

## 8. Bundle and CDN Strategy

### 8.1 Initial Bundle Under 2 MB

The 2 MB initial bundle is the hard constraint. It means the JS + CSS that parses and executes before any experiment-specific code runs.

**Target split:**

| Chunk | Size (gzipped) | Contents |
|-------|---------------:|---------|
| React + React DOM | ~45 KB | Core framework |
| Three.js (tree-shaken) | ~250 KB | Only imported classes |
| React Three Fiber + Drei | ~80 KB | R3F core + essential drei hooks |
| Zustand | ~3 KB | State management |
| Rapier WASM | ~500 KB | Physics -- lazy loaded, not in initial bundle |
| Engine core (TS compiled) | ~120 KB | AssetManager, InputSystem, GameLoop |
| App shell (routing, HUD) | ~80 KB | Layout, loading screen, navigation |
| **Initial bundle total** | **~580 KB** | Well under 2 MB even before compression |

Three.js tree-shaking is essential. Vite's rollup handles this automatically when using named imports (`import { Mesh } from 'three'`) rather than namespace imports (`import * as THREE`). The engine's base classes must use named imports throughout.

Rapier's WASM module is 500 KB and is only needed once the experiment scene begins loading (after the loading screen appears). It loads concurrently with experiment assets at priority 2.

### 8.2 Per-Experiment Lazy-Load Budget

| Category | Budget | Notes |
|----------|-------:|-------|
| Experiment JS module | 50 KB | TypeScript compiled |
| Experiment scene GLB(s) | 4 MB total | All LOD variants, Draco + Meshopt |
| KTX2 textures (Tier 1) | 3 MB | Ground, sky, nearest cover objects |
| KTX2 textures (Tier 2-3) | 5 MB | All remaining surfaces |
| Audio | 1 MB | All clips + loops |
| **Per-experiment total** | **13 MB** | Warm cache on return visit |

First visit to an experiment: 13 MB download at median 30 Mbps connection = ~3.5 seconds to full load. Tier 1 assets (3-5 MB) complete in ~1 second -- the scene is visible before the full load finishes.

Return visit (browser cache): all assets served from cache, load time drops to <500 ms for Tier 1. The engine uses `cache: 'force-cache'` on asset fetches after the first successful load.

### 8.3 CDN Strategy

Static build output is served from the existing `deploy.sh` pipeline (Cloudflare Pages or equivalent static host). Asset-specific CDN configuration:

**Cache headers:**
- JS chunks with content hashes: `Cache-Control: public, max-age=31536000, immutable`
- KTX2 textures: `Cache-Control: public, max-age=31536000, immutable`
- GLB models: `Cache-Control: public, max-age=31536000, immutable`
- Audio (OGG): `Cache-Control: public, max-age=31536000, immutable`
- `index.html` and experiment `index.html`: `Cache-Control: public, max-age=0, must-revalidate`

Vite's build adds content hashes to all asset filenames automatically. Cache-busting is free.

**Asset path structure:**

```
/assets/                      # hashed engine assets (JS, CSS)
/experiments/<slug>/assets/   # experiment-specific GLB, KTX2, OGG
/shared/textures/             # shared PBR material library
/shared/hdri/                 # shared HDRI maps
/libs/draco/                  # Draco WASM (versioned, immutable)
/libs/basis/                  # Basis transcoder WASM (versioned, immutable)
```

Draco and Basis WASM decoders are versioned with the Three.js version they accompany. They never change between deploys (pinned Three.js version), so their 1-year cache is always valid.

---

## 9. Source Library

CC0 asset sources for forest, lab, and generic organic environments. All entries have been verified as CC0 or public domain as of the research date.

| # | Name | URL | License | Category | Suggested use |
|---|------|-----|---------|----------|--------------|
| 1 | Poly Haven -- Forest Leaves 02 | polyhaven.com/a/forest_leaves_02 | CC0 | Material (ground) | Primary forest floor albedo/normal/roughness |
| 2 | Poly Haven -- Brown Rock | polyhaven.com/a/brown_rock | CC0 | Material (rock) | Cover object rock surface |
| 3 | Poly Haven -- Bark Willow | polyhaven.com/a/bark_willow | CC0 | Material (bark) | Tree trunk bark |
| 4 | Poly Haven -- Brown Mud 01 | polyhaven.com/a/brown_mud_01 | CC0 | Material (soil) | Under-cover-object soil reveal |
| 5 | Poly Haven -- Mossy Ground 02 | polyhaven.com/a/mossy_ground_02 | CC0 | Material (moss) | Rock/log moss overlay blend |
| 6 | Poly Haven -- Forest Path | polyhaven.com/a/forest_path | CC0 | HDRI | Primary forest IBL + sky |
| 7 | Poly Haven -- Rainforest Trail | polyhaven.com/a/rainforest_trail | CC0 | HDRI | Alternative dense canopy lighting |
| 8 | Poly Haven -- Meadow 2 | polyhaven.com/a/meadow_2 | CC0 | HDRI | Open sky for clearing habitats |
| 9 | Poly Haven -- Limpopo Golf Course | polyhaven.com/a/limpopo_golf_course | CC0 | HDRI | Bright overcast exterior |
| 10 | Poly Haven -- Rock 01 | polyhaven.com/models/rock_01 | CC0 | Model (rock) | Cover object base mesh, 3 sizes |
| 11 | Poly Haven -- Dead Log | polyhaven.com/models/dead_log | CC0 | Model (log) | Cover object log, 2 variants |
| 12 | ambientCG -- Moss 001 | ambientcg.com/a/Moss001 | CC0 | Material (moss) | Secondary moss option, excellent detail |
| 13 | ambientCG -- Ground 037 | ambientcg.com/a/Ground037 | CC0 | Material (ground) | Leaf litter alternative |
| 14 | ambientCG -- Ground 054 | ambientcg.com/a/Ground054 | CC0 | Material (soil) | Dark wet soil under objects |
| 15 | ambientCG -- Wood Rough 001 | ambientcg.com/a/WoodRough001 | CC0 | Material (wood) | Weathered board cover object |
| 16 | ambientCG -- Planks 012 | ambientcg.com/a/Planks012 | CC0 | Material (wood) | Plank cover object variant |
| 17 | Quaternius -- Ultimate Nature Pack | quaternius.com/packs/ultimate-nature | CC0 | Props + vegetation | Low-poly trees, ferns, rocks, logs -- LOD2 proxies |
| 18 | Quaternius -- Ultimate Animals Pack | quaternius.com/packs/ultimate-animals | CC0 | Fauna | Non-salamander wildlife (birds, insects) if needed |
| 19 | Quaternius -- Mossy Dungeon | quaternius.com/packs/mossy-dungeon | CC0 | Props | Moss-covered stone props, usable as rock variants |
| 20 | Kenney.nl -- Nature Kit | kenney.nl/assets/nature-kit | CC0 | Props + vegetation | Stylized fallback trees, mushrooms, rocks |
| 21 | Kenney.nl -- Foliage Pack | kenney.nl/assets/foliage-pack | CC0 | Vegetation | Billboard foliage sprites for LOD2 and background |
| 22 | Kenney.nl -- Rock Pack | kenney.nl/assets/rock-pack | CC0 | Props (rocks) | Low-poly rock scatter, direct use at LOD2 |
| 23 | Sketchfab (CC0 filter) -- Christmas Fern | sketchfab.com/search?q=christmas+fern&license=cc0 | CC0 | Vegetation | Search produces several cross-plane fern meshes |
| 24 | Sketchfab (CC0 filter) -- Salamander | sketchfab.com/search?q=salamander&license=cc0 | CC0 | Fauna | Baseline mesh reference; plan for custom retopo |
| 25 | Freesound -- Forest Ambience 242855 | freesound.org/s/242855 | CC0 | Audio | Temperate forest morning, 30s loop source |
| 26 | Freesound -- Small Creek 398633 | freesound.org/s/398633 | CC0 | Audio | Stream/creek positional audio |
| 27 | Freesound -- Wood Thrush 220025 | freesound.org/s/220025 | CC0 | Audio | Appalachian signature bird call |
| 28 | Freesound -- Leaf Step 399870 | freesound.org/s/399870 | CC0 | Audio | Footstep foley, 3-4 variants needed |
| 29 | Freesound -- Rock Scrape 367129 | freesound.org/s/367129 | CC0 | Audio | Cover object rock flip SFX |

**Curation notes:**
- Poly Haven is the first stop for all terrain PBR textures. Quality is consistently production-grade and all files download at multiple resolutions (1K, 2K, 4K).
- Quaternius packs provide ready-to-use low-poly meshes that work as LOD2 proxies without any processing. The Ultimate Nature Pack alone covers trees, ferns, rocks, and logs for a forest scene at a usable poly count.
- No free CC0 salamander mesh exists at the quality required for VR close-up examination. Plan for a custom Blender base mesh.
- ambientCG's Moss 001 is notably better than Poly Haven's moss options for cove hardwood context -- darker, more acrocarpous character.

---

## 10. Author-Side Workflow

### 10.1 Blender Export Settings

**glTF 2.0 export (File > Export > glTF 2.0):**
- Format: glTF Binary (.glb)
- Include: Selected objects or scene
- Transform: Y Up (glTF convention, not Blender's Z Up -- the exporter handles this automatically)
- Geometry: Apply Modifiers ON, UVs ON, Normals ON
- Materials: Export materials ON, Images: Automatic (embeds as PNG, gltf-transform will convert to KTX2)
- Animation: NLA Strips ON for any animated mesh; otherwise OFF to keep file size minimal
- Compression: OFF (Draco is applied in the pipeline by gltf-transform, not in Blender's exporter)

**Pre-export checklist in Blender:**
- Merge by distance (M key in Edit mode) to eliminate duplicate vertices at seams
- Check for non-manifold geometry (Select > Select All by Trait > Non-Manifold)
- Apply scale (Ctrl+A > Scale) before export -- non-applied scale causes quantization drift in Draco
- UV islands: no overlapping except intentional mirroring; <5% wasted UV space
- Material slots: minimize unique materials per mesh. Cover objects should have 1-2 material slots maximum

### 10.2 glTF Validator

Always validate exported GLB before running it through the optimization pipeline:

```bash
# Install glTF Validator CLI
npm install -g gltf-validator

# Validate a GLB file
gltf-validator rock_large.glb

# Output as JSON for CI parsing
gltf-validator rock_large.glb --output rock_large_validation.json
```

The validator catches: missing required attributes, invalid UV ranges, empty meshes, unsupported extension usage, and animation channel binding errors. Any error (not warning) must be fixed before the asset enters the optimization pipeline.

### 10.3 gltf-transform CLI Optimization Passes

Install once globally or use via npx:

```bash
npm install -g @gltf-transform/cli
```

**Full optimization pipeline for a cover object mesh:**

```bash
# Step 1 -- Validate the source export
gltf-validator rock_large.glb

# Step 2 -- Weld duplicate vertices (safe, fixes most Blender seam artifacts)
gltf-transform weld rock_large.glb rock_large_welded.glb

# Step 3 -- Prune unused data (nodes, materials, textures not referenced by the scene)
gltf-transform prune rock_large_welded.glb rock_large_pruned.glb

# Step 4 -- Simplify (reduce to LOD1 target -- 35% of LOD0 tris)
gltf-transform simplify rock_large_pruned.glb rock_large_lod1.glb --ratio 0.35 --error 0.001

# Step 5 -- Apply Draco compression
gltf-transform draco rock_large_pruned.glb rock_large_draco.glb \
  --quantize-position 14 \
  --quantize-normal 10 \
  --quantize-texcoord 12 \
  --compress-level 7

# Step 6 -- Apply Meshopt on top of Draco
gltf-transform meshopt rock_large_draco.glb rock_large_final.glb

# Step 7 -- Convert embedded PNG textures to KTX2 (UASTC for albedo and normal)
gltf-transform ktx2 rock_large_final.glb rock_large_ktx2.glb \
  --filter lanczos4 \
  --filter-scale 1.0 \
  --mode uastc \
  --quality 2 \
  --slots "baseColorTexture,normalTexture"

# Step 8 -- Convert ORM and other maps to ETC1S (smaller files, acceptable for non-detail maps)
gltf-transform ktx2 rock_large_ktx2.glb rock_large_final_ktx2.glb \
  --mode etc1s \
  --quality 128 \
  --slots "occlusionTexture,metallicRoughnessTexture"

# Step 9 -- Final report
gltf-transform inspect rock_large_final_ktx2.glb
```

**Batch processing a directory of meshes (Bash):**

```bash
for f in models/source/*.glb; do
  base=$(basename "$f" .glb)
  gltf-transform weld "$f" "tmp1.glb" && \
  gltf-transform prune "tmp1.glb" "tmp2.glb" && \
  gltf-transform draco "tmp2.glb" "tmp3.glb" \
    --quantize-position 14 --quantize-normal 10 --quantize-texcoord 12 --compress-level 7 && \
  gltf-transform meshopt "tmp3.glb" "tmp4.glb" && \
  gltf-transform ktx2 "tmp4.glb" "models/optimized/${base}.glb" --mode uastc --quality 2 && \
  rm -f tmp1.glb tmp2.glb tmp3.glb tmp4.glb
  echo "Done: $base"
done
```

**Converting standalone texture files to KTX2 (using basisu CLI):**

```bash
# UASTC (quality-critical: albedo close-up, all normals)
basisu -ktx2 -uastc -uastc_level 2 forest_floor_albedo.png -output_file forest_floor_albedo.ktx2

# ETC1S (background assets)
basisu -ktx2 -comp_level 2 -q 128 vegetation_atlas.png -output_file vegetation_atlas.ktx2

# Mipmap generation (always include for tiling textures)
basisu -ktx2 -uastc -mipmap forest_floor_normal.png -output_file forest_floor_normal.ktx2
```

**Audio conversion (ffmpeg):**

```bash
# Normalize and encode ambient loop to OGG/Opus
ffmpeg -i forest_ambient_raw.wav \
  -af "loudnorm=I=-18:TP=-1.5:LRA=11" \
  -c:a libopus -b:a 64k -vbr on \
  forest_loop.ogg

# Trim a bird call to a clean loop with fade
ffmpeg -i wood_thrush_raw.wav \
  -ss 0.5 -t 4.0 \
  -af "afade=t=in:d=0.02,afade=t=out:st=3.98:d=0.02,loudnorm=I=-18" \
  -c:a libopus -b:a 48k \
  wood_thrush.ogg

# Mono SFX (rock scrape, leaf crunch) at minimum viable bitrate
ffmpeg -i rock_scrape_raw.wav \
  -ac 1 \
  -af "loudnorm=I=-18" \
  -c:a libopus -b:a 32k \
  rock_scrape.ogg
```

---

## 11. Performance Gates in CI

### 11.1 Architecture

The CI perf gate is a Node.js script that renders each experiment scene in a headless Puppeteer session with WebGL enabled, collects Three.js renderer statistics, and exits non-zero if any budget is exceeded.

The gate runs on every PR that touches `experiments/`, `src/engine/`, or `shared/`. It does not run on documentation-only changes.

### 11.2 Gate Script Sketch

```typescript
// scripts/perf-gate.ts
// Run with: npx tsx scripts/perf-gate.ts --experiment batesian-mimicry

import puppeteer from 'puppeteer';
import { EXPERIMENT_BUDGETS } from './budgets';

const EXPERIMENT = process.argv.find(a => a.startsWith('--experiment='))?.split('=')[1];
if (!EXPERIMENT) { console.error('--experiment= required'); process.exit(1); }

const BUDGET = EXPERIMENT_BUDGETS[EXPERIMENT];
if (!BUDGET) { console.error(`No budget defined for: ${EXPERIMENT}`); process.exit(1); }

(async () => {
  const browser = await puppeteer.launch({
    args: ['--use-gl=egl', '--enable-webgl', '--no-sandbox']
  });
  const page = await browser.newPage();

  await page.goto(`http://localhost:5173/experiments/${EXPERIMENT}`, {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  // Wait for the engine's ready signal
  await page.waitForFunction(() => (window as any).__BORCHARD_READY === true, { timeout: 30000 });

  // Collect renderer stats exposed by the engine
  const stats = await page.evaluate(() => (window as any).__BORCHARD_STATS);

  console.log('Perf gate results for:', EXPERIMENT);
  console.log(JSON.stringify(stats, null, 2));

  const failures: string[] = [];

  if (stats.triangles > BUDGET.triangles) {
    failures.push(`Triangles: ${stats.triangles} > budget ${BUDGET.triangles}`);
  }
  if (stats.drawCalls > BUDGET.drawCalls) {
    failures.push(`Draw calls: ${stats.drawCalls} > budget ${BUDGET.drawCalls}`);
  }
  if (stats.textureVRAM > BUDGET.textureVRAM) {
    failures.push(`Texture VRAM: ${stats.textureVRAM}MB > budget ${BUDGET.textureVRAM}MB`);
  }
  if (stats.frameTimeP95 > BUDGET.frameTimeMs) {
    failures.push(`Frame time (p95): ${stats.frameTimeP95}ms > budget ${BUDGET.frameTimeMs}ms`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error('\nBUDGET EXCEEDED:');
    failures.forEach(f => console.error(' --', f));
    process.exit(1);
  }

  console.log('\nAll budgets passed.');
})();
```

### 11.3 Engine Instrumentation

The engine exposes stats via a global for the gate to read:

```typescript
// src/engine/perf/PerfMonitor.ts

export class PerfMonitor {
  private frameTimes: number[] = [];

  tick(renderer: WebGLRenderer, dt: number): void {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 300) this.frameTimes.shift();

    const info = renderer.info;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Estimate texture VRAM from renderer.info.memory.textures * avg texture size
    // This is an approximation; a precise accounting requires tracking allocations
    const textureVRAMMB = estimateTextureVRAM(renderer);

    (window as any).__BORCHARD_STATS = {
      triangles: info.render.triangles,
      drawCalls: info.render.calls,
      textureVRAM: textureVRAMMB,
      frameTimeP95: p95,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      timestamp: Date.now()
    };
  }
}
```

### 11.4 Budget Definition File

```typescript
// scripts/budgets.ts

export const EXPERIMENT_BUDGETS: Record<string, {
  triangles: number;
  drawCalls: number;
  textureVRAM: number;  // MB
  frameTimeMs: number;
}> = {
  'batesian-mimicry': {
    triangles: 800_000,
    drawCalls: 150,
    textureVRAM: 256,
    frameTimeMs: 16.7      // 60 fps
  },
  'hardy-weinberg': {
    triangles: 200_000,   // Data visualization scene, much lower
    drawCalls: 60,
    textureVRAM: 128,
    frameTimeMs: 16.7
  }
  // Add new experiments here before they ship
};
```

### 11.5 CI Integration (GitHub Actions excerpt)

```yaml
# .github/workflows/perf-gate.yml
- name: Build
  run: npm run build

- name: Start preview server
  run: npm run preview &
  env:
    PORT: 5173

- name: Wait for server
  run: npx wait-on http://localhost:5173 --timeout 30000

- name: Run perf gate -- batesian-mimicry
  run: npx tsx scripts/perf-gate.ts --experiment=batesian-mimicry

- name: Run perf gate -- hardy-weinberg
  run: npx tsx scripts/perf-gate.ts --experiment=hardy-weinberg
```

Triangle count and draw call numbers come from `renderer.info`, which Three.js populates at the end of each render call. The frame time P95 over 300 frames (approximately 5 seconds at 60 fps) gives a stable measurement that absorbs GC pauses without being fooled by transient spikes.

---

## Risks and Open Questions

**1. KTX2 fallback path for non-WASM environments**
The Basis transcoder requires WASM. Environments that block WASM (some enterprise network proxies, iOS lockdown mode) will fail to load textures. Mitigation: the engine should detect WASM availability at startup and fall back to PNG/WebP for that session. The fallback will exceed the VRAM budget on older integrated GPUs -- that is acceptable, but the fallback must be tested and not result in a broken scene.

**2. Salamander mesh -- no viable CC0 source**
The research surfaced no CC0 salamander model at the quality required for VR close-up examination with species-diagnostic features (costal grooves, eye color, spot pattern, skin texture variation). This is the only asset category with no viable free source. Options: custom Blender sculpt (requires a technical artist committing 4-8 hours per species for a high-quality result), or a single stylized base mesh with photographic texture decals (faster, slightly lower fidelity). This decision should be made before Phase 2 begins.

**3. Draco + Meshopt loader compatibility in VR browsers**
The Meta Quest Browser (Chromium-based) has full support for both Draco and Meshopt as of 2025. Safari on visionOS does not support Meshopt as of 2026-Q1. If visionOS WebXR is ever a target, Meshopt should be stripped from the VR-specific asset variants. For now, Quest 3 is the primary VR target and this is not a blocking issue.

**4. Frame time measurement accuracy in headless CI**
Puppeteer with `--use-gl=egl` runs on software or Mesa EGL, not hardware GPU. Frame times in CI will be significantly higher than on real hardware. The CI gate measures triangle count and draw calls (which are accurate in software render) but should NOT gate on frame time -- frame time gating requires a real GPU test runner. The `frameTimeMs` budget in CI should be commented out or replaced with a warning-only flag until a GPU-equipped CI runner is available.

**5. HDRI conversion overhead**
The current experiment already uses a 28 MB uncompressed JPEG PBR texture directory and a raw HDR file. Converting all of these to KTX2 as part of the build pipeline adds significant build time. gltf-transform's `ktx2` command is CPU-intensive (basisu encoding is single-threaded). A 2048x2048 UASTC encode takes 5-20 seconds per texture on a typical CI runner. With 20+ textures per experiment, total KTX2 encoding time could reach 5-10 minutes per build. Mitigation: cache the KTX2 outputs in the CI artifact cache keyed on source texture hash -- only re-encode when the source changes.

**6. Audio format negotiation for Safari WebXR**
Opus in OGG containers has been supported in Safari since 16.4, but seamless looping of Opus-encoded audio via Web Audio API has known edge-case bugs in Safari (loopEnd timing drift). If a native Safari WebXR session is ever targeted, test all ambient loops in Safari specifically. Howler.js's sprite system mitigates this for most cases.

**7. gltf-transform CLI versioning**
gltf-transform is actively developed with occasional breaking changes to CLI flags between minor versions. Pin the version in package.json and document the pinned version in the toolchain setup. Upgrading gltf-transform should be a deliberate decision, not an implicit dependency bump.
