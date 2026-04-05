# Asset Pipeline & Performance Budget -- VR Forest Simulation

**Date:** 2026-04-04
**Author:** Mason Borchard
**Status:** Research / Pre-implementation
**Stack:** Three.js r168+ (CDN), WebXR Device API, no bundler
**Target hardware:** Meta Quest 3 (72 fps stereo), desktop Chrome/Firefox (60 fps)

---

## 1. Asset Inventory

Everything the simulation needs to load, organized by category. Triangle counts are targets for the final optimized mesh, not source geometry.

### 1.1 Environment

| Asset | Variants | Tris (per instance) | Instances | Notes |
|-------|----------|--------------------:|----------:|-------|
| Ground plane | 1 | 2 (quad) | 1 | 20x20m, PBR-textured, subdivide only if vertex displacement is used |
| Tree trunk | 5 | 800--1,200 | 25--40 | Cylinder + root flare + bark displacement via normal map |
| Canopy layer | 1 | 4,000--6,000 | 1 | Billboard clusters or alpha-tested planes arranged in dome |
| Fern | 3 | 300--500 | 40--80 | Cross-plane alpha cutout, 2 intersecting quads per fern |
| Rhododendron | 1 | 1,500--2,500 | 8--15 | Mid-story shrub, alpha-tested leaf clusters on branch armature |
| Fallen branch | 3 | 200--400 | 20--30 | Low-poly cylinder with bark texture |
| Rock scatter | 1 (procedural sizes) | 150--300 | 30--50 | Icosphere deformation, 3 LOD levels |

**Environment total (mid-density):** ~120,000--180,000 tris before LOD. LOD1 halves this; LOD2 quarters it.

### 1.2 Cover Objects (Interactive)

These are the objects the student flips to find salamanders. Higher detail because the player approaches and examines them up close.

| Asset | Variants | Tris (LOD0) | Tris (LOD1) | Tris (LOD2) | Notes |
|-------|----------|------------:|------------:|------------:|-------|
| Rock -- large | 1 | 2,000 | 800 | 200 | ~40 cm diameter, irregular shape |
| Rock -- medium | 1 | 1,200 | 500 | 150 | ~25 cm, rounder |
| Rock -- small | 1 | 600 | 250 | 100 | ~12 cm, cobble |
| Log -- large | 1 | 3,000 | 1,200 | 400 | ~60 cm long, bark, broken end |
| Log -- small | 1 | 1,800 | 700 | 250 | ~35 cm, partial bark loss |
| Board | 1 | 200 | 100 | 50 | Flat plank, thickness via normal map |
| Bark slab | 1 | 400 | 200 | 80 | Curved bark piece, thin geometry |

**Cover objects total (40 objects on transect, LOD0 for nearest 5, LOD1 for 10, LOD2 for rest):**
~22,000 tris typical.

### 1.3 Salamanders

One base mesh shared across all 8 species. Species differentiation is handled entirely through texture swaps (albedo + normal) and uniform-driven parameters (body proportions, tail shape factor).

| Asset | Tris | Notes |
|-------|-----:|-------|
| Salamander base mesh | 4,000--6,000 | Rigged: spine (8 bones), 4 limbs (3 bones each), jaw (1 bone) |
| Salamander LOD1 | 1,500 | Survey-distance rendering |
| Salamander LOD2 | 400 | Far background, billboard fallback |

Only 1--3 salamanders visible at any time. Negligible polygon cost.

**Texture sets per species (8 total):**

| Species | Key | Albedo notes |
|---------|-----|-------------|
| *Notophthalmus viridescens* (eft) | NOVI | Bright orange-red, black-bordered red spots in rows, granular skin |
| *Pseudotriton ruber* | PSRU | Deep red-orange, irregular black spots scattered, smooth skin |
| *Plethodon cinereus* | PLCI | Dark gray dorsum, red or lead-back stripe variant |
| *Plethodon glutinosus* | PLGL | Black with white/silver lateral spots |
| *Desmognathus fuscus* | DEFU | Brown, pale jaw line, dark chevrons |
| *Eurycea bislineata* | EUBI | Yellow-brown with two dark dorsolateral lines |
| *Desmognathus monticola* | DEMO | Gray-brown, dark mottling, pale belly |
| *Gyrinophilus porphyriticus* | GYPO | Salmon-pink, dark reticulated pattern |

Each texture set: albedo (512x256), normal (512x256), roughness embedded in albedo alpha or a shared roughness map.

### 1.4 PBR Texture Sets

Full PBR = albedo + normal + roughness + AO (packed into ORM where possible).

| Surface | Resolution | Tiling | Source strategy |
|---------|-----------|--------|----------------|
| Forest floor (leaf litter + soil) | 2048x2048 | Yes, 2x2 | Primary ground surface, highest res |
| Bare soil (under cover objects) | 1024x1024 | Yes | Revealed when object is flipped |
| Rock surface | 1024x1024 | Yes | Shared across rock scatter + cover rocks |
| Tree bark (generic hardwood) | 1024x1024 | Yes, vertical | Applied to all trunk variants |
| Moss | 512x512 | Yes | Blended on rocks, logs, tree bases |
| Board (weathered wood) | 1024x512 | No | Single plank, non-tiling |
| Salamander skins | 512x256 | No | 8 sets, non-tiling UV islands |
| HDRI skybox | 2048x1024 (equirect) or 6x512 cubemap | No | Forest canopy gap sky, diffuse only |

