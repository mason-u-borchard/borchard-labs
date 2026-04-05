# VR-Ready Photorealistic Simulation -- Design Document

---

## 1. Technology

Three.js r170 from CDN via import map. WebXR for VR. No npm, no bundler.

```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
}}
</script>
```

Key addons: PointerLockControls, VRButton, GLTFLoader, DRACOLoader, RGBELoader,
XRControllerModelFactory, EffectComposer, RenderPass, OutputPass, SAOPass.

---

## 2. Scene Graph

```
Scene
├── TerrainGroup
│   ├── GroundMesh (PlaneGeometry 60x60, 256x256 subdivs, FBM displacement)
│   ├── StreamMesh (curved plane, animated UVs, reflective material)
│   └── RockFormations (InstancedMesh, 30-50 decorative)
├── VegetationGroup
│   ├── TreeInstances (InstancedMesh, 5-8 trunks, LOD x3)
│   ├── CanopyPlane (alpha-cutout leaf clusters at 25-30m)
│   ├── FernInstances (InstancedMesh, cross-billboard, 40-80)
│   ├── RhododendronClusters (8-15, alpha-cut leaves)
│   └── GroundCover (scattered herb/leaf sprites, 50-100)
├── CoverObjectGroup
│   ├── Rock meshes (LOD x3, 3 size variants)
│   ├── Log meshes (LOD x3, 2 variants)
│   ├── Board meshes
│   └── Bark meshes
├── AnimalGroup
│   └── SalamanderMesh (1 GLTF base + morph targets + canvas textures)
├── LightingGroup
│   ├── DirectionalLight (sun, shadow maps 2048, PCFSoft)
│   ├── HemisphereLight (sky #B4C8D8 / ground #6B5B47)
│   └── AmbientLight (fill, low intensity)
├── AtmosphereGroup
│   ├── FogExp2 (density ~0.015)
│   ├── DustParticles (Points, 200-500)
│   ├── FallingLeaves (Sprites, 5-10)
│   └── StreamMist (animated alpha planes)
├── PlayerRig (Group)
│   ├── Camera (PerspectiveCamera, FOV 60)
│   ├── LeftController (XR)
│   ├── RightController (XR)
│   └── TeleportArc (Line)
└── UIGroup (world-space panels for VR)
    ├── IDPanel (ThreeMeshUI or canvas-texture plane)
    ├── NotebookPanel
    └── HUDPanel
```

---

## 3. Renderer Setup

```javascript
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
```

---

## 4. Lighting

| Light | Type | Color | Intensity | Shadows |
|-------|------|-------|-----------|---------|
| Sun | DirectionalLight | #FFF5E0 | 1.5 | 2048x2048, cascaded |
| Sky fill | HemisphereLight | sky #B4C8D8, ground #6B5B47 | 0.6 | -- |
| Ambient | AmbientLight | #404040 | 0.3 | -- |

Sun position: 45deg elevation, SSE azimuth (morning May light).
Shadow camera: orthographic, -20 to 20 on each axis, near 0.5, far 80.
Fog: FogExp2, color #B4C8D8, density 0.015 (trees at 40m are hazy).

Canopy dapple: cookie texture on the directional light (alpha map of leaf
silhouettes), OR actual canopy geometry casting real shadows.

---

## 5. Materials (PBR)

| Surface | Roughness | Metalness | Texture Source |
|---------|-----------|-----------|----------------|
| Leaf litter | 0.90 | 0.0 | Poly Haven `leaves_forest_ground` 2K |
| Wet soil | 0.35 | 0.0 | ambientCG `Ground037` 1K |
| Rock | 0.75 | 0.0 | Poly Haven `rock_face` 1K |
| Moss | 0.95 | 0.0 | ambientCG `Moss001` 1K |
| Log bark | 0.85 | 0.0 | Poly Haven `bark_brown_02` 1K |
| Board | 0.60 | 0.0 | ambientCG `WoodRough001` 1K |
| Tree trunk | 0.85 | 0.0 | Poly Haven `bark_willow` 1K |
| Fern | 0.40 | 0.0 | Alpha-cutout, procedural green |
| Stream water | 0.05 | 0.10 | Env map reflection |

All textures: albedo (WebP) + normal (PNG) + ORM packed (roughness in G, AO in R).
HDRI for IBL: Poly Haven `mossy_forest` 4K.

---

## 6. Salamander Models

**Approach:** 1 GLTF base mesh + 4 morph targets + 8 canvas-rendered texture sets.

**Base mesh:** ~5K triangles, UV-unwrapped, spine + 4 limbs. Built in Blender or
procedurally via TubeGeometry along CatmullRomCurve3.

