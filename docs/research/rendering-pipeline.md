# Rendering Pipeline -- Visual Quality Research

**Date:** 2026-04-28
**Author:** Borchard Labs -- Graphics Engineering

---

## Executive Summary

The recommended pipeline is a WebGL2 renderer (Three.js r170+) with AgX tone mapping,
linear-to-sRGB color workflow, a single directional sun paired with HDRI-based IBL,
cascaded shadow maps at three cascades, and a pmndrs/postprocessing chain ordered as:
N8AO screen-space ambient occlusion -> bloom -> depth of field -> vignette -> chromatic
aberration -> LUT color grade -> SMAA. WebGPU is promising but not yet safe for production
deployment given Safari's partial support and Firefox's experimental status as of Q1 2026.
The entire post chain, vegetation wind shader, and IBL bake happen inside the standard
Three.js PBR pipeline (MeshStandardMaterial / MeshPhysicalMaterial), keeping the
material library consistent and portable across every experiment. Quality presets from
"low" through "ultra" are driven by a single Zustand settings store so the renderer
adjusts at runtime without a page reload.

---

## 1. Renderer Setup

### 1.1 WebGL2 vs WebGPU -- Browser Support Reality (April 2026)

WebGL2 is universally available across Chrome, Firefox, Safari, and all Chromium-based
browsers. iOS 15+ ships full WebGL2 support. Quest 3 ships Chromium 110+ with WebGL2.

WebGPU is available behind a flag or in limited release:
- Chrome stable: enabled by default since Chrome 113 (mid-2023), solid on Windows/macOS/Android.
- Firefox: experimental only behind `dom.webgpu.enabled`. Not production-safe.
- Safari: partial, unreliable -- WebGPU landed in Safari 17 but MRT and compute
  have known gaps that affect postprocessing stacks.
- Quest 3 browser: no WebGPU as of Q1 2026.

**Recommendation: ship on WebGL2.** WebGPU can be introduced as a renderer swap in a
future sprint once Firefox and Safari reach parity. Three.js's WebGPURenderer exists but
is not yet a drop-in replacement for the full postprocessing + custom shader ecosystem.
Revisit at Chrome 130+ / Firefox 130+ milestones.

Three.js renderer config:

```typescript
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,        // SMAA handles AA in post; native AA wastes fill rate
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: false, // not needed; adds cost
  alpha: false,
  stencil: false,          // disable unless a specific effect requires it
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);

// Linear output -- postprocessing writes sRGB itself
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;  // tone mapping lives in post chain
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;             // manual reset for perf stats
```

### 1.2 Tone Mapping -- AgX vs ACESFilmic

**Recommendation: AgX.**

ACESFilmic was the right call in 2020--2023. Its orange-teal bias and aggressive shoulder
cause oversaturated highlights in organic forest environments. AgX (merged into Three.js
as `THREE.AgXToneMapping` in r162) produces more neutral highlight rolloff, preserves
green/brown hues in foliage, and better matches the look of Firewatch and Outer Wilds --
the reference tone targets for this project.

For any experiment that runs indoors or under artificial light, `THREE.LinearToneMapping`
at exposure 1.0 with a warm LUT is the cleaner path than ACESFilmic.

AgX exposure control in the settings store:

```typescript
// In the post chain EffectComposer, ToneMappingEffect from pmndrs/postprocessing
// handles this more flexibly than renderer.toneMapping
import { ToneMappingEffect, ToneMappingMode } from 'postprocessing';

const toneMappingEffect = new ToneMappingEffect({
  mode: ToneMappingMode.AGX,
  resolution: 256,
  whitePoint: 4.0,        // raise for very bright outdoor scenes
  middleGrey: 0.6,
  minLuminance: 0.01,
  averageLuminance: 0.01,
  adaptationRate: 0.0,    // disable auto-exposure; handle in settings
});
```

### 1.3 Color Space -- Linear Workflow, sRGB Output

All textures loaded via Three.js loaders should set `colorSpace = THREE.SRGBColorSpace`
on albedo maps and `colorSpace = THREE.LinearSRGBColorSpace` on normal/roughness/AO maps.
The KTX2 + Basis Universal loader handles this automatically from the baked metadata in
the KTX2 container.

The EffectComposer from pmndrs/postprocessing writes directly to the canvas in sRGB.
Do not set `renderer.outputColorSpace = THREE.SRGBColorSpace` when using this composer --
it will double-convert.

```typescript
import { EffectComposer, RenderPass } from 'postprocessing';

const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType,  // HDR internal buffer; important for bloom
});
composer.addPass(new RenderPass(scene, camera));
```

---

## 2. Lighting Model

### 2.1 Directional Sun + IBL

**Sun (DirectionalLight):**
- Color: `#FFF5E0` (warm white, morning/midday), `#FFD580` (golden hour)
- Intensity: 3.5 for full sun, 1.0 for overcast
- Shadow camera frustum: fit tightly to the playable area to maximize shadow texel density

**HDRI IBL:**
- Use Poly Haven HDRI (CC0) loaded via `PMREMGenerator` at runtime
- Indoor/cave experiments swap to a neutral studio HDRI or a baked irradiance probe
- HDRI drives both diffuse irradiance (`scene.environment`) and specular reflections