**Texture memory estimate (uncompressed RGBA):**
- 2K textures (3): ~48 MB
- 1K textures (4): ~16 MB
- 512px textures (9 salamander + 1 moss): ~10 MB
- HDRI: ~8 MB
- **Raw total: ~82 MB** -- KTX2/Basis compression reduces this to ~20--25 MB GPU memory.

### 1.5 Audio

All audio as mono or stereo, 44.1 kHz, stored as .ogg (Vorbis) for size, .mp3 fallback.

| Sound | Duration | Channels | Est. file size | Notes |
|-------|----------|----------|---------------|-------|
| Ambient forest loop | 30s | Stereo | 180--250 KB | Broadband: wind in canopy, distant birds, insect drone |
| Stream/creek | 15s | Mono | 80--120 KB | Positional audio source if stream corridor site |
| Bird call -- wood thrush | 3--5s | Mono | 25--40 KB | Signature Appalachian songbird |
| Bird call -- ovenbird | 2--3s | Mono | 15--25 KB | "Teacher, teacher, teacher" |
| Bird call -- red-eyed vireo | 3--4s | Mono | 20--30 KB | Continuous canopy song |
| Bird call -- Carolina wren | 2--3s | Mono | 15--25 KB | Loud, recognizable |
| Bird call -- pileated woodpecker | 3--5s | Mono | 25--40 KB | Drumming + call |
| Bird call -- tufted titmouse | 2--3s | Mono | 15--20 KB | |
| Bird call -- black-throated blue warbler | 2--3s | Mono | 15--20 KB | |
| Bird call -- generic distant chorus | 5--8s | Mono | 35--50 KB | Background filler |
| Rock scrape (cover lift) | 1--2s | Mono | 10--15 KB | Triggered on rock flip |
| Log roll (cover lift) | 1--2s | Mono | 10--15 KB | Triggered on log flip |
| Board lift | 0.5--1s | Mono | 5--10 KB | Lighter, woody creak |
| Wet soil squish | 0.5s | Mono | 5--8 KB | Under-object reveal |
| Leaf crunch (footstep) | 0.3--0.5s | Mono | 3--5 KB | Player movement, 3--4 variants |

**Audio total: ~600--900 KB** compressed. Negligible.

---

## 2. Free CC0/CC-BY Asset Sources

### 2.1 HDRI Environment Maps

**Source: Poly Haven (polyhaven.com)**

| Asset | Search term / URL | License | Resolution | File size | Modifications needed |
|-------|-------------------|---------|-----------|-----------|---------------------|
| Forest canopy HDRI | "forest" -- try `limpopo_golf_course`, `rainforest_trail`, `meadow_2` | CC0 | Download at 2K (2048x1024) | ~3--5 MB (HDR), ~500 KB (LDR JPG) | Color-correct for Appalachian palette (less tropical), desaturate slightly, adjust exposure. Convert to cubemap faces if using CubeTextureLoader |
| Overcast forest | "cloudy" or "overcast" for weather variants | CC0 | 2K | ~3--5 MB | Blend with primary HDRI for overcast conditions |

**Usage:** Download the .hdr at 2K. Convert to RGBE or use Three.js `RGBELoader` from CDN. For mobile/Quest, pre-convert to LDR cubemap faces (6 x 512px JPGs, ~150 KB total) for `CubeTextureLoader`.

### 2.2 PBR Texture Sets

**Source: Poly Haven (polyhaven.com/textures)**

| Texture | Search term | Specific recommendation | License | Resolution | Size (1K) | Modifications |
|---------|-------------|------------------------|---------|-----------|-----------|--------------|
| Forest floor | "forest floor", "leaves" | `forest_leaves_02`, `forest_leaves_03` | CC0 | Download at 2K | ~4--6 MB set | May need color shift toward Appalachian oak/beech tones (less coniferous) |
| Bare soil | "soil", "dirt" | `brown_mud`, `forest_ground` | CC0 | 1K | ~2--3 MB set | Add moisture variation in roughness map |
| Rock | "rock", "stone" | `rock_face`, `brown_rock` | CC0 | 1K | ~2--3 MB set | Good as-is for Appalachian sandstone/gneiss |
| Tree bark | "bark" | `bark_willow`, `bark_pine` | CC0 | 1K | ~2--3 MB set | Hardwood bark is more furrowed than pine -- may need to blend two sets |

**Source: ambientCG (ambientcg.com)**

| Texture | Search term | Specific recommendation | License | Resolution | Size (1K) | Modifications |
|---------|-------------|------------------------|---------|-----------|-----------|--------------|
| Moss | "moss" | `Moss001`, `Moss002` | CC0 | 512 or 1K | ~1--2 MB set | Excellent moss textures, use directly |
| Weathered wood (board) | "wood planks", "wood rough" | `WoodRough001`, `Planks012` | CC0 | 1K | ~2--3 MB set | Increase roughness, add weathering in albedo |
| Leaf litter alt | "ground forest" | `Ground037`, `Ground048` | CC0 | 2K | ~4--6 MB set | Good fallback if Poly Haven options are too coniferous |
| Soil detail | "soil" | `Ground054` (dark soil) | CC0 | 1K | ~2--3 MB set | Pair with rock for revealed-ground material |