**Morph targets:**
| Target | Effect | Species |
|--------|--------|---------|
| headLarge | Scale head to 0.22 ratio | NOVI |
| headSmall | Scale head to 0.16 ratio | PSRU |
| tailLong | Extend tail to 0.52 ratio | EUBI |
| tailKeeled | Compress tail laterally, add dorsal ridge | NOVI, DEFU, DEMO, GYPO |

**Per-species textures** (Canvas 512x256 -> THREE.CanvasTexture):
- Paint base color from config.js species.color.body
- Overlay species-specific patterns (bordered-rows, scattered, flecked, etc.)
- Generate normal map: stippled bumps for NOVI (granular), smooth for plethodontids
- Individual variation: hue/sat offsets from config.js bodyRange/satRange

**Key diagnostic features in 3D:**
- Costal grooves: geometry displacement on trunk edge loops (count from config)
- Eye: sphere mesh with emissive iris material (gold #C9A832 for PSRU, dark for others)
- Tail shape: morph target (keeled vs round cross-section)
- Skin texture: normal map (granular stipple vs smooth)

**Animation:** transform-based (no skeleton needed for POC)
- Breathing: scale.y oscillation at 0.5Hz
- Found response: species-specific (freeze, coil, crawl, escape) from config behavior data

---

## 7. Interaction

### Desktop
- PointerLockControls: WASD walk (2m/s), Shift crouch (camera Y 1.65 -> 0.85m)
- Mouse look, click to interact (raycast from screen center, 3m range)
- Cover object highlight: emissive rim on hover
- Flip: click -> auto-crouch camera animation -> cover rotates 90deg over 600ms
- Examine animal: OrbitControls locked to animal, mouse-drag orbits, scroll zooms
- ID panel: HTML slide-in from right (370px)
- Notebook: HTML panel at bottom

### VR (WebXR)
- Teleport: left trigger, parabolic arc, 8m max range, fade-to-black transition
- Snap-turn: left thumbstick, 30deg increments
- Flip: grip on cover object, lift hand -> object follows (displacement-driven rotation)
- Examine: grip animal -> attaches to controller palm, rotate hand to see all sides
- ID panel: world-space ThreeMeshUI panel 0.8m ahead at chest height
- Notebook: world-space clipboard panel
- Controller ray: white line from right controller, dot cursor on panels

### Unified InputManager
```
InputManager {
    constructor(renderer, camera, scene)
    getInteractionRay()    // camera center (desktop) or controller (VR)
    onSelect(callback)     // click or trigger
    onGrip(callback)       // grip button (VR) or Shift+click (desktop)
    isVR()                 // in XR session?
    update()               // per-frame update
}
```

---

## 8. Performance Budget

| Category | Triangles | Draw Calls | Notes |
|----------|----------|------------|-------|
| Terrain | 65K | 3 | Ground + stream + rock scatter |
| Vegetation | 100K | 15 | Instanced trees, ferns, rhodo, cover |
| Cover objects (40) | 22K | 7 | LOD mix: 5 at LOD0, 10 LOD1, 25 LOD2 |
| Salamander | 5K | 2 | 1-2 visible at a time |
| Atmosphere | 1K | 3 | Particles, mist |
| **Total** | **~193K** | **~30** | Well under 500K / 100 limits |

Frame time target: 13.8ms (72fps VR), 16.7ms (60fps desktop).
GPU texture memory: ~62MB with KTX2 compression.
Initial download: 12-16MB. Full load: 18-22MB.

Fallback order if frame budget tight: drop SAO -> reduce shadow res -> reduce vegetation -> force LOD2 on distant objects.

---

## 9. Asset Sources (all CC0)

| Asset | Source | Format | Size |
|-------|--------|--------|------|
| HDRI sky | Poly Haven `mossy_forest` | HDR -> compressed | ~4MB |
| Forest floor PBR | Poly Haven `leaves_forest_ground` | 2K WebP+PNG | ~3MB |
| Soil PBR | ambientCG `Ground037` | 1K | ~1MB |
| Rock PBR | Poly Haven `rock_face` | 1K | ~1MB |
| Bark PBR | Poly Haven `bark_brown_02` | 1K | ~1MB |
| Moss PBR | ambientCG `Moss001` | 1K | ~0.8MB |
| Wood PBR | ambientCG `WoodRough001` | 1K | ~0.8MB |
| Ambient forest audio | Freesound (CC0) | OGG ~128kbps | ~500KB |
| Interaction sounds (5) | Freesound (CC0) | OGG | ~100KB total |
| Salamander GLTF | Custom (Blender or procedural) | GLB+Draco | ~200KB |

---

## 10. File Structure

```
sim/experiments/batesian-mimicry/
  3d/
    main.js                   -- entry point, scene init, render loop
    SceneBuilder.js           -- terrain, vegetation, lighting, fog, sky
    CoverObject3D.js          -- 3D cover object meshes, flip animation
    SalamanderRenderer.js     -- mesh generation, canvas textures, animation
    InputManager.js           -- unified VR + desktop input
    DesktopControls.js        -- PointerLock WASD, mouse interaction
    VRControls.js             -- teleport, snap-turn, grip interaction
    AssetLoader.js            -- texture/model/audio loading with progress
    AudioManager.js           -- Web Audio + PositionalAudio
    UIManager.js              -- world-space VR panels + desktop HTML overlays
  assets/
    textures/                 -- PBR texture sets (downloaded from sources above)
    models/                   -- salamander.glb, cover object GLBs if needed
    audio/                    -- ambient loop, interaction sounds
    hdri/                     -- environment map

  # KEPT UNCHANGED:
  config.js
  EventEngine.js
  WeatherSystem.js
  FieldNotebook.js
  FieldSetup.js
  AnalysisPanel.js
  IdentificationChallenge.js  -- modified for VR panel mode
```

---

## 11. Integration Contract

The 3D layer reads from existing simulation modules:

| Module | API Used | When |
|--------|----------|------|
| FieldSetup | `getValues()` via onStart callback | Survey config |
| WeatherSystem | `getCurrentConditions()`, `getDescription()` | Lighting/fog/audio |
| EventEngine | `generateEncounter(coverObj)` | On flip |
| config.js | SPECIES, COLORS, encounter tables | Asset generation |
| FieldNotebook | `openEntryForm()`, `onSave()`, `download()` | Data recording |
| AnalysisPanel | `load(data)`, `mount()` | Post-survey |
| IdentificationChallenge | `show()`, `onSubmit()`, `getAccuracyStats()` | Species ID |

Data flows ONE direction: simulation logic produces state, 3D layer reads it.
The 3D layer never modifies EventEngine probabilities or FieldNotebook format.

---

## 12. Loading Sequence

1. Show loading screen (HTML overlay with progress bar)
2. **Tier 1** (~4MB): ground texture + HDRI sky -> render ground + sky immediately
3. **Tier 2** (~4MB): cover object meshes/textures + salamander GLTF + all species textures
4. **Tier 3** (~4MB): tree/fern/rhodo instances + bark/moss textures
5. **Tier 4** (~2MB): audio files, particle textures, post-processing setup
6. Hide loading screen, fade in scene, enable controls
7. Begin survey (FieldSetup config screen or auto-start)

---

## 13. Implementation Order

### Layer 1: Foundation (parallel agents)
- `main.js` -- renderer, camera, scene, render loop, VRButton
- `AssetLoader.js` -- LoadingManager, texture/GLTF/audio loading
- `InputManager.js` -- unified input abstraction
- `DesktopControls.js` -- PointerLock WASD
- `VRControls.js` -- teleport, snap-turn, grip

### Layer 2: Environment (parallel after Layer 1)
- `SceneBuilder.js` -- terrain mesh, displacement, PBR materials, trees, ferns,
  canopy, lighting, fog, sky HDRI, atmospheric particles

### Layer 3: Interactive Objects (after Layer 2)
- `CoverObject3D.js` -- 3D meshes placed from config, rim highlight, flip animation,
  soil reveal mesh, invertebrate decals

### Layer 4: Animals (after Layer 3)
- `SalamanderRenderer.js` -- GLTF loading or procedural mesh, canvas texture
  generation per species, morph targets, eye geometry, animation, in-hand VR attach

### Layer 5: UI (after Layer 4)
- `UIManager.js` -- world-space VR panels (ThreeMeshUI or canvas-to-texture),
  desktop HTML overlays, wire to FieldNotebook + IdentificationChallenge + AnalysisPanel

### Layer 6: Polish
- `AudioManager.js` -- ambient loop, positional stream audio, interaction sounds
- Post-processing (SAO, bloom, vignette)
- Loading screen with progress
- Performance profiling, LOD tuning, draw call optimization
- Quest 3 testing if available

---

## 14. HTML Page Updates

`experiments/batesian-mimicry/index.html` needs:
- Import map in `<head>` for Three.js CDN
- Replace current `<script type="module">` bootstrap with 3D entry point
- Keep FieldSetup as the config screen (it's HTML, works as-is)
- Canvas element created by Three.js renderer (replaces the engine's canvas)
- Overlay containers for desktop HTML panels (notebook, ID challenge)
