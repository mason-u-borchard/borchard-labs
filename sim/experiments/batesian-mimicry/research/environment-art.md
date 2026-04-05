# Environment Art Direction -- Cove Hardwood Forest

Photorealistic art direction for a Three.js + WebXR rendering of a
southern Appalachian cove hardwood forest. Target month: May. Target
look: BBC *Planet Earth* B-roll -- the camera is low, you can smell the
humus, afternoon light is cutting sideways through tulip poplar canopy.

**Stack:** Three.js r168+, WebXR, PBR (`MeshStandardMaterial` /
`MeshPhysicalMaterial`), postprocessing via `EffectComposer`.

---

## 1. Visual Reference -- Real Cove Hardwood Forests

### 1.1 Light Quality

Cove hardwood light in May is defined by the canopy. Tulip poplars
(*Liriodendron tulipifera*) and northern red oaks (*Quercus rubra*)
form the overstory at 25--35 m. Their leaves are fully out by mid-May
but still thin and translucent -- sunlight passing through them picks
up a warm golden-green cast, not the dense blue-green shade of
midsummer. Direct sun reaches the forest floor only in narrow shafts
where canopy gaps open up. These shafts are warm white (#FFF5E0 to
#FFF0CC), and they shift slowly as branches sway.

The ambient light under full canopy is cool and diffuse -- a mix of
skylight scattered through foliage and green bounce light off the
ground. Shadows are soft-edged and rarely pure black. The overall
sensation is dim but not dark: exposure-wise, about 2--3 stops below
open sky.

Specular highlights are rare on the forest floor. Most surfaces are
matte organic material. The exceptions: wet rock faces after rain, the
glossy upper surface of fresh rhododendron leaves, standing water in
seeps, and the occasional spider web catching a light shaft.

### 1.2 Ground Surface

The ground is not flat. Cove forest floors undulate over buried roots,
decomposing logs, and small rock outcrops. Microrelief varies 15--30 cm
within any square meter. The surface is a compressed stratigraphy:

- **Top layer (Oi horizon):** 3--6" of loose leaf litter. Mixed species
  -- curled tan oak leaves, papery bleached beech leaves, flat brown
  tulip poplar leaves. Twigs and small branches lie at random angles,
  some half-buried. Color palette: khaki, tan, chocolate brown, wet
  cardboard.
- **Middle layer (Oe horizon):** Partially decomposed leaves. Darker
  (umber to chocolate), matted, wet. Fungal hyphae visible as white
  threads when you peel layers apart.
- **Bottom layer (Oa horizon / humus):** Nearly black, crumbly, no
  recognizable plant structure. Moist coffee-grounds texture. Visible
  only where litter has been disturbed or at the edges of cover objects.
- **Mineral soil:** Gray-brown to reddish clay, rarely exposed. Visible
  in animal scrapes, trail cuts, or stream banks.

### 1.3 Rock and Stone

Exposed rock in cove forests is typically sandstone or quartzite -- warm
gray to tan, often with orange-brown iron staining along fracture
planes. Outcrops are low (0.3--1 m above grade), rounded by weathering,
and partially buried in leaf litter. North-facing surfaces are
colonized by crustose lichen (gray-green, pale gray) and patches of
cushion moss. South-facing surfaces are drier, with more bare stone and
occasional foliose lichen (gray-blue rosettes).

### 1.4 Vegetation Layers

- **Canopy (25--35 m):** Tulip poplar, white oak, red oak, red maple,
  American beech. From the forest floor, canopy reads as a continuous
  mosaic of overlapping leaf clusters with irregular gaps.
- **Subcanopy (8--15 m):** Dogwood, sourwood, occasional hemlock.
  Thinner trunks, horizontal branching.
- **Shrub layer (1--4 m):** Rhododendron (*Rhododendron maximum*) forms
  dense evergreen thickets. Leaves are large (15--20 cm), dark glossy
  green above, pale below. Branches twist and interlock.
- **Herb layer (0--0.5 m):** Christmas fern (*Polystichum
  acrostichoides*), New York fern (*Thelypteris noveboracensis*),
  maidenhair fern, Jack-in-the-pulpit, trillium, violets. By May,
  spring ephemerals are finishing and ferns are unfurling.
- **Ground cover:** Mosses (cushion and feather types), liverworts on
  wet rock, occasional patches of partridgeberry.

### 1.5 Water Features

Small first-order streams and seeps are common in coves. Water is
clear, tea-colored to transparent, flowing over a bed of rounded cobbles
and sand. Banks are 15--30 cm cut, exposing dark humus and clay. Moss
and liverwort cover the wet rock faces beside streams. The air near
water is noticeably cooler and more humid -- mist hangs in the channel
on still mornings.

---

## 2. PBR Material Definitions

All materials use the metalness-roughness workflow. Every surface in a
cove forest is a dielectric (metalness = 0) except water, which gets a
small metalness bump for Fresnel. Normal maps are critical for selling
surface detail at close range without burning geometry budget.

### 2.1 Leaf Litter (Oi Horizon)

The primary ground surface. Mixed broadleaf litter in various stages of
curl and color.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Varied: khaki (#C4A E582), tan (#B8A07A), chocolate (#6B4226). Mix via vertex color or blend map. Average luminance ~0.25. Avoid saturated colors -- real litter is muted. |
| Roughness  | **0.90**. Near-Lambertian. Dry, fibrous organic material absorbs light. |
| Metalness  | 0.0                                                        |
| Normal     | High-frequency detail from photogrammetry scan. Captures individual leaf edges, curled tips, vein ridges. Important: leaves overlap at random angles, so the normal map should break up any repeating pattern. |
| AO         | Strong contact shadows in the valleys between overlapping leaves. Darken crevices to near-black. AO is what sells the "depth" of the litter pile. |

### 2.2 Humus (Oa Horizon)

Exposed under lifted cover objects, at trail cuts, and in shallow
scrapes.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Very dark brown to near-black (#2A1F14 to #1A1209). Low luminance (~0.05--0.10). Tiny flecks of lighter material (partially decomposed leaf fragments). |
| Roughness  | **0.85**. Slightly less rough than dry litter because of moisture content -- not reflective, but the surface is smoother and more compressed. |
| Metalness  | 0.0                                                        |
| Normal     | Low-frequency, crumbly surface. Granular rather than fibrous. Think coffee grounds at macro scale. Small pits and clumps. |
| AO         | Moderate. Surface is relatively uniform compared to leaf litter. Darken slightly in compressed areas. |

### 2.3 Wet Soil Under Cover

Soil directly beneath a cover object that has been in contact for weeks
or months. Visibly damp, often with invertebrate trails.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Dark brown-black (#1A1209) when saturated. Moisture darkens soil 30--50% relative to dry humus. Slight sheen visible. |
| Roughness  | **0.30--0.50** (variable). Wet areas drop to 0.30; use a roughness map with noise to vary moisture patchily. This is the key visual cue that the surface is damp. |
| Metalness  | 0.0                                                        |
| Normal     | Similar granular structure to humus but with smooth, smeared areas where the cover object compressed the soil. Invertebrate trails read as faint linear impressions. |
| AO         | Minimal -- this surface is freshly exposed and mostly flat. |

### 2.4 Rock / Sandstone

Exposed outcrops and loose cobbles. Warm gray-tan, weathered.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Warm gray (#9E9585) to tan (#B8A88F). Orange-brown staining (#A0704A) along fracture planes and water tracks. Not uniform -- use a blend of 2--3 tones. |
| Roughness  | **0.70--0.80**. Weathered sandstone is rough but not as fibrous as organic material. Fresh fracture faces would be lower (~0.5) but those are rare on surface-exposed rock. |
| Metalness  | 0.0                                                        |
| Normal     | Coarse grain structure with rounded pits and ridges. Large-scale undulation from weathering (low-freq) plus fine grain texture (high-freq). Layer two normal maps if budget allows. |
| AO         | Strong in crevices, fracture lines, and where rock meets soil. |

### 2.5 Rock with Lichen

Same base as 2.4, with crustose and foliose lichen colonies.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Base rock tone + lichen patches: crustose lichen is gray-green (#8A9A7A) to pale gray (#B0AFA8); foliose lichen forms blue-gray rosettes (#7A8A8F). Lichen coverage typically 20--60% on north-facing surfaces. Use a mask texture to blend. |
| Roughness  | Lichen areas: **0.85--0.95** (very rough, powdery surface). Bare rock areas: 0.70--0.80 as above. Roughness map mirrors the lichen coverage mask. |
| Metalness  | 0.0                                                        |
| Normal     | Lichen adds a thin crusty relief (0.5--1 mm) on top of rock grain. Foliose lichen has curled edges that catch rim light. |
| AO         | Lichen fills crevices and grows in sheltered spots -- AO should be slightly darker around lichen colony edges where they overhang rock. |

### 2.6 Moss

Cushion moss and feather moss on rocks, logs, and tree bases.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Wet: bright chartreuse (#7FBF3A). Moist: rich emerald (#3A7A2E). Dry: muted olive (#6B7A4A). Choose based on scene wetness state. By May after spring rains, lean toward the moist palette. |
| Roughness  | **0.95**. Moss is about as rough as surfaces get -- the tiny leaf structures scatter light in all directions. Almost zero specular. |
| Metalness  | 0.0                                                        |
| Normal     | Dense, pillowy microstructure. Cushion mosses form rounded mounds (1--3 cm high); feather mosses have a fern-like spray pattern. The normal map needs to capture both the macro dome shape and the micro leaf tips. |
| AO         | Strong self-shadowing within the moss cushion. Lighter on top faces where they catch ambient light. Very dark at the base where moss meets rock or bark. |

### 2.7 Log Bark (Exterior)

Fallen logs in various decay stages, bark still attached.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Gray-brown (#6B5B47) to dark brown (#4A3A2A). Bark of oak and tulip poplar is deeply furrowed. Fresh deadfall is darker; logs down for 2+ years lighten and develop gray tones as bark separates. |
| Roughness  | **0.85**. Weathered bark is rough and fibrous. Deep fissures and ridges scatter light. |
| Metalness  | 0.0                                                        |
| Normal     | Deep vertical fissures (5--15 mm) with ridged plates between them. Scale the normal intensity high -- bark has dramatic surface relief relative to its area. |
| AO         | Very strong in the fissure bottoms. This is what gives bark its characteristic dark-lined look. |

### 2.8 Log Cross-Section (Exposed Wood)

Where a log has broken or been cut, exposing the interior wood grain.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Outer sapwood ring: pale tan (#C4B08A). Heartwood: darker amber to orange-brown (#8A6A3A). If the log is decayed, the interior is darker, softer-looking, possibly with white rot (pale patches) or brown rot (crumbly chocolate). |
| Roughness  | Fresh cut: **0.50--0.60** (smoother grain). Weathered/decayed: **0.80--0.90** (fibrous, punky texture). |
| Metalness  | 0.0                                                        |
| Normal     | Concentric growth rings, radial rays. On weathered cuts, the softer earlywood has eroded faster than latewood, creating a washboard surface. |
| AO         | Ring-shaped shadows following the growth ring valleys. Moderate intensity. |

### 2.9 Weathered Board

Old plywood or dimensional lumber used as artificial cover objects in
survey grids. Weeks to months of ground contact.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Pale gray to silver-gray (#A09888 to #B0A898) on the exposed top face. Bottom (ground-contact) face is darker, stained brown-black from humic acid. Grain pattern visible but muted. |
| Roughness  | **0.60**. Weathered wood is smoother than bark -- the grain is raised but the surface is still relatively planar. Splintered areas higher (~0.80). |
| Metalness  | 0.0                                                        |
| Normal     | Raised grain running lengthwise. Weathering lifts the harder latewood above the softer earlywood. Nail holes, split ends, and board edges need detail. |
| AO         | Mild. Mostly flat surface. Darken in the grain valleys and around warped/cupped edges. |

### 2.10 Tree Trunk Bark (Standing Trees)

Living trees. These are vertical surfaces viewed at eye level and close
range during approach shots.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Species-dependent. Tulip poplar: pale gray-brown, relatively smooth with shallow interlocking ridges. White oak: dark gray-brown, deeply furrowed with pale-bottomed fissures. Red oak: dark brown, striped with flat-topped ridges. Beech: smooth pale silver-gray -- almost no bark texture. Use 2--3 bark materials and assign per tree instance. |
| Roughness  | **0.75--0.90** depending on species. Beech is smoother (~0.60) because of its tight bark. Oaks are very rough (~0.90). |
| Metalness  | 0.0                                                        |
| Normal     | Critical for selling species identity. Each species has a distinct bark pattern: tulip poplar has shallow diamond-shaped ridges; oaks have deep vertical furrows; beech is smooth with horizontal lenticels. |
| AO         | Strong in fissures. Also darken the root flare zone where trunk meets ground, where debris accumulates. |

### 2.11 Fern Fronds

Christmas fern and New York fern -- the dominant herb layer.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Fresh spring green: bright yellow-green (#5A9A2E) on new fronds. Mature: deeper green (#3A6B1E). Underside is slightly paler. Use an alpha-cutout texture -- the frond silhouette is as important as the color. |
| Roughness  | **0.40**. Fern fronds have a waxy cuticle that gives them a subtle sheen, especially on the upper surface. This is noticeably lower roughness than the surrounding matte forest floor -- ferns should "pop" slightly in specular. |
| Metalness  | 0.0                                                        |
| Normal     | Pinnae (individual leaflets) angled along the rachis. Central vein on each pinna. The normal map should capture the slight curl at frond tips (fiddlehead remnants on newer fronds). |
| AO         | Light self-shadowing where pinnae overlap. Most of the depth comes from the alpha cutout creating real shadows via the shadow map, not baked AO. |
| Alpha      | Binary cutout from frond photograph. Clean edges, no fringing. Use `alphaTest: 0.5` on the material. |

### 2.12 Stream Water

First-order stream or seep. Shallow (2--10 cm), clear, flowing.

| Channel    | Value / Description                                        |
|------------|------------------------------------------------------------|
| Albedo     | Near-transparent. Slight tea color (#F5E8D0) at depth. The "color" of stream water is mostly the visible stream bed underneath -- render it via a refraction or depth-fade approach. |
| Roughness  | **0.05**. Water is one of the smoothest natural surfaces. Surface is not perfectly flat -- use an animated normal map to create ripple distortion. |
| Metalness  | **0.10**. This is a cheat for PBR water: real water has strong Fresnel reflections at glancing angles, and bumping metalness slightly helps `MeshPhysicalMaterial` approximate this without a custom shader. Keep it low. |
| Normal     | Animated. Two tiling normal maps scrolling in different directions at different speeds simulate flow. Scale should match realistic ripple size (~5--15 cm wavelength). |
| AO         | Not applicable -- water doesn't self-shadow in a meaningful way. |
| Notes      | Use `MeshPhysicalMaterial` with `transmission: 0.9`, `thickness: 0.1`, `ior: 1.33`. Stream bed is a separate mesh underneath with its own rock/gravel material. |

---

## 3. CC0 Texture Sources

All textures below are CC0 (public domain). For web delivery, target
**2K (2048x2048)** for ground materials that tile, **1K** for small
props, and **4K** only for hero surfaces viewed up close. Compress to
JPEG for albedo/roughness, PNG for normal/alpha.

### 3.1 Poly Haven Textures

| Asset Name              | Resolution | Category       | Maps To                     | Notes |
|-------------------------|------------|----------------|-----------------------------|-------|
| `leaves_forest_ground`  | up to 8K   | Terrain        | **Leaf litter** (2.1)       | Dense autumn leaf litter with layered brown leaves, twigs, and soil. Best primary ground texture. Use at 2K for tiling. |
| `forest_leaves_02`      | up to 8K   | Terrain        | **Leaf litter** (2.1)       | Includes moss and sticks. Good for blending variation. |
| `dry_decay_leaves`      | up to 8K   | Terrain        | **Leaf litter** (2.1)       | Drier, more decomposed. Use for Oe-horizon patches. |
| `forrest_ground_03`     | up to 8K   | Terrain        | **Humus / ground** (2.2)    | Pine needle and debris mix. Darkened variant works for humus areas. |
| `brown_mud_leaves_01`   | up to 8K   | Terrain        | **Wet soil** (2.3)          | Brown muddy ground with scattered leaves, moss, damp surface. |
| `brown_mud`             | up to 8K   | Terrain        | **Wet soil** (2.3)          | Granular wet soil. Good for under-cover reveal areas. |
| `mossy_rock`            | up to 8K   | Rock           | **Rock with lichen** (2.5)  | Weathered striated rock with moss patches and lichen. |
| `rock_pitted_mossy`     | up to 8K   | Rock/Sandstone | **Rock / sandstone** (2.4)  | Pitted sandstone surface, 1 m wide at 81.9 px/cm. |
| `bark_brown_02`         | up to 8K   | Wood/Bark      | **Tree trunk bark** (2.10)  | Deep vertical furrows, mossy patches. Good for oak trunks. |
| `bark_brown_01`         | up to 8K   | Wood/Bark      | **Tree trunk bark** (2.10)  | Rugged fibrous furrows, warm brown. Good for tulip poplar. |
| `tree_bark_03`          | up to 8K   | Wood/Bark      | **Log bark** (2.7)          | Old bark with deep fissures, earthy brown-gray, moss patches. |
| `pine_bark`             | up to 8K   | Wood/Bark      | **Log bark** (2.7)          | Flaky reddish-brown plates. Alternate bark variety. |
| `mud_forest`            | up to 8K   | Terrain        | **Humus** (2.2)             | Forest floor mud, dark tones. |

### 3.2 Poly Haven HDRIs

| Asset Name          | Resolution | Maps To                    | Notes |
|---------------------|------------|----------------------------|-------|
| `mossy_forest`      | 16K        | **Environment map / IBL**  | Mossy forest with dappled light, subtle stream, wet rocks. Best match for cove hardwood interior. Use at 2K for IBL, 4K max for background. |
| `monks_forest`      | 16K        | **Environment map / IBL**  | Forest path, dappled canopy, warm backlit highlights. Good secondary option. |
| `forest_slope`      | 19K        | **Environment map / IBL**  | Morning light through pines over mossy rocks. Slightly more open than target -- use if scene needs brighter ambient. |

### 3.3 ambientCG Textures

| Asset ID      | Resolution     | Category | Maps To                     | Notes |
|---------------|----------------|----------|-----------------------------|-------|
| `Ground037`   | 1K--8K         | Ground   | **Leaf litter / moss blend** (2.1, 2.6) | Damp earth with moss and grass. Photogrammetry source. Good for transition zones between leaf litter and moss patches. |
| `Ground048`   | 1K--16K        | Ground   | **Humus / soil** (2.2)      | Brown dirt/soil. Clean photogrammetry scan, good base for under-cover areas. |
| `Ground026`   | 1K--8K         | Ground   | **Wet soil** (2.3)          | Forest ground with dirt, moss, mud, sticks. |
| `Ground024`   | 1K--8K         | Ground   | **Wet soil / moss** (2.3)   | Forest ground with moss and sticks. Photogrammetry. |
| `Moss001`     | 1K--8K         | Moss     | **Moss** (2.6)              | Dense cushion moss. Bright green. |
| `Moss002`     | 1K--8K         | Moss     | **Moss** (2.6)              | Moss with more variation. Good for blended patches. |
| `Moss003`     | 1K--8K         | Moss     | **Moss** (2.6)              | Third moss variant for scatter diversity. |
| `Bark001`     | 1K--8K         | Bark     | **Log bark / trunk** (2.7, 2.10) | General bark texture. Clean photogrammetry. |
| `Bark002`     | 1K--8K         | Bark     | **Log bark / trunk** (2.7, 2.10) | Second bark variant for instance variety. |
| `Rock020`     | 1K--8K         | Rock     | **Rock / sandstone** (2.4)  | Natural rock surface. |
| `Rock011`     | 1K--8K         | Rock     | **Rock / sandstone** (2.4)  | Alternate rock variant. |
| `Wood039`     | 1K--8K         | Wood     | **Weathered board** (2.9)   | Wood grain texture. Desaturate slightly for weathered lumber. |
| `Wood026`     | 1K--8K         | Wood     | **Log cross-section** (2.8) | Wood end grain. |

### 3.4 Download Strategy

1. Download all Poly Haven textures at **2K JPG** for initial dev. Swap
   to 4K for hero surfaces during polish.
2. Download ambientCG textures at **2K JPG** (ZIP-format bundles include
   albedo, normal, roughness, AO, displacement).
3. HDRI: download `mossy_forest` at **2K HDR** for IBL and **4K HDR**
   for optional background sphere.
4. Total estimated texture budget at 2K: ~80--120 MB uncompressed,
   ~25--40 MB JPEG-compressed. Well within WebXR limits.

---

## 4. Lighting Setup

### 4.1 Primary Lights

```javascript
// -- Sun (DirectionalLight) --
// Represents a single gap in the canopy letting afternoon light through.
const sun = new THREE.DirectionalLight(0xFFF5E0, 2.5);
sun.position.set(15, 30, -10);  // high, slightly behind-right
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left   = -20;
sun.shadow.camera.right  =  20;
sun.shadow.camera.top    =  20;
sun.shadow.camera.bottom = -20;
sun.shadow.camera.near   =  0.5;
sun.shadow.camera.far    = 80;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;

// -- Hemisphere Light --
// Sky: desaturated blue (overcast filtered through canopy)
// Ground: warm brown (bounce light from leaf litter)
const hemi = new THREE.HemisphereLight(0xB4C8D8, 0x6B5B47, 0.8);

// -- Fill Light (optional) --
// Low-intensity directional from the opposite side to lift shadow density.
const fill = new THREE.DirectionalLight(0x8AA080, 0.3);
fill.position.set(-10, 8, 5);
fill.castShadow = false;
```

### 4.2 Canopy Shadow

The canopy filters sunlight into a dappled pattern on the forest floor.
Two approaches, use whichever fits the performance budget:

**Option A -- Cookie Texture (cheaper):**
Assign a grayscale texture to the sun's shadow camera as a cookie /
light map. The texture is a procedurally generated canopy silhouette:
irregular leaf-cluster shapes (Perlin noise thresholded at ~0.45) with
small gaps (5--15% of area). Animate by slowly scrolling the texture UV
(0.001 units/frame) to simulate wind-driven sway.

**Option B -- Geometry Shadows (more realistic):**
Place 3--5 large translucent planes at canopy height (25--30 m) with
alpha-cutout leaf cluster textures. These cast real shadow-map shadows
onto the floor. More accurate parallax when the camera moves. Costs
shadow map fill rate.

### 4.3 Fog

```javascript
// Exponential fog -- subtle haze that softens distant tree trunks
// and compresses the depth range.
scene.fog = new THREE.FogExp2(0xC8D0C0, 0.015);
```

The fog color is a desaturated green-gray, matching the ambient light
under canopy. At density 0.015, objects at 30 m are noticeably hazed,
objects at 50 m are nearly invisible. This naturally limits draw
distance and focuses attention on the survey area.

### 4.4 Environment Map (IBL)

Load `mossy_forest` HDRI via `RGBELoader` or `EXRLoader`. Apply to
`scene.environment` for indirect specular on all PBR materials. Set
`scene.environmentIntensity = 0.4` to keep IBL subtle -- the direct
lights should dominate.

Do **not** set `scene.background` to the HDRI unless the camera can
see the horizon. For a ground-level forest view, use a skybox of simple
dark green-gray or let the fog handle the far plane.

---

## 5. Atmospheric Effects

### 5.1 Dust Motes

Tiny particles floating in light shafts. Sells the "thick air" feeling
of a humid forest interior.

```javascript
const dustCount = 500;
const dustGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(dustCount * 3);

for (let i = 0; i < dustCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 40;  // x spread
    positions[i * 3 + 1] = Math.random() * 8;            // y: ground to subcanopy
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;  // z spread
}
dustGeometry.setAttribute('position',
    new THREE.BufferAttribute(positions, 3));

const dustMaterial = new THREE.PointsMaterial({
    color: 0xFFF8E0,
    size: 0.03,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const dustMotes = new THREE.Points(dustGeometry, dustMaterial);
scene.add(dustMotes);
```

Animate by drifting each particle slowly upward (0.002 units/frame) with
a sine-wave horizontal wobble. Reset particles that drift above 8 m back
to ground level. Only visible where light shafts hit them -- mask
opacity by dot product of particle position with sun direction.

### 5.2 Falling Leaves

Occasional leaves drifting down from the canopy. Even in May, wind
dislodges old dead leaves from branch crotches.

- Use `THREE.Sprite` with a leaf texture atlas (4--6 leaf shapes, each
  ~64x64 px, alpha-cutout).
- 3--8 active leaf sprites at any time.
- Fall speed: 0.3--0.8 m/s with horizontal drift (sine wave, period
  2--4 seconds) and slow rotation.
- Spawn at random positions within the canopy footprint, y = 15--25 m.
- Despawn when y < 0.1 (hits ground) or after 30 seconds.
- Color: tan, pale brown, muted yellow. Not green -- these are dead
  holdover leaves.

### 5.3 Stream Mist

If the scene includes a stream or seep, add a low-lying fog layer.

- Use a horizontal `PlaneGeometry` (2 m x stream length) positioned at
  stream surface height + 0.1 m.
- Material: `MeshBasicMaterial` with a soft cloud alpha texture,
  `transparent: true`, `opacity: 0.15`, `depthWrite: false`.
- Animate UV scroll along the stream direction at 0.0005 units/frame.
- Optional: use two overlapping planes with different scroll speeds for
  parallax depth.

### 5.4 God Rays (Optional -- Performance Budget Permitting)

Volumetric light shafts through canopy gaps. Implement via a
postprocessing pass:

1. Render the scene to a depth buffer.
2. For each pixel, march rays from the pixel toward the sun position in
   screen space.
3. Accumulate light samples that are not occluded by geometry.
4. Blend the result additively over the final frame.

Use the `UnrealBloomPass` from Three.js examples as a cheaper
approximation: set bloom threshold high enough that only the brightest
canopy-gap areas trigger it, giving a soft glow effect around light
shafts. Bloom strength ~0.3, radius ~0.8, threshold ~0.85.

---

## 6. Terrain

### 6.1 Geometry

```javascript
const terrainSize = 50;  // 50 m x 50 m survey area
const segments = 100;    // 100 x 100 subdivisions = 10,201 vertices

const terrain = new THREE.PlaneGeometry(
    terrainSize, terrainSize,
    segments, segments
);
terrain.rotateX(-Math.PI / 2);
```

### 6.2 Displacement

Apply a displacement map to create the undulating forest floor. The
displacement should not be dramatic -- cove forests have gentle
microtopography, not cliffs.

- **Amplitude:** 0.3--0.5 m total range (min to max).
- **Source:** Perlin noise at two octaves. Low frequency (wavelength
  ~10 m) creates the broad swales and rises. High frequency (wavelength
  ~1 m) creates root bumps and small hummocks.
- **Application:** Either bake into a displacement texture and use
  `displacementMap` on `MeshStandardMaterial` (GPU-side), or modify
  vertex positions directly in JS (CPU-side, more control).
- **Edge treatment:** Fade displacement to zero at terrain edges so the
  mesh sits flat against any bounding geometry.

```javascript
// CPU-side displacement example
const pos = terrain.attributes.position;
for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Two-octave Perlin noise (use a noise library like simplex-noise)
    const low  = noise2D(x * 0.08, z * 0.08) * 0.25;
    const high = noise2D(x * 0.5,  z * 0.5)  * 0.05;

    pos.setY(i, pos.getY(i) + low + high);
}
terrain.computeVertexNormals();
```

### 6.3 Material Blending

The terrain should not have a single uniform texture. Use a blend of
2--3 materials based on height, slope, and hand-painted masks:

- **Default:** Leaf litter (2.1) covers 70--80% of the surface.
- **Depressions:** Blend toward humus (2.2) in low areas where moisture
  collects.
- **Slopes / exposed faces:** Blend toward rock (2.4) on steeper
  microterrain.
- **North-facing patches:** Blend toward moss (2.6).

Implementation options:
1. **Splat map:** A single RGBA texture where R = litter, G = humus,
   B = rock, A = moss. Sample all four PBR sets and blend by splat
   weights. Costs 4x texture lookups but gives full artistic control.
2. **Triplanar mapping:** For surfaces with extreme UV stretching
   (vertical faces of root bumps, rock outcrops). Project textures from
   world X, Y, Z axes and blend by surface normal direction.
3. **Large-UV tiling:** Use a 4K texture at 0.5 texels/cm and tile 2x2
   across the terrain. Break repetition with a detail noise overlay.

---

## 7. Vegetation

### 7.1 Tree Trunks (Instanced)

5--8 tree trunks visible in the scene. These are large-diameter
hardwoods (30--80 cm DBH) that frame the survey area and support the
canopy.

- **Geometry:** `CylinderGeometry` with 12--16 radial segments, slight
  taper (base radius 5--10% wider than top). For hero trees near the
  camera, add root flare geometry: 3--5 extruded buttress shapes
  merging into the ground plane.
- **Instancing:** Use `InstancedMesh` with a shared bark material. Set
  per-instance transforms for position, rotation (slight lean, 0--5
  degrees), and scale (diameter variation).
- **Material assignment:** Alternate between 2--3 bark materials
  (`bark_brown_01` for tulip poplar, `bark_brown_02` for oak,
  smooth gray for beech) using instance index to select UV offset or
  material variant.
- **Height:** Extend trunks to at least 15 m (above the camera's
  vertical FOV ceiling). They disappear into the canopy above.

### 7.2 Canopy

The canopy is not rendered as individual leaf geometry. At ground level
looking up, it reads as a continuous broken ceiling.

- **Geometry:** 2--3 large horizontal `PlaneGeometry` meshes at
  y = 20--30 m, overlapping to cover the scene footprint with ~10%
  overhang.
- **Material:** Alpha-cutout texture of a leafy canopy photographed
  from below. Dark green with irregular bright gaps where sky shows
  through. `side: THREE.DoubleSide`, `alphaTest: 0.4`.
- **Shadow:** These planes are the primary shadow casters for the
  forest floor dapple pattern. Ensure `castShadow = true`.
- **Animation:** Gentle vertex displacement (sine wave, amplitude 0.1 m,
  period 3--5 seconds) to simulate wind sway. Subtle -- leaves rustle,
  branches don't whip.

### 7.3 Ferns (Cross-Billboard)

Ferns are the dominant herb-layer element. Use cross-billboard pairs
(two intersecting planes at 90 degrees) for each fern clump.

- **Geometry:** Two `PlaneGeometry` quads (0.3--0.6 m wide) rotated 90
  degrees around Y axis, sharing a center point.
- **Material:** Alpha-cutout fern frond texture on
  `MeshStandardMaterial` with `alphaTest: 0.5`, `side: DoubleSide`.
  Roughness 0.4 (see 2.11).
- **Placement:** 30--50 fern instances. Cluster them in groups of 3--8
  along terrain depressions and near stream edges. Avoid even spacing.
  Use Poisson disk sampling with a minimum distance of 0.4 m.
- **Scale variation:** 0.7x to 1.3x uniform scale, randomized per
  instance.
- **Rotation:** Random Y rotation per instance (0--360 degrees). Slight
  X tilt (0--10 degrees toward light) for naturalism.

### 7.4 Rhododendron Clusters

Dense evergreen shrub thickets, 2--4 m tall. These frame the edges of
the survey area and create visual enclosure.

- **Geometry:** Each cluster is a group of 4--8 cross-billboard quads at
  varied heights and angles, sharing a rough cylindrical volume.
  Individual leaves are not modeled -- the texture does the work.
- **Material:** Dark glossy green leaf texture with alpha cutout.
  Roughness 0.35 (waxy cuticle), slightly lower than ferns.
  `side: DoubleSide`.
- **Placement:** 2--4 clusters at scene edges, acting as natural walls.
  Each cluster is 2--4 m in diameter.
- **Detail:** Add a few individual rhododendron branches (single
  billboard planes angled outward) at cluster edges to break the
  silhouette.

### 7.5 Undergrowth Scatter

Small ground-cover elements that fill the spaces between larger
vegetation and cover objects.

- **Types:** Small twig bundles, individual dead leaves (flat quads on
  the ground plane), tiny moss patches, pebbles, acorn caps.
- **Count:** 50--100 instances total, mixed types.
- **Geometry:** `InstancedMesh` per type. Each instance is a small
  quad (twigs: 5--15 cm, leaves: 3--8 cm) or low-poly mesh (pebbles:
  icosahedron, 2--3 cm diameter).
- **Placement:** Random scatter with density falloff from the scene
  center. Higher density near cover objects and tree bases. Use the
  terrain height to snap instances to the ground surface.
- **Material:** Re-use the leaf litter albedo for scattered dead leaves.
  Gray-brown for pebbles (same albedo as rock 2.4 but at small scale).
  Twig material can re-use bark albedo at low roughness.

---

## 8. Performance Notes for WebXR

- **Shadow map:** 2048x2048 is the ceiling for mobile XR. Use `PCFSoft`
  shadow type, not VSM.
- **Draw calls:** Keep under 50. Instancing is critical -- every
  scattered element must be instanced, not individually meshed.
- **Texture memory:** Budget 128 MB total VRAM for textures. At 2K
  resolution per PBR set (albedo + normal + roughness + AO = 4
  textures), each set costs ~16 MB uncompressed. Compress to **KTX2
  (Basis Universal)** for ~4x reduction. 12 material sets x 4 MB each
  = ~48 MB compressed. Well within budget.
- **Polygon budget:** Terrain (10K tris) + 8 tree trunks (2K tris each)
  + canopy planes (200 tris) + ferns (3K tris) + rhododendron (4K tris)
  + undergrowth (3K tris) + cover objects (2K tris) = ~38K tris. Target
  is under 100K, so there is headroom for hero geometry.
- **LOD:** Not needed at this scene scale (50 m x 50 m). Everything is
  within close-to-medium range.
- **Frame rate target:** 72 fps for Quest 3, 90 fps for desktop VR.
  Profile early, profile often.