**Download strategy:** Always grab the 1K JPG set (albedo + normal + roughness + AO as separate files). Convert albedo to WebP at quality 85 for ~40% size reduction. Keep normal maps as PNG (lossy compression introduces shading artifacts). Pack roughness + AO into a single ORM texture (R=empty/metalness=0, G=roughness, B=AO) to cut texture binds in half.

### 2.3 3D Models

**Source: Sketchfab (sketchfab.com)**

| Model | Search term | Recommendations | License | Polycount | File size | Modifications |
|-------|-------------|----------------|---------|-----------|-----------|--------------|
| Fern plant | "fern low poly" | Look for cross-plane billboard ferns with alpha textures. Several CC0 fern packs exist | CC0 / CC-BY | 50--500 tris | ~1--3 MB GLB | Retexture with Appalachian species (Christmas fern, maidenhair). Decimate if over 500 tris |
| Rock set | "rock photoscan", "stone" | Photoscanned rocks by authors like `looppy`, `matousekfoto` | CC0 / CC-BY | 2K--50K tris | ~5--20 MB | Decimate to target counts per LOD. Re-UV and rebake normals if decimation distorts UVs |
| Fallen log | "log forest", "fallen tree" | Look for short log segments, not full trees | CC-BY | 5K--30K tris | ~5--15 MB | Decimate heavily. Strip materials, re-apply PBR bark texture |
| Tree trunk | "tree trunk low poly" | Simple trunk + root geometry, no leaves | CC0 / CC-BY | 1K--5K tris | ~2--8 MB | Remove foliage if included. Canopy is handled separately as billboard planes |
| Rhododendron | "bush", "shrub" | Generic broadleaf shrub, retexture | CC-BY | 1K--5K tris | ~3--8 MB | Difficult to find specific rhododendron -- use any broadleaf evergreen shrub as base, modify leaf shape in texture |

**Source: Poly Haven (polyhaven.com/models)**

| Model | Search | License | Notes |
|-------|--------|---------|-------|
| Rocks | "rock" | CC0 | Poly Haven's photoscanned rocks are excellent. Download the lowest LOD available, further decimate |
| Tree stump | "stump" | CC0 | Useful as cover object variant |

**Salamander mesh:** No CC0 salamander model exists at the quality needed for close-up VR examination with diagnostic features. Build the base mesh in Blender (box-model a generic plethodontid, ~4K tris). UV unwrap with body regions isolated. Bake 8 texture sets from reference photographs. This is the one custom modeling task that cannot be sourced from free libraries.

### 2.4 Audio

**Source: Freesound.org**

| Sound | Search term | Specific recommendations | License | Duration | Size | Modifications |
|-------|-------------|------------------------|---------|----------|------|--------------|
| Forest ambience | "forest ambience", "deciduous forest" | `242855` (temperate forest morning), `531015` (forest birds), `401790` (spring forest) | CC0 | 30--120s | 1--4 MB | Trim to 30s seamless loop. High-pass filter at 60 Hz to remove rumble. Normalize to -18 LUFS |
| Creek/stream | "small stream", "brook" | `398633` (small creek), `365827` (forest stream) | CC0 | 15--60s | 500 KB--2 MB | Trim to 15s loop. Gentle, not whitewater -- this is a cove seep, not a waterfall |
| Wood thrush | "wood thrush" | `220025`, `344697` | CC0 | 3--8s | 30--80 KB | Isolate clean calls, trim silence, normalize |
| Ovenbird | "ovenbird song" | `209635` | CC0 | 3--5s | 20--40 KB | Clean recording of the "teacher" cadence |
| Carolina wren | "carolina wren" | `254439`, `370210` | CC0 | 3--5s | 20--40 KB | Loud and clear, good spatial audio anchor |
| Pileated woodpecker | "pileated woodpecker" | `212769` (drumming), `434981` (call) | CC0 | 3--6s | 30--50 KB | Two clips: drum and call. Distinct enough to place spatially |
| Red-eyed vireo | "vireo" | `332987` | CC0 | 4--6s | 30--40 KB | Continuous singing, good canopy filler |
| Bird chorus (generic) | "dawn chorus forest" | `493595`, `521387` | CC0 | 10--30s | 80--200 KB | Background layer, low in mix |
| Rock scrape | "rock scrape", "stone drag" | `367129`, `456012` | CC0 | 1--2s | 10--20 KB | Short scrape, not metallic. Layer with dirt crumble |
| Log roll | "log roll", "wood thud" | `248716` | CC0 | 1--2s | 10--20 KB | Dull woody thump + slight roll |
| Board lift | "wood creak" | `377142`, `201845` | CC0 | 0.5--1s | 5--10 KB | Creak + light slap as it tilts |
| Wet soil | "mud step", "wet ground" | `372089`, `429164` | CC0 | 0.5s | 5--8 KB | Squelch, not splash |
| Leaf crunch | "leaf step", "dry leaves" | `399870`, `319422` | CC0 | 0.3--0.5s | 3--6 KB | 3--4 variants to avoid repetition |