```typescript
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

new RGBELoader().load('/assets/env/forest-morning.hdr', (tex) => {
  const envMap = pmrem.fromEquirectangular(tex).texture;
  scene.environment = envMap;
  scene.background = envMap;  // swap for sky shader in outdoor scenes
  tex.dispose();
  pmrem.dispose();
});
```

Recommended Poly Haven HDRIs for the forest scene:
- `forest_slope` -- dappled light through trees, green-amber cast
- `autumn_field_puresky` -- golden overcast, useful for weather transitions
- `kloppenheim_06` -- dramatic sun angle, good for late afternoon

**Hemisphere fill light:**
- Sky color: `#B4C8D8` (diffuse blue sky)
- Ground color: `#6B5B47` (warm earth bounce)
- Intensity: 0.6 (complements the HDRI; avoid doubling up too much)

### 2.2 Shadow Strategy

**Cascaded Shadow Maps (CSM):**

Three.js does not ship CSM natively, but `three-stdlib` and the community CSM helper
(`three-csm`) both provide a working implementation. The recommended approach is the
`CSM` class from `three-csm` (npm: `three-csm`).

Configuration for a 60m-radius outdoor scene:

```typescript
import CSM from 'three-csm';

const csm = new CSM({
  maxFar: camera.far,
  cascades: 3,
  shadowMapSize: 2048,    // per cascade; reduce to 1024 on low preset
  lightDirection: new THREE.Vector3(-0.5, -1, -0.5).normalize(),
  camera,
  parent: scene,
  lightIntensity: 3.5,
  lightColor: new THREE.Color('#FFF5E0'),
  fade: true,             // smooth cascade transitions
});

// Must call in the render loop
csm.update();

// Apply to all standard materials that receive shadows
csm.setupMaterial(forestFloorMaterial);
csm.setupMaterial(barkMaterial);
```

Cascade distances (tuned for the batesian mimicry forest scene, ~40m visible radius):
- Cascade 0: 0--5m (high detail -- where the player is crouching and examining)
- Cascade 1: 5--20m (medium detail -- nearby trees and cover objects)
- Cascade 2: 20--60m (coarse -- distant canopy, atmosphere only)

**Contact Shadows:**

Use `drei`'s `<ContactShadows>` component beneath movable objects (cover objects, picked-
up animals) for grounded, believable contact. This is a cheap screen-space approximation
that runs separately from the CSM shadows.

```typescript
// Inside R3F JSX
<ContactShadows
  position={[0, 0.01, 0]}
  opacity={0.6}
  scale={10}
  blur={2}
  far={4}
  resolution={512}
/>
```

**Ambient Occlusion:** handled in post (see Section 3 -- N8AO).

### 2.3 PBR Material Discipline

All scene materials use `MeshStandardMaterial` (metalness-roughness workflow) unless
physics glass or multilayer effects require `MeshPhysicalMaterial`. Rules:

- `metalness`: 0.0 for all organic/rock/wood materials. 1.0 for bare metal fixtures.
  No intermediate values on non-metals -- physically wrong and breaks IBL.
- `roughness`: driven by texture, never a flat scalar (except as a fallback).
- `normalScale`: 1.0 default; dial down to 0.6--0.8 on wet surfaces.
- Emissive: only for bioluminescent organisms, UI elements, fireflies. Never as a
  substitute for missing lighting.
- Double-sided: only on alpha-tested foliage. Costs fill rate on everything else.

---

## 3. Post-Processing Chain

### 3.1 Effect Order and Parameters

All effects use `pmndrs/postprocessing` v7+ (compatible with Three.js r162+).
The composer processes passes left to right:

```
RenderPass
  -> N8AOPass          (SSAO -- runs before tone mapping to work in linear space)
  -> EffectPass [
       BloomEffect,
       DepthOfFieldEffect,
       VignetteEffect,
       ChromaticAberrationEffect,
       LUTEffect,
       ToneMappingEffect (AgX),
       SMAAEffect
     ]
```

N8AO runs as its own separate pass because it writes to a separate AO buffer that
gets blended into the color buffer before the EffectPass reads it.

**N8AO -- Screen-Space Ambient Occlusion:**

N8AO (the `n8ao` package, not to be confused with the SSAO in three-stdlib) is the
recommended SSAO implementation. It is significantly cheaper than GTAO on mid-range
iGPUs and produces better results than Three.js's bundled SSAO.

```typescript
import { N8AOPass } from 'n8ao';

const n8aoPass = new N8AOPass(scene, camera, width, height);
n8aoPass.configuration.aoRadius = 0.8;
n8aoPass.configuration.distanceFalloff = 1.0;
n8aoPass.configuration.intensity = 2.0;
n8aoPass.configuration.color = new THREE.Color(0, 0, 0);
n8aoPass.configuration.aoSamples = 16;           // 8 on low preset
n8aoPass.configuration.denoiseSamples = 4;
n8aoPass.configuration.halfRes = false;           // true on low/medium preset
composer.addPass(n8aoPass);
```

**Bloom:**

Luminance-threshold bloom targeting only specular highlights and emissive surfaces.
Keep it subtle -- the forest scenes should not glow.

```typescript
import { BloomEffect, KernelSize } from 'postprocessing';

new BloomEffect({
  luminanceThreshold: 0.9,
  luminanceSmoothing: 0.025,
  intensity: 0.4,
  kernelSize: KernelSize.MEDIUM,
  mipmapBlur: true,
});
```