**Processing pipeline for all audio:**
1. Download as WAV or FLAC from Freesound
2. Trim, normalize to -18 LUFS, fade edges (10ms)
3. Export as .ogg Vorbis at quality 5 (~128 kbps) -- primary format
4. Export .mp3 at 128 kbps -- fallback for Safari/older WebKit
5. Loops: verify seamless loop point using Audacity crossfade
6. Spatial audio clips: export as mono. Ambient beds: stereo is fine

---

## 3. Optimization Pipeline

### 3.1 Texture Optimization

**Format strategy:**

| Texture type | Format | Rationale |
|-------------|--------|-----------|
| Albedo / Diffuse | WebP (lossy, quality 85) | 30--40% smaller than JPG at equal quality. Universal browser support since 2023 |
| Normal maps | PNG (lossless) | Lossy compression introduces per-pixel direction errors that cause visible shading noise. Non-negotiable |
| Roughness | WebP or PNG (8-bit grayscale) | Single channel. Pack into ORM if binding slots are tight |
| AO | WebP or PNG (8-bit grayscale) | Pack into ORM blue channel |
| ORM (packed) | PNG | R=occlusion, G=roughness, B=metalness. Saves one texture bind per material |
| Alpha masks (fern, canopy) | PNG (RGBA) | Alpha channel required, no lossy artifacts on edges |
| HDRI | .hdr (Radiance) or 6x LDR JPG cubemap faces | RGBELoader for desktop, pre-split cubemap for Quest |
| Salamander skins | WebP (lossy, quality 90) | Higher quality for close-up examination view |

**KTX2/Basis Universal:**
Three.js supports KTX2 via `KTX2Loader` + the Basis transcoder WASM module. On Quest 3, this transcodes to ETC1S (ASTC on newer GPUs), giving ~6:1 compression over raw RGBA in GPU memory. Worth the effort for any texture over 512px.

Pipeline: source PNG/WebP --> `basisu` CLI --> .ktx2 file. Load via:
```
const ktx2Loader = new THREE.KTX2Loader()
    .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/libs/basis/')
    .detectSupport(renderer);
```

**Target resolutions (final, after optimization):**

| Surface | Albedo | Normal | ORM |
|---------|--------|--------|-----|
| Ground plane | 2048 | 2048 | 1024 |
| Soil (under objects) | 1024 | 1024 | 512 |
| Rock | 1024 | 1024 | 512 |
| Tree bark | 1024 | 1024 | 512 |
| Moss | 512 | 512 | 256 |
| Board | 1024 | 512 | 512 |
| Fern alpha | 512 | -- | -- |
| Canopy alpha | 1024 | -- | -- |
| Salamander (x8) | 512x256 | 512x256 | 256x128 |
| HDRI | 2048x1024 | -- | -- |

### 3.2 Model Optimization

**GLB with Draco compression:**
All models stored as .glb (binary glTF). Draco mesh compression enabled via `DRACOLoader`:

```
const dracoLoader = new THREE.DRACOLoader()
    .setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/libs/draco/');
const gltfLoader = new THREE.GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
```

Draco settings: quantization bits = 11 for positions, 8 for normals, 10 for UVs. Typical 60--80% reduction in geometry data size.

**Triangle budget by category:**

| Category | Max tris (LOD0, all instances) | Notes |
|----------|-------------------------------:|-------|
| Ground plane | 2 | Single quad |
| Tree trunks (instanced) | 1,200 (1 draw call) | Geometry shared, 30+ instances |
| Canopy | 6,000 | Billboard cluster |
| Ferns (instanced) | 500 (1 draw call) | Cross-plane, 60 instances |
| Rhododendron (instanced) | 2,500 (1 draw call) | 10 instances |
| Rock scatter (instanced) | 300 (1 draw call) | 40 instances |
| Fallen branches (instanced) | 400 (1 draw call) | 25 instances |
| Cover objects (mixed LOD) | 22,000 | LOD0 nearest, LOD2 distant |
| Salamanders | 6,000 | 1--3 active, LOD0 |
| **Scene total** | **~38,900** | Well under 200K ceiling |

Peak total with all LOD0: ~160,000 tris. Typical frame with LOD mix: ~40,000--60,000 tris.

### 3.3 Instancing

`THREE.InstancedMesh` is the primary tool for vegetation and debris. One draw call per mesh type regardless of instance count.

| Mesh type | Instance count | Per-instance data | Draw calls |
|-----------|---------------:|-------------------|--------:|
| Tree trunk (variant A--E) | 6--8 each, 30--40 total | position, rotation, scale, bark hue shift | 5 |
| Fern (variant A--C) | 20--27 each, 60--80 total | position, rotation, scale | 3 |
| Rhododendron | 8--15 | position, rotation, scale | 1 |
| Rock scatter | 30--50 | position, rotation, scale, color tint | 1 |
| Fallen branch (variant A--C) | 7--10 each, 20--30 total | position, rotation | 3 |
| **Total instanced draw calls** | | | **13** |

Per-instance color variation is handled through the instance color attribute (`InstancedMesh.setColorAt()`), driving a small hue/value shift so no two trees look identical.

### 3.4 LOD System

`THREE.LOD` with 3 levels per object type:

| Level | Distance (m) | Geometry | Texture |
|-------|-------------|----------|---------|
| LOD0 | 0--3 | Full detail | Full resolution |
| LOD1 | 3--8 | 40% of LOD0 tris | Half resolution |
| LOD2 | 8--20 | 10% of LOD0 tris | Quarter resolution or atlas |
| Cull | >20 | Not rendered | -- |

Cover objects use LOD aggressively. The student only examines 1 object at a time -- everything beyond ~3m can drop to LOD1 immediately.

For vegetation at LOD2, switch from mesh to camera-facing billboard sprites (single textured quad). The transition distance is far enough that the pop is invisible.

### 3.5 Texture Atlasing

Small textures that share a material type can be packed into a single atlas to reduce texture binds:

| Atlas | Contents | Atlas resolution | Benefit |
|-------|----------|-----------------|---------|
| Vegetation atlas | Fern alpha (x3), rhododendron leaves, canopy planes | 2048x2048 | 5 textures --> 1 bind |
| Debris atlas | Fallen branch bark, small rock diffuse, twig | 1024x1024 | 3 textures --> 1 bind |
| Salamander atlas | All 8 species albedo maps (512x256 each) | 2048x1024 | 8 textures --> 1 bind, UV offset per species |

Atlasing the salamander skins is particularly valuable: the base mesh is shared, so switching species is just a UV offset uniform change -- no material swap, no texture rebind.

### 3.6 Total Asset Size Budget

| Category | Compressed size | Notes |
|----------|---------------:|-------|
| Textures (KTX2) | 8--12 MB | All PBR sets + HDRI + salamander atlas |
| Models (Draco GLB) | 1--2 MB | All geometry including LOD variants |
| Audio (OGG) | 0.6--0.9 MB | All clips + loops |
| Three.js core (CDN) | ~600 KB | Cached across sessions |
| Draco decoder WASM | ~300 KB | Cached |
| Basis transcoder WASM | ~400 KB | Cached |
| **Initial load** | **~12--16 MB** | Under 15 MB target with texture streaming |
| **Full scene loaded** | **~18--22 MB** | After lazy-loaded vegetation + distant audio |

---

## 4. Frame Time Budget

### 4.1 VR Target: 72 fps = 13.89 ms per frame

The Quest 3 runs at 72 Hz native (90 Hz available but 72 is the safe target for WebXR). Every frame renders twice (once per eye). The XR compositor has its own deadline -- if we miss it, the frame is reprojected (ASW/spacewarp), which introduces artifacts and nausea risk.

**Budget breakdown:**

| Phase | Budget (ms) | Notes |
|-------|------------:|-------|
| Scene graph traversal + frustum culling | 0.8--1.0 | Three.js `WebGLRenderer` traverses the scene, tests visibility. 200--300 objects with LOD |
| Shadow pass | 1.5--2.0 | Single directional light, 2048x2048 shadow map, 2 cascades (near + far). No point light shadows |
| Main render pass (per eye) | 3.5--4.5 | ~50,000 tris visible, ~80--100 draw calls. PBR materials. Instanced vegetation |
| Post-processing | 1.0--2.0 | Tone mapping (mandatory for HDR pipeline). Optional: SSAO (half-res), subtle fog |
| XR frame submission | 0.5--1.0 | `renderer.xr` compositing, layer submission to Quest runtime |
| JavaScript logic | 0.5--1.0 | Event engine tick, animation updates, audio scheduling, LOD distance checks |
| **Headroom** | **2.4--3.5** | Buffer for GC pauses, texture upload stalls, unexpected spikes |

**Per-eye cost note:** Three.js WebXR uses multiview rendering when supported (Quest 3 supports it). With multiview, the scene is traversed once and rendered to both eyes in a single pass with ~1.3x the cost of mono, not 2x. The budget above assumes multiview is active.

### 4.2 Desktop Target: 60 fps = 16.67 ms per frame

Desktop has 2.78 ms more headroom per frame and renders mono. The shadow map can be larger (4096), SSAO can run at full resolution, and vegetation density can be higher.

### 4.3 Shadow Configuration

| Parameter | VR value | Desktop value |
|-----------|---------|--------------|
| Shadow map resolution | 2048x2048 | 4096x4096 |
| Cascade count (CSM) | 2 | 3 |
| Cascade split distances | [0, 5, 20] m | [0, 4, 10, 25] m |
| Shadow bias | 0.0005 | 0.0003 |
| Shadow type | `PCFSoftShadowMap` | `PCFSoftShadowMap` |
| Update frequency | Every frame | Every frame |

Cascaded shadow maps via `three/examples/jsm/csm/CSM.js` (CDN). The near cascade covers the 0--5 m zone where the student is examining cover objects -- this is where shadow quality matters most. The far cascade is lower effective resolution but covers the full scene.

### 4.4 Fallback Degradation Order

When frame time exceeds budget, degrade in this order (each step recovers the listed time):