**Depth of Field:**

Off by default; enabled when the player enters examination mode (crouching beside a
cover object, examining a salamander). Uses Bokeh DOF (BokehEffect) not the cheaper
blur-only variant.

```typescript
import { DepthOfFieldEffect } from 'postprocessing';

new DepthOfFieldEffect(camera, {
  focalLength: 0.048,
  bokehScale: 2.0,
  height: 480,
});
// Drive focalLength and focus distance via animation when entering examination mode
```

**Vignette:**

Subtle -- darkens frame edges to focus attention.

```typescript
import { VignetteEffect, BlendFunction } from 'postprocessing';

new VignetteEffect({
  offset: 0.35,
  darkness: 0.55,
  blendFunction: BlendFunction.NORMAL,
});
```

**Chromatic Aberration:**

Very subtle. Increases slightly on weather transitions (rain) and examination mode to
suggest lens distortion. Disable on low preset.

```typescript
import { ChromaticAberrationEffect } from 'postprocessing';

new ChromaticAberrationEffect({
  offset: new THREE.Vector2(0.0008, 0.0008),
  radialModulation: true,
  modulationOffset: 0.15,
});
```

**LUT Color Grade:**

A 3D LUT (.cube or .png) applied after tone mapping for the final grade. The forest
experiments should use a warm, slightly desaturated "film print" grade. Export from
DaVinci Resolve or download from Lutify.me (free tier) and convert to Three.js PNG
format with the `@loaders.gl/textures` CLI.

```typescript
import { LUTEffect } from 'postprocessing';
import { LUT3dlLoader } from 'three/examples/jsm/loaders/LUT3dlLoader.js';

// At load time:
const lut = await new LUT3dlLoader().loadAsync('/assets/luts/forest-warm.3dl');
const lutEffect = new LUTEffect(lut.texture3D);
lutEffect.tetrahedralInterpolation = true;
```

**SMAA -- Anti-aliasing:**

SMAA at "HIGH" quality preset handles the final AA pass. TAA is available in pmndrs/
postprocessing but introduces ghosting on animated foliage and moving objects; avoid for
now. On ultra preset, combine SMAA with TAA for static regions.

```typescript
import { SMAAEffect, SMAAPreset } from 'postprocessing';

new SMAAEffect({
  preset: SMAAPreset.HIGH,
});
```

### 3.2 Frame Budget Per Effect

Target platform for this budget: mid-range desktop with integrated GPU (Intel Iris Xe,
Apple M2 GPU tier), 1080p, 60fps (16.67ms budget per frame).

| Pass / Effect           | ms (iGPU, 1080p) | ms (dGPU, 1080p) | Notes                              |
|-------------------------|-----------------|------------------|------------------------------------|
| Scene render + shadows  | 5.5             | 2.0              | 3 CSM cascades, 800K triangles     |
| N8AO (16 samples)       | 2.5             | 0.8              | half-res on medium saves ~1ms      |
| Bloom                   | 0.8             | 0.3              | mipmap chain                       |
| Depth of Field          | 1.0             | 0.4              | only active in examination mode    |
| Vignette                | 0.1             | 0.05             | trivial                            |
| Chromatic aberration    | 0.1             | 0.05             | trivial                            |
| LUT color grade         | 0.3             | 0.15             | 3D texture sample                  |
| Tone mapping (AgX)      | 0.2             | 0.1              | bundled in EffectPass              |
| SMAA                    | 0.5             | 0.2              | HIGH preset                        |
| JS tick + physics       | 1.0             | 1.0              | simulation logic, Rapier step      |
| **Total (DOF off)**     | **11.0**        | **4.6**          | 60fps achievable on iGPU           |
| **Total (DOF on)**      | **12.0**        | **5.0**          | still within 16.67ms               |
| **Total (VR, 72fps)**   | vs 13.8ms limit | --               | see VR section below               |

VR notes: On Quest 3 (Snapdragon XR2 Gen 2), the scene render alone targets 8ms.
Drop N8AO to half-res (saves ~1ms), disable DOF, disable chromatic aberration. Bloom
at TINY kernel. Target 13ms, leaving 0.8ms headroom for async reprojection.

---

## 4. Atmospheric Effects

### 4.1 Volumetric Fog Approximation

True volumetric fog (ray-marched) is too expensive for the iGPU target. Use the
following layered approximation:

**Exponential height fog** via Three.js `FogExp2`:

```typescript
scene.fog = new THREE.FogExp2(0xB4C8D8, 0.018);
// Density 0.018 causes noticeable haze at ~40m; trees disappear around 60m
// Increase to 0.035 for rainy weather
```

**Low-lying ground mist (sprite-based):**

Spawn 30--50 billboarded plane sprites with a soft noise texture, placed at ground
level near the stream. Animate opacity with a slow sin wave + perlin noise. Keep
alpha test at 0.05 to avoid excessive overdraw.

```glsl
// Fragment shader for mist sprite
uniform sampler2D tNoise;
uniform float uTime;

void main() {
  vec2 uv = vUv;
  float noise = texture2D(tNoise, uv + uTime * 0.01).r;
  float alpha = noise * 0.35;
  gl_FragColor = vec4(vec3(0.78, 0.83, 0.88), alpha);
  if (alpha < 0.03) discard;
}
```