| Priority | Action | Time recovered | Visual impact |
|----------|--------|---------------:|--------------|
| 1 | Disable SSAO | 0.8--1.5 ms | Mild -- ambient occlusion is subtle in a forest with already-dark ground |
| 2 | Reduce shadow map to 1024 | 0.5--1.0 ms | Noticeable softening of shadows but acceptable |
| 3 | Drop shadow cascades from 2 to 1 | 0.3--0.5 ms | Far shadows disappear, near shadows preserved |
| 4 | Reduce vegetation density (skip every other fern/branch instance) | 0.5--1.0 ms | Visible but not simulation-breaking -- forest looks thinner |
| 5 | Force all cover objects to LOD2 except the active one | 0.3--0.5 ms | Minimal -- player is focused on one object at a time |
| 6 | Disable canopy alpha planes, replace with solid color dome | 0.5--0.8 ms | Significant visual downgrade, last resort |
| 7 | Drop to 60 Hz reprojection (VR only) | Halves render budget | Noticeable judder on head movement, but playable for a seated/standing survey |

Implement as an adaptive quality system: measure `renderer.info.render.frame` time over 30 frames, if average exceeds 12 ms (VR) or 14 ms (desktop), step down one level. If average drops below 10 ms (VR) or 12 ms (desktop) for 60 frames, step back up.

### 4.5 Draw Call Budget

| Source | Draw calls |
|--------|----------:|
| Ground plane | 1 |
| Tree trunks (5 variants, instanced) | 5 |
| Canopy | 1 |
| Ferns (3 variants, instanced) | 3 |
| Rhododendron (instanced) | 1 |
| Rock scatter (instanced) | 1 |
| Fallen branches (3 variants, instanced) | 3 |
| Cover objects (7 types x 3 LODs, but only active LOD drawn) | 7--15 |
| Salamanders (1--3 active) | 1--3 |
| Shadow passes (repeat above at lower cost) | ~30 |
| Skybox | 1 |
| Post-processing fullscreen passes | 2--3 |
| **Total** | **~60--80** |

Well within the 100-draw-call budget for Quest 3 WebXR.

---

## 5. Loading Strategy

### 5.1 Loading Screen

A simple Three.js scene with a dark background, the simulation title, and a progress bar. Rendered at native resolution with no post-processing. The progress bar tracks `THREE.LoadingManager` completion percentage.

```
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, loaded, total) => {
    progressBar.style.width = (loaded / total * 100) + '%';
    loadingLabel.textContent = `Loading... ${loaded}/${total}`;
};
loadingManager.onLoad = () => {
    hideLoadingScreen();
    startSimulation();
};
```

### 5.2 Priority Loading Order

Assets are loaded in 4 priority tiers. Each tier completes before the next begins (enforced by chaining promises). Within a tier, all assets load in parallel.

**Tier 1 -- Immediate (blocks scene display, ~3--5 MB):**
1. Ground plane geometry + forest floor PBR textures (2K albedo, normal, ORM)
2. HDRI skybox
3. Soil texture (for under-object reveals)

Once Tier 1 is complete, the scene is renderable -- the student sees ground and sky. Display the scene immediately while Tier 2 loads in the background.

**Tier 2 -- Near objects (~4--6 MB):**
1. Cover object models (all 7 types, all 3 LOD levels)
2. Rock PBR texture
3. Bark PBR texture
4. Board texture
5. Moss texture
6. Cover-object interaction audio (rock scrape, log roll, board lift, wet soil)

**Tier 3 -- Vegetation and atmosphere (~3--5 MB):**
1. Tree trunk models (5 variants)
2. Fern models (3 variants) + vegetation atlas
3. Rhododendron model
4. Fallen branch models (3 variants)
5. Canopy billboard planes
6. Debris atlas texture

**Tier 4 -- Audio and polish (~1--2 MB):**
1. Ambient forest loop (starts playing immediately on load)
2. Stream audio (if stream corridor site)
3. Bird call clips (all 8)
4. Leaf crunch footstep variants

### 5.3 Salamander Texture Preload

All 8 salamander texture sets are loaded during Tier 2 (they are small -- the full atlas is ~2 MB compressed). This avoids a visible texture pop when the student discovers their first salamander. The base salamander mesh loads in Tier 2 as well, though it will not be displayed until an encounter occurs.

Texture loading uses `THREE.TextureLoader` pointed at the local asset directory:

```
const salamanderAtlas = textureLoader.load('assets/textures/salamander_atlas.ktx2');
salamanderAtlas.flipY = false;  // glTF convention
salamanderAtlas.encoding = THREE.sRGBEncoding;
```

### 5.4 Lazy Geometry Generation

Some geometry does not need to be loaded from files -- it can be generated at init:

- **Ground plane:** `THREE.PlaneGeometry(20, 20, 1, 1)` -- trivial
- **Rock scatter:** Deformed icospheres via `THREE.IcosahedronGeometry(1, 1)` with vertex noise -- ~50 rocks generated in <5 ms
- **Canopy dome:** Positioned quads generated from a hemisphere distribution algorithm

This keeps the model download count focused on the complex assets (cover objects, trunks, salamander).

---

## 6. Memory Budget

### 6.1 GPU Texture Memory

Target: stay under 128 MB VRAM for textures. Quest 3 has ~2.5 GB shared memory but WebXR apps share this with the compositor, guardian, and OS.

| Texture category | Count | Dimensions | Format (GPU) | Memory per | Total |
|-----------------|------:|-----------|-------------|----------:|------:|
| Ground albedo | 1 | 2048x2048 | ASTC 4x4 (KTX2) | 2.67 MB | 2.67 MB |
| Ground normal | 1 | 2048x2048 | ASTC 4x4 | 2.67 MB | 2.67 MB |
| Ground ORM | 1 | 1024x1024 | ASTC 4x4 | 0.67 MB | 0.67 MB |
| Soil (albedo+normal+ORM) | 3 | 1024x1024 | ASTC 4x4 | 0.67 MB | 2.0 MB |
| Rock (albedo+normal+ORM) | 3 | 1024x1024 | ASTC 4x4 | 0.67 MB | 2.0 MB |
| Bark (albedo+normal+ORM) | 3 | 1024x1024 | ASTC 4x4 | 0.67 MB | 2.0 MB |
| Moss (albedo+normal+ORM) | 3 | 512x512 | ASTC 4x4 | 0.17 MB | 0.5 MB |
| Board (albedo+normal+ORM) | 3 | 1024x512 | ASTC 4x4 | 0.33 MB | 1.0 MB |
| Vegetation atlas | 1 | 2048x2048 | ASTC 4x4 (RGBA) | 2.67 MB | 2.67 MB |
| Debris atlas | 1 | 1024x1024 | ASTC 4x4 | 0.67 MB | 0.67 MB |
| Salamander atlas | 1 | 2048x1024 | ASTC 4x4 | 1.33 MB | 1.33 MB |
| HDRI cubemap (6 faces) | 6 | 512x512 | RGB8 | 0.75 MB | 0.75 MB |
| **Texture subtotal** | | | | | **~19 MB** |

With KTX2/Basis transcoding to hardware-compressed formats, GPU texture memory lands around **19--25 MB**. Without KTX2 (fallback to raw RGBA), this triples to ~60--75 MB -- still under the 128 MB ceiling but much tighter.

### 6.2 Render Targets

| Target | Resolution | Format | Memory |
|--------|-----------|--------|-------:|
| Shadow map (cascade 0) | 2048x2048 | Depth24 | 16 MB |
| Shadow map (cascade 1) | 2048x2048 | Depth24 | 16 MB |
| SSAO buffer (half-res VR) | 1440x1584 (per eye at 0.5x) | R8 | ~2.3 MB |
| XR framebuffer (Quest 3 native) | 2064x2208 per eye | RGBA8 + Depth24Stencil8 | ~58 MB (managed by browser) |
| **Render target subtotal** | | | **~34 MB** (app-controlled) |

The XR framebuffer is allocated by the browser's WebXR implementation, not by the application. It counts against system memory but is outside direct control.

### 6.3 Geometry Buffers

| Geometry | Vertex count (approx) | Attributes per vertex | Buffer size |
|----------|----------------------:|---------------------:|------------:|
| Ground plane | 4 | pos(12B) + norm(12B) + uv(8B) = 32B | 128 B |
| Tree trunks (5 variants, shared) | 5 x 600 = 3,000 | 32B | 96 KB |
| Instance matrices (40 trees) | 40 | 64B (mat4) | 2.5 KB |
| Cover objects (7 meshes x 3 LODs) | ~8,000 | 32B | 256 KB |
| Ferns (3 variants, shared) | 3 x 200 = 600 | 32B | 19 KB |
| Instance matrices (80 ferns) | 80 | 64B | 5 KB |
| Rhododendron | 1,500 | 32B | 48 KB |
| Rock scatter | 200 | 32B | 6.4 KB |
| Fallen branches (3 variants) | 3 x 300 = 900 | 32B | 29 KB |
| Salamander (1 mesh, 3 LODs) | ~6,000 | 32B + bone weights(16B) = 48B | 288 KB |
| Canopy planes | 2,000 | 32B | 64 KB |
| **Geometry subtotal** | | | **~810 KB** |

Geometry is negligible. The entire scene's vertex data fits in under 1 MB of GPU buffer memory.

### 6.4 Total GPU Memory Estimate

| Category | Budget |
|----------|-------:|
| Textures (KTX2 compressed) | ~22 MB |
| Render targets (shadows + SSAO) | ~34 MB |
| Geometry buffers | ~1 MB |
| Three.js internal (shader programs, UBOs, state) | ~5 MB |
| **Total app-controlled GPU memory** | **~62 MB** |

Comfortable margin under the 128 MB ceiling. Even in the worst case (no KTX2, raw RGBA textures), total would be ~110 MB -- tight but viable.

### 6.5 CPU/JS Heap Memory

| Category | Estimate |
|----------|--------:|
| Three.js scene graph objects | ~2 MB |
| Audio buffers (decoded PCM in memory) | ~8 MB |
| Draco/Basis WASM modules | ~3 MB |
| Simulation state (event engine, notebook, config) | ~1 MB |
| **JS heap total** | **~14 MB** |

---

## 7. Asset Directory Structure