**Depth-haze layer:** a full-screen quad with depth-based exponential blend toward the
fog color. The built-in Three.js fog handles per-vertex fog for opaque geometry; this
shader handles transparent/particle geometry that the fog uniform misses.

### 4.2 God Rays (Crepuscular Rays)

Implemented as a post-processing pass using the `GodRaysEffect` from pmndrs/postprocessing.
Point it at the sun disc mesh (a small emissive MeshBasicMaterial sphere placed at the
directional light's position projected to the far plane).

```typescript
import { GodRaysEffect, KernelSize } from 'postprocessing';

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffeecc })
);
// Position at directional light's effective position on the far plane

const godRays = new GodRaysEffect(camera, sunMesh, {
  resolutionScale: 0.5,
  density: 0.92,
  decay: 0.92,
  weight: 0.3,
  kernelSize: KernelSize.SMALL,
});
```

Only enable when the sun is visible (not occluded by the canopy mesh). Gate with a
simple ray-against-canopy check each frame. Disable god rays on the low and medium
quality presets.

### 4.3 Particle Dust

Dust motes in sunbeam columns. Implemented with a custom `Points` object inside the
beam frustum. 500 points maximum, slow brownian drift in the vertex shader.

```glsl
// Vertex shader for dust motes
uniform float uTime;
attribute vec3 aVelocity;

void main() {
  vec3 pos = position + aVelocity * uTime;
  // Wrap within a bounding box
  pos = mod(pos + 5.0, 10.0) - 5.0;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = 2.0 * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
```

Opacity modulated by proximity to the sun shaft direction. Discard fragments outside
the shaft cone in the fragment shader.

---

## 5. Material Library

All materials are defined in a shared TypeScript module at `src/engine/materials/library.ts`.
Experiments import named materials; they never construct raw `MeshStandardMaterial` inline.

### Naming Convention

`mat_<surface>_<variant>` -- e.g. `mat_bark_oak`, `mat_water_stream`.

### Curated Material Set

| Name                | Roughness | Metalness | Texture Set             | Special                     |
|---------------------|-----------|-----------|-------------------------|-----------------------------|
| `mat_forest_floor`  | 0.95      | 0.0       | albedo/normal/rough/AO  | Tiled 2m repeat, 2K         |
| `mat_rock_sandstone`| 0.80      | 0.0       | albedo/normal/rough/AO  | Triplanar UV on irregular geo|
| `mat_rock_shale`    | 0.75      | 0.0       | albedo/normal/rough/AO  | Lichen decal overlay         |
| `mat_bark_oak`      | 0.88      | 0.0       | albedo/normal/rough/AO  | Vertical UV flow             |
| `mat_bark_poplar`   | 0.82      | 0.0       | albedo/normal/rough/AO  | Lighter albedo               |
| `mat_moss`          | 0.97      | 0.0       | albedo/normal/rough     | SSS approximation, bright G  |
| `mat_soil_wet`      | 0.40      | 0.0       | albedo/normal/rough/AO  | normalScale 0.5 (wet sheen)  |
| `mat_soil_dry`      | 0.78      | 0.0       | albedo/normal/rough/AO  |                              |
| `mat_water_stream`  | 0.05      | 0.1       | normal (flow animated)  | MeshPhysicalMaterial, refract|
| `mat_water_pond`    | 0.02      | 0.1       | normal (slow drift)     | reflection plane             |
| `mat_glass_lab`     | 0.05      | 0.0       | --                      | MeshPhysicalMaterial, ior 1.5|
| `mat_metal_aged`    | 0.65      | 1.0       | albedo/normal/rough     | oxidation color overlay      |
| `mat_metal_clean`   | 0.15      | 1.0       | rough                   | anisotropy 0.3               |
| `mat_fabric_canvas` | 0.85      | 0.0       | albedo/normal/rough     | field notebook cover         |
| `mat_parchment`     | 0.82      | 0.0       | albedo/normal           | matches `--parchment` token  |
| `mat_lab_counter`   | 0.45      | 0.0       | albedo/rough            | epoxy resin surface          |

### Sample Material Definition

```typescript
// src/engine/materials/library.ts

import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

export interface MaterialConfig {
  name: string;
  roughness: number;
  metalness: number;
  normalScale?: [number, number];
  side?: THREE.Side;
}

export function buildForestFloor(textures: {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: textures.map,
    normalMap: textures.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: textures.roughnessMap,
    roughness: 1.0,         // driven fully by texture
    metalnessMap: undefined,
    metalness: 0.0,
    aoMap: textures.aoMap,
    aoMapIntensity: 0.8,
    envMapIntensity: 0.6,
  });

  // Tile at 2m world-space repeat on a 40m terrain
  [textures.map, textures.normalMap, textures.roughnessMap, textures.aoMap].forEach((t) => {
    t.colorSpace = t === textures.map ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20);   // 40m / 2m per tile
    t.anisotropy = 16;
  });

  return mat;
}

export function buildWetSoil(textures: {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: textures.map,
    normalMap: textures.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), // subdued normal -- wet and flat
    roughnessMap: textures.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    aoMap: textures.aoMap,
    aoMapIntensity: 0.6,
    envMapIntensity: 1.2,    // stronger envmap reflection on wet surface
  });
  return mat;
}

export function buildStreamWater(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x2a4a5a),
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.85,
    thickness: 0.3,
    ior: 1.33,               // water IOR
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.5,
  });
  return mat;
}

export function buildGlass(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xc8dde0),
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.95,
    thickness: 0.4,
    ior: 1.5,
    transparent: true,
    opacity: 0.1,
    envMapIntensity: 1.0,
  });
}
```

Texture sources (all CC0 via Poly Haven and ambientCG):
- Forest floor: `Poly Haven -- forest_floor_2` (4K source, downsample to 2K)
- Rock sandstone: `ambientCG -- Rock035` (2K)
- Oak bark: `Poly Haven -- bark_brown_02` (2K)
- Moss: `ambientCG -- Ground037` (1K for close detail, 512 for instances)
- Wet soil: `Poly Haven -- brown_mud_02` (1K; high contrast normal)

---

## 6. Vegetation Strategy

### 6.1 Instancing

All repeated vegetation (trees, ferns, grass blades, fallen leaves, small rocks)
uses `THREE.InstancedMesh`. One draw call per species per LOD level.

```typescript
const fernGeo = await gltfLoader.loadAsync('/assets/models/fern_hi.glb');
const fernMesh = new THREE.InstancedMesh(
  fernGeo.scene.children[0].geometry,
  fernMaterial,
  300        // max instances per scene
);
fernMesh.castShadow = true;
fernMesh.receiveShadow = true;

// Scatter via halton sequence for good distribution without clustering
for (let i = 0; i < 300; i++) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(halton(i, 2) * 40 - 20, 0, halton(i, 3) * 40 - 20),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0)),
    new THREE.Vector3(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4)
  );
  fernMesh.setMatrixAt(i, m);
}
fernMesh.instanceMatrix.needsUpdate = true;
```

### 6.2 Wind Shader

Applied to all foliage materials via `onBeforeCompile`. The vertex shader reads a
world-space position and applies a sinusoidal displacement driven by a uniform `uTime`
and `uWindStrength` (modulated by WeatherSystem).

```glsl
// Injected into the standard vertex shader via onBeforeCompile
uniform float uTime;
uniform float uWindStrength;

// Insert before #include <project_vertex>
float windNoise = sin(worldPosition.x * 0.5 + uTime * 1.2)
                * cos(worldPosition.z * 0.4 + uTime * 0.9);
float heightFactor = clamp(position.y / 1.5, 0.0, 1.0); // sway more at tips
vec3 windDisplacement = vec3(
  windNoise * 0.08 * uWindStrength * heightFactor,
  0.0,
  windNoise * 0.05 * uWindStrength * heightFactor
);
transformed += windDisplacement;
```

The wind shader is added to `mat_bark_*` and all foliage materials but NOT to
`mat_forest_floor` or static rock materials.

### 6.3 Alpha-Tested Foliage

Foliage (fern fronds, leaf clusters) uses `alphaTest: 0.5` with
`depthWrite: true` to avoid the transparent sort problem. Render order:
1. All opaque geometry
2. Alpha-tested foliage (still writes depth, sorts fine with alpha test)
3. Transparent meshes (water, mist sprites, glass) -- these still need back-to-front sorting

`THREE.DoubleSide` only on foliage. Never set `depthWrite: false` on alpha-tested
meshes that cast shadows -- it will break the shadow maps.

Shadow cast on alpha-tested foliage requires `MeshDepthMaterial` with
`alphaTest` set on the shadow material override:

```typescript
fernMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  alphaTest: 0.5,
  map: fernAlbedoTexture,
});
```

---

## 7. Water Rendering

### 7.1 Reflective + Refractive Stream

The stream surface uses `MeshPhysicalMaterial` with `transmission` for refraction.
Reflection comes from the scene's HDRI environment map plus a local `CubeCamera` for
real-time reflections (30fps update rate, not every frame).

For the batesian mimicry forest scene, the stream is a narrow channel with a gentle
flow. A flow map drives the normal map UV animation so the water appears to move
downstream.

```typescript
// Stream water with flow-mapped normals
const streamMat = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0x2a4a5a),
  roughness: 0.05,
  metalness: 0.1,
  transmission: 0.85,
  thickness: 0.3,
  ior: 1.33,
  transparent: true,
  opacity: 0.92,
  normalMap: waterNormalTexture,
  envMapIntensity: 1.5,
});

// Animate UV in the tick loop (flow direction: +Z downstream)
streamMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uFlowSpeed = { value: 0.04 };
  shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
  // inject UV offset in vertex shader
};
```

For higher quality at ultra preset: use `three-stdlib`'s `Water` object, which provides
a proper reflection FBO and Fresnel-based blending. It is heavier (one extra render pass)
and disabled below ultra preset.

### 7.2 Flow Map

A hand-painted flow map (RG channels = UV direction) drives dual-sampled normal map
blending. The technique avoids seam artifacts on directional water.

```glsl
// Fragment shader snippet for flow-mapped water normal
uniform sampler2D tFlowMap;
uniform sampler2D tNormal;
uniform float uTime;

vec2 flow = texture2D(tFlowMap, vUv).rg * 2.0 - 1.0;
float phase0 = fract(uTime * 0.2);
float phase1 = fract(uTime * 0.2 + 0.5);

vec3 normal0 = texture2D(tNormal, vUv + flow * phase0).rgb;
vec3 normal1 = texture2D(tNormal, vUv + flow * phase1).rgb;
float blend = abs(phase0 * 2.0 - 1.0);
vec3 flowNormal = mix(normal0, normal1, blend);
```

---

## 8. Sky System

### 8.1 Hybrid Approach -- Recommended

**Sky shader for sun disc, color gradient, and time-of-day cycle.** HDRI for IBL.
These are decoupled:

- The procedural `Sky` shader (`three-stdlib`'s `Sky` class, ported from three.js examples)
  renders the visible atmosphere dome. It provides a physically plausible Rayleigh +
  Mie scatter model. No HDRI visible in the background.
- The HDRI environment map is applied only to `scene.environment` (IBL), not
  `scene.background`. The sky shader mesh occupies `scene.background` visually.

This hybrid avoids the HDRI horizon seam on ground-level cameras and allows full
control over sun position via `SunCalc` or a custom time-of-day store.

```typescript
import { Sky } from 'three-stdlib';

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 4;        // 2=clear, 10=hazy
skyUniforms['rayleigh'].value = 0.8;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

// Sun position (elevation 45deg, azimuth 160deg = south-southeast)
const phi = THREE.MathUtils.degToRad(90 - 45);
const theta = THREE.MathUtils.degToRad(160);
const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
skyUniforms['sunPosition'].value.copy(sunPosition);

// Keep HDRI in scene.environment for IBL only (background handled by Sky mesh)
```

### 8.2 Weather State

The `WeatherSystem.js` (existing, not modified) drives these uniforms each frame:

| WeatherSystem state | `turbidity` | `rayleigh` | FogExp2 density | Wind strength | AO intensity |
|--------------------|-------------|------------|-----------------|---------------|--------------|
| Clear              | 3           | 0.8        | 0.012           | 0.3           | 2.0          |
| Partly cloudy      | 6           | 1.0        | 0.018           | 0.6           | 1.5          |
| Overcast           | 10          | 1.5        | 0.030           | 0.8           | 1.0          |
| Light rain         | 12          | 2.0        | 0.040           | 1.0           | 0.8          |
| Heavy rain         | 16          | 3.0        | 0.060           | 1.4           | 0.5          |

Day/night cycle is available as a hook but disabled by default in the batesian mimicry
experiment (surveys are conducted during daylight only -- scientifically accurate).
Any future experiment requiring night mode enables the cycle by animating `phi` (sun
elevation) from 0 to PI over a configurable world-day duration.

---

## 9. Reference Shots

### Reference 1 -- Firewatch (Campo Santo, 2016)

**Target shot:** A first-person view looking west through the Wyoming forest at golden
hour. The camera sits at roughly eye level; lodgepole pines recede into an exponential
fog layer. The sky is a warm gradient from deep amber near the horizon to saturated
cobalt at the zenith.

**Lighting qualities to match:**
- Directional sun at 8--12 degrees elevation, 170 degrees azimuth (nearly due south,
  very low angle). Color: `#FF9940`. Intensity: 2.5 -- long shadows stretching toward
  the camera.
- Hemisphere ambient: warm amber top (`#E07830`), muted blue-gray ground (`#3A4050`).
- Fog: exponential, density ~0.01, color `#C08040` -- the fog tints warm because the
  sun is backlighting the haze.

**Post qualities:**
- Bloom is strong (0.8 intensity) on the bright backlit fog and sky.
- Vignette is heavy at the edges (darkness 0.7) -- pulls focus to the painted distance.
- Color grade is warm: yellows pushed toward orange, shadows pushed toward deep purple.
- No chromatic aberration -- clean optics.

**Material qualities:**
- Pine bark is two-tone: bleached gray facing the sun, deep brown on shadow side.
  Roughness 0.9. No specularity.
- Ground is red-orange clay with pine needle scatter. Very rough, 0.95.
- Atmosphere does the heavy lifting; individual material quality is secondary to the
  lighting volume.

**What to steal for Borchard Labs:** the low-sun, warm-fog atmosphere is directly
applicable to the batesian mimicry forest scene during morning surveys. Use the
Firewatch color palette as the "fair weather, morning" state.

---

### Reference 2 -- Three.js Journey Final Project "Haunted House" (Bruno Simon curriculum)

**Target shot:** A small stone cottage at night under a partly cloudy moon. Foreground
is damp grass with visible individual blade specularity. Warm lantern glow spills out
of windows with volumetric god rays through the window frames. Graves in the background
fade into dark exponential fog.

**Lighting qualities to match:**
- Dominant light: point light inside the building, warm orange `#FF8844`, intensity 4,
  decay 2 (physically accurate falloff).
- Moonlight: directional light, color `#8899BB`, intensity 0.3, very long shadows.
- God rays: only from the window -- a tight occlusion mesh blocks the light column.
- Bloom: 1.2 intensity, targeting only the orange window glow and lantern. Strong
  luminance threshold (0.85) so the moonlit grass does not glow.

**Post qualities:**
- Heavy vignette (0.8 darkness) -- almost noir framing.
- Desaturated color grade with boosted contrast -- muted blues and dark blacks.
- Subtle chromatic aberration at the edges: 0.002 offset.
- SMAA at HIGH.

**Material qualities:**
- Stone: `roughness: 0.85`, `metalness: 0.0`, strong normal map with mortar lines.
  Wet patches near the base: `roughness: 0.3` (blended by a vertical gradient mask).
- Grass: alpha-tested blades at `roughness: 0.5`. Slight specularity from moonlight.
- Wood door: `roughness: 0.65`, painted so only the lock hardware has `metalness: 1.0`.

**What to steal for Borchard Labs:** the point light + god ray technique applies directly
to indoor lab scenes and any night-mode experiment. The wet-stone roughness gradient
is the technique to use on the exposed rock undersides when a cover object is flipped
(the underside is shielded from rain and darker, rougher). The bloom threshold discipline
-- tight to only emissive surfaces -- should be the production default.

---

### Reference 3 -- Subnautica (Unknown Worlds, 2018) -- Shallows Biome

**Target shot:** First-person view in the Safe Shallows biome at game dawn. Sunlight
shafts (god rays) penetrate 8m of water to dapple the sand floor. Luminous coral
clusters emit soft bioluminescent teal. Caustic light patterns play across the terrain.

**Lighting qualities to match:**
- Directional light (sun above water): `#B0D8FF`, intensity 2.0. But it is attenuated
  sharply below the water surface -- only 30% reaches the floor.
- Underwater fog: `FogExp2` density 0.05, color `#0A3040` -- objects 10m away are
  barely readable.
- God rays: volumetric shafts from a surface quad, density 0.95, decay 0.9. This is
  the most visually distinctive feature of the scene.
- Emissive coral: `emissiveIntensity: 1.5`, teal `#00FFCC`. Bloom threshold 0.7 to
  catch these highlights.
- Caustics: projected texture animation (a caustic lightmap animated as a decal on
  floor geometry, not ray-traced).

**Post qualities:**
- Bloom is soft and broad -- the underwater light scatter means high-frequency
  highlights are rare; the bloom is low-threshold, low-intensity (0.3), large kernel.
- Color grade: highly desaturated above water, blue-shifted below. The LUT swaps on
  water entry via a smooth blend.
- Depth of Field: constant, mild -- simulates the camera being slightly out of focus
  in the low-visibility water column.
- Chromatic aberration: moderate (0.002), constant -- the in-game fiction is an
  underwater camera with a wide-angle lens.

**Material qualities:**
- Sand: `roughness: 0.90`, fine granular normal map, slight displacement.
- Coral (emissive): `emissiveIntensity: 1.5`, `roughness: 0.7`. The bloom makes the
  emissive intensity feel higher than it is.
- Metal wreckage: `metalness: 1.0`, `roughness: 0.4`, color `#3A4048` (rust-dark).

**What to steal for Borchard Labs:** the god ray implementation is directly applicable
to above-water forest scenes (shafts through canopy gaps). The dual-LUT technique --
swapping color grade based on environment state -- is the right pattern for weather
transitions in the batesian mimicry scene. The emissive + bloom discipline (boost
emissiveIntensity, keep bloom threshold tight) is exactly right for firefly particles
in future night-mode experiments.

---

## 10. Quality Presets

Driven by a settings store (`useSettingsStore`) with a `graphicsPreset` field:
`'low' | 'medium' | 'high' | 'ultra'`. The `applyPreset(preset)` function sets
renderer parameters and recompiles the post chain. No page reload required -- the
EffectComposer rebuilds its pass list at runtime.

### What Each Preset Disables / Enables

| Feature                       | Low          | Medium       | High         | Ultra        |
|-------------------------------|--------------|--------------|--------------|--------------|
| Shadow maps (CSM)             | 1 cascade    | 2 cascades   | 3 cascades   | 3 cascades   |
| Shadow map resolution         | 512          | 1024         | 2048         | 4096         |
| SSAO (N8AO)                   | off          | half-res x8  | full-res x16 | full-res x32 |
| Bloom                         | off          | on           | on           | on           |
| Depth of Field                | off          | off          | examination only | always on |
| Vignette                      | on           | on           | on           | on           |
| Chromatic aberration          | off          | off          | on (subtle)  | on           |
| God rays                      | off          | off          | on           | on           |
| LUT color grade               | off          | on           | on           | on           |
| SMAA AA                       | LOWEST       | MEDIUM       | HIGH         | HIGH + TAA   |
| Foliage wind shader           | off          | on           | on           | on           |
| Foliage instance count        | 50           | 150          | 300          | 500          |
| Mist sprites                  | 0            | 10           | 30           | 50           |
| Dust mote particles           | 0            | 0            | 250          | 500          |
| Water (stream)                | flat color   | flow map     | flow + env   | Water object |
| Sky shader                    | gradient     | Sky shader   | Sky shader   | Sky + HDRI   |
| Texture resolution            | 512          | 1024         | 2048         | 4096         |
| Pixel ratio cap               | 1.0          | 1.5          | 2.0          | device max   |
| Renderer tone mapping         | NoToneMapping| NoToneMapping| NoToneMapping| NoToneMapping|

```typescript
// src/engine/renderer/presets.ts

import { N8AOPass } from 'n8ao';
import { SMAAPreset } from 'postprocessing';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface PresetConfig {
  shadowCascades: number;
  shadowMapSize: number;
  ssao: { enabled: boolean; halfRes: boolean; samples: number };
  bloom: boolean;
  dof: 'off' | 'examination' | 'always';
  godRays: boolean;
  lut: boolean;
  smaaPreset: SMAAPreset;
  chromAberration: boolean;
  foliageCount: number;
  pixelRatioCap: number;
}

export const PRESETS: Record<QualityPreset, PresetConfig> = {
  low: {
    shadowCascades: 1, shadowMapSize: 512,
    ssao: { enabled: false, halfRes: true, samples: 8 },
    bloom: false, dof: 'off', godRays: false, lut: false,
    smaaPreset: SMAAPreset.LOW, chromAberration: false,
    foliageCount: 50, pixelRatioCap: 1.0,
  },
  medium: {
    shadowCascades: 2, shadowMapSize: 1024,
    ssao: { enabled: true, halfRes: true, samples: 8 },
    bloom: true, dof: 'off', godRays: false, lut: true,
    smaaPreset: SMAAPreset.MEDIUM, chromAberration: false,
    foliageCount: 150, pixelRatioCap: 1.5,
  },
  high: {
    shadowCascades: 3, shadowMapSize: 2048,
    ssao: { enabled: true, halfRes: false, samples: 16 },
    bloom: true, dof: 'examination', godRays: true, lut: true,
    smaaPreset: SMAAPreset.HIGH, chromAberration: true,
    foliageCount: 300, pixelRatioCap: 2.0,
  },
  ultra: {
    shadowCascades: 3, shadowMapSize: 4096,
    ssao: { enabled: true, halfRes: false, samples: 32 },
    bloom: true, dof: 'always', godRays: true, lut: true,
    smaaPreset: SMAAPreset.HIGH, chromAberration: true,
    foliageCount: 500, pixelRatioCap: Infinity,
  },
};
```

The settings menu exposes the four named presets. Advanced users can also toggle
individual features (e.g. disable shadows independently of the preset). The
`useSettingsStore` zustrand slice broadcasts changes; a `useEffect` in the `<Renderer>`
component reads the store and calls `applyPreset`.

---

## Risks and Open Questions

**1. N8AO API stability [HIGH]**

N8AO is not a pmndrs first-party package. The API changed between 1.x and 2.x.
Lock the version in `package.json` and test the upgrade path before each engine
version bump. Fallback: use the SSAO effect bundled in pmndrs/postprocessing if
n8ao breaks -- it is slower but always available.

**2. CSM library maintenance [MEDIUM]**

`three-csm` is a community package and has gone dormant at points. The alternative
is `three-stdlib`'s `CSM` which is slightly more maintained but has identical API
surface. Keep an eye on the three.js core roadmap -- there have been PRs to add native
CSM. If native CSM lands in three.js r175+, migrate to it.

**3. AgX tone mapping tuning per experiment [MEDIUM]**

AgX produces a notably different saturation profile from ACESFilmic. Lab scenes with
artificial fluorescent lighting may look wrong with the default AgX whitePoint of 4.0.
Each new experiment's lighting will require a tone mapping audit. Recommend a
`<SceneLightingConfig>` component wrapper that lets experiment authors override
tone mapping mode without touching the engine.

**4. Safari WebGL2 performance [MEDIUM]**

Safari 17 on M-series Macs has good WebGL2 performance. However, Safari has known
bugs with certain framebuffer configurations used by the EffectComposer. The `HalfFloatType`
render target (required for HDR bloom) is confirmed working on Safari 17.4+. Test
thoroughly on Safari 16 (macOS Monterey users still exist) where `HalfFloatType` may
fall back to `UnsignedByteType`, which clips HDR values and breaks bloom.

**5. SMAA + animated foliage ghosting [LOW-MEDIUM]**

SMAA is purely spatial and does not ghost. However, if TAA is enabled on the ultra
preset, wind-animated foliage will ghost along motion vectors. The mitigation is to
write the foliage instances to a motion vector buffer -- complex to implement correctly.
For now, TAA is ultra-only and should be tested carefully against all animated foliage.

**6. Water rendering cost on mobile [HIGH for VR]**

`MeshPhysicalMaterial` with `transmission: true` triggers an extra render pass for
the refraction background. On Quest 3, this is expensive enough to blow the 13.8ms
budget. VR preset must use a flat `MeshStandardMaterial` water with only a flow-mapped
normal -- no transmission. This means the VR water looks less refractive, which is a
deliberate tradeoff.

**7. LUT file licensing [LOW]**

Free LUTs from sites like Lutify.me or Ground Control have varied licenses. Ensure
any bundled LUT is either self-authored, CC0, or explicitly cleared for commercial and
educational use. The safest path is to author a minimal LUT in DaVinci Resolve (free
tier) or use the identity LUT as a starting point.

**8. God rays and sun occlusion detection [LOW]**

The GodRaysEffect points at a sun mesh. If the sun is fully behind the canopy mesh,
the effect should shut off to avoid a visual glitch (rays passing through solid leaves).
A per-frame occlusion ray from camera to sun position tells the pass whether to blend
its weight to zero. This is a cheap raycast but adds JS cost per frame. Implement as
a 4-frame rolling average (not every frame) to smooth transitions.

**9. Color space double-conversion [HIGH -- silent bug risk]**

If `renderer.outputColorSpace` is set to `THREE.SRGBColorSpace` while pmndrs/
postprocessing is active, the sRGB conversion happens twice: once in the effect chain
and once in the renderer's blit. The result is a washed-out image that looks like a
gamma mismatch. This must be caught in a visual regression test. Set `renderer.outputColorSpace`
to `THREE.LinearSRGBColorSpace` and let the composer handle the final conversion.
Document this prominently in the engine setup guide.