```
sim/experiments/batesian-mimicry/assets/
    models/
        cover/
            rock_large.glb
            rock_medium.glb
            rock_small.glb
            log_large.glb
            log_small.glb
            board.glb
            bark.glb
        environment/
            tree_trunk_a.glb
            tree_trunk_b.glb
            tree_trunk_c.glb
            tree_trunk_d.glb
            tree_trunk_e.glb
            fern_a.glb
            fern_b.glb
            fern_c.glb
            rhododendron.glb
            branch_a.glb
            branch_b.glb
            branch_c.glb
        salamander/
            salamander_base.glb       # rigged mesh, all LODs
    textures/
        ground/
            forest_floor_albedo.webp   # 2K
            forest_floor_normal.png    # 2K
            forest_floor_orm.png       # 1K
            soil_albedo.webp           # 1K
            soil_normal.png            # 1K
            soil_orm.png               # 512
        surfaces/
            rock_albedo.webp           # 1K
            rock_normal.png            # 1K
            rock_orm.png               # 512
            bark_albedo.webp           # 1K
            bark_normal.png            # 1K
            bark_orm.png               # 512
            moss_albedo.webp           # 512
            moss_normal.png            # 512
            moss_orm.png               # 256
            board_albedo.webp          # 1K
            board_normal.png           # 512
            board_orm.png              # 512
        atlas/
            vegetation_atlas.webp      # 2K RGBA
            debris_atlas.webp          # 1K
            salamander_atlas.webp      # 2048x1024
        hdri/
            forest_canopy.hdr          # 2K equirect
            forest_canopy_cubemap/     # fallback: 6 x 512 JPGs
                px.jpg
                nx.jpg
                py.jpg
                ny.jpg
                pz.jpg
                nz.jpg
        ktx2/                          # compressed versions, generated from above
            forest_floor_albedo.ktx2
            forest_floor_normal.ktx2
            ...
    audio/
        ambient/
            forest_loop.ogg
            forest_loop.mp3
            stream.ogg
            stream.mp3
        birds/
            wood_thrush.ogg
            ovenbird.ogg
            carolina_wren.ogg
            pileated_woodpecker_drum.ogg
            pileated_woodpecker_call.ogg
            red_eyed_vireo.ogg
            tufted_titmouse.ogg
            btwb_warbler.ogg
            chorus_generic.ogg
        sfx/
            rock_scrape.ogg
            log_roll.ogg
            board_lift.ogg
            wet_soil.ogg
            leaf_crunch_01.ogg
            leaf_crunch_02.ogg
            leaf_crunch_03.ogg
            leaf_crunch_04.ogg
```

---

## 8. Build & Conversion Scripts

No npm. No Webpack. All conversion is done with standalone CLI tools, run manually or via a Makefile.

**Required tools:**
- `gltf-pipeline` (npm global install or npx) -- Draco compression for GLB files
- `basisu` (Basis Universal CLI) -- KTX2 texture compression
- `cwebp` (from libwebp) -- PNG/JPG to WebP conversion
- `ffmpeg` -- audio format conversion, normalization, trimming
- Blender (CLI mode) -- mesh decimation, LOD generation, UV rebaking

**Example conversion commands:**

```bash
# Compress a GLB with Draco
gltf-pipeline -i rock_large.glb -o rock_large_draco.glb -d --draco.compressionLevel 7

# Convert texture to KTX2 (ETC1S for broadest compatibility)
basisu -ktx2 -comp_level 2 -q 128 forest_floor_albedo.png -output_file forest_floor_albedo.ktx2

# Convert to WebP
cwebp -q 85 forest_floor_albedo.png -o forest_floor_albedo.webp

# Normalize and convert audio to OGG
ffmpeg -i wood_thrush_raw.wav -af "loudnorm=I=-18" -c:a libvorbis -q:a 5 wood_thrush.ogg

# Generate MP3 fallback
ffmpeg -i wood_thrush.ogg -c:a libmp3lame -b:a 128k wood_thrush.mp3

# Trim audio to loop point
ffmpeg -i forest_ambient_raw.wav -ss 0 -t 30 -af "afade=t=in:d=0.01,afade=t=out:st=29.99:d=0.01,loudnorm=I=-18" -c:a libvorbis -q:a 5 forest_loop.ogg
```

---

## 9. Quality Validation Checklist

Before an asset is committed to the project:

- [ ] Triangle count within budget for its category and LOD level
- [ ] UV layout clean -- no overlapping islands (except mirrored geometry), <5% wasted space
- [ ] Normal map bake verified -- no visible seams at UV island boundaries
- [ ] Textures at correct resolution -- not over-sized for their screen coverage
- [ ] KTX2 variant generated and tested in Three.js
- [ ] WebP albedo visually compared against PNG source -- no banding or color shift
- [ ] GLB opens correctly in `gltf-viewer` or Three.js editor
- [ ] Draco-compressed GLB matches uncompressed visually (no vertex quantization artifacts on curved surfaces)
- [ ] Audio normalized to -18 LUFS, no clipping, clean loop points
- [ ] All assets render correctly on Quest 3 browser (test in WebXR immersive-vr session)
- [ ] Frame time measured with `renderer.info` after adding asset -- no single asset addition pushes frame time over budget
- [ ] File size recorded and running total updated against the load budget
