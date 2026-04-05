# 3D Salamander Models -- WebXR Field Identification Sim

**Experiment:** Batesian Mimicry in Appalachian Salamanders
**Stack:** Three.js r168+ / WebXR / MeshStandardMaterial
**Scope:** 8 species, real-time VR with in-hand examination
**Date:** 2026-04-04

---

## 1. Approach Recommendation

Three options were evaluated for producing 8 species-distinct salamander meshes that hold up at VR examination distance (~20 cm from the viewer's eye).

### Option A: Procedural BufferGeometry

Build each animal entirely in code. Spine defined as a CatmullRomCurve3, cross-section ellipses extruded along it, limbs as tapered cylinders branching off the trunk. Head and tail are endpoint-shaped caps with species-specific scaling.

**Pros:**
- Total parametric control. Body proportions (headRatio, tailRatio from config.js) drive geometry directly. Every individual can be unique.
- No external assets, no licensing, no load-time file fetches.
- Costal grooves can be displacement-stamped into the BufferGeometry at construction time rather than faked in a normal map.
- Easy to generate LOD variants by reducing subdivision count.

**Cons:**
- Limb attachment and toe geometry is tedious to get right procedurally. Salamander forelimbs have 4 toes, hind limbs have 5 -- that level of anatomical fidelity in procedural geometry is a lot of hand-tuned control points.
- Head shape (flattened Desmognathus vs. rounded Plethodon vs. compact newt) requires per-species spline profiles. That's 8 distinct head generators.
- Development time is high. Getting organic shapes to look right without a sculpting tool is a battle.
- No artist can iterate on it without reading code.

### Option B: Pre-modeled GLTF

Source 8 individual models from Sketchfab, TurboSquid, or commission them. Import as GLTF/GLB, apply species textures.

**Pros:**
- Best visual quality per unit of development effort.
- Artists can work in Blender/ZBrush and export.

**Cons:**
- Licensing. Creative Commons models on Sketchfab are not always CC-BY, and many salamander models are stylized (cartoon proportions, wrong toe count, fantasy creatures labeled "salamander"). Finding 8 anatomically accurate Appalachian plethodontid models is not realistic.
- Geometry inconsistency. Each model from a different author has different topology, different UV layouts, different bone structures. Swapping textures across them doesn't work without re-UV-ing each one.
- File size. 8 separate GLTF files with embedded textures. If each is 1-2 MB, that's up to 16 MB before LOD variants.
- No parametric variation between individuals of the same species.

### Option C: Hybrid -- 1 Base Mesh + 8 Canvas Texture Sets (Recommended)

Model a single anatomically correct salamander mesh in Blender with clean UV unwrap. Export as a single GLTF. At runtime, generate per-species textures on a Canvas element (512x256 albedo, 512x256 normal), apply as THREE.CanvasTexture. Species-specific geometry differences (body proportions, head shape, tail keel) are handled by non-uniform scaling and morph targets on the base mesh.

**This is the recommended approach.** Here's why:

1. **One mesh to maintain.** Topology stays consistent. UV layout is shared. LOD variants are generated from one source. Morph targets handle the proportional differences (headRatio, tailRatio) between species without separate geometry.

2. **Canvas textures are already a pattern in this codebase.** The 2D sim's `TextureGenerator.js` already renders procedural forest floor textures via Canvas. The salamander skin textures are conceptually the same -- paint a base color, scatter spots/lines/flecks, generate a normal map from height data. The code style and tooling are familiar.

3. **Individual variation for free.** Each salamander instance can have its own Canvas render pass with stochastic hue/saturation offsets (bodyRange, satRange from config.js) and randomized spot placement. No two NOVI look identical.

4. **Small payload.** One GLTF (~200 KB with morph targets, no embedded textures). Textures generated client-side cost zero network transfer. Total asset load is under 500 KB.

5. **LOD textures are trivial.** LOD 0 renders to 512x256. LOD 1 renders to 128x64 on a smaller canvas. Same painting code, different resolution.

**Morph target strategy for proportional differences:**

The base mesh is built to the median proportions across all 8 species. Four morph targets handle the extremes:

| Morph Target | What It Does | Species Using It |
|---|---|---|
| `headLarge` | Scales head region to headRatio 0.22 | NOVI |
| `headSmall` | Scales head region to headRatio 0.16 | PSRU |
| `tailLong` | Extends tail to tailRatio 0.52 | EUBI |
| `tailKeeled` | Compresses tail cross-section laterally, adds dorsal ridge | NOVI, DEFU, DEMO, GYPO |

Species with intermediate proportions blend between morph targets. PLCI (headRatio 0.18, tailRatio 0.50) uses `tailLong` at 0.8 weight. DEFU (headRatio 0.20, tailRatio 0.45) uses `headLarge` at 0.5 and `tailKeeled` at 1.0.

**Costal groove geometry:**

Plethodontids have visible costal grooves -- vertical indentations along the trunk. These are a key diagnostic feature (NOVI has 0, PSRU has 17, PLCI has 19). In the base mesh, the trunk region has 20 evenly spaced edge loops. At construction time, a `setCostalGrooves(count)` function displaces the appropriate loops inward by 0.3mm in model space. Students examining the animal in VR can count them.

NOVI (family Salamandridae) has no costal grooves. Its trunk surface remains smooth, reinforced by the granular normal map.

---

## 2. Species-Specific Requirements

All values reference the SPECIES object in `config.js`. Color hex codes are exact.

### 2.1 NOVI -- Red-spotted Newt (Eft Stage)

*Notophthalmus viridescens* -- the model species. Toxic. Bright aposematic coloration.

**Geometry:**
- headRatio: 0.22 (largest relative head of any species here). Morph: `headLarge` at 1.0.
- tailRatio: 0.45. Tail is laterally compressed with a dorsal keel -- the `tailKeeled` morph target flattens the tail cross-section and raises a subtle ridge along the dorsal midline.
- SVL range: 28--48mm, TL range: 55--90mm. This is the smallest-bodied species. Base mesh uniform scale: ~0.65.
- No costal grooves. Trunk surface is smooth geometry (no edge loop displacement).
- Compact, stocky body. Limbs are proportionally shorter and thicker than plethodontids.

**Material:**
- Skin: roughness 0.85, metalness 0.0. This is the driest, roughest skin of any species. In life the eft's skin feels like fine sandpaper -- distinctly non-glossy.
- Normal map must convey granular texture. Dense stipple pattern rendered into the normal map canvas (see Section 3.2).

**Albedo texture:**
- Base body: `#d4572a` (burnt orange-red). Individual variation: hue offset [0, 20] degrees, saturation offset [-0.05, 0.10].
- Spots: `#cc2200` red circles with `#111111` black borders, arranged in two dorsolateral rows (`bordered-rows` pattern). 6-8 spots per row on a 512px-wide texture. Spot diameter ~16px on the albedo canvas, border ring 3px wider.
- Belly: `#e8b040` (golden-yellow). Visible when student tilts the animal.
- Eye: `#222222` -- dark iris, dark pupil. No gold.

**Key diagnostic features for in-hand ID:**
- Granular skin texture (visible as bumpy normal map at close range)
- Black-bordered red spots in regular rows (not scattered)
- Laterally compressed, keeled tail
- No costal grooves
- Small body size relative to PSRU

---

### 2.2 PSRU -- Red Salamander

*Pseudotriton ruber* -- the Batesian mimic. Non-toxic, resembles NOVI at small body sizes.

**Geometry:**
- headRatio: 0.16 (smallest relative head). Morph: `headSmall` at 1.0.
- tailRatio: 0.42. Round cross-section -- no keel morph. Tail is cylindrical, tapering to a point.
- SVL range: 35--80mm, TL range: 80--180mm. Much larger than NOVI at adult size. Base mesh uniform scale: ~1.1.
- costalGrooves: 17. Edge loops 2 through 18 displaced inward.
- Elongated, slender body with small head -- the opposite build from NOVI.

**Material:**
- Skin: roughness 0.35, metalness 0.0. Smooth, moist, slightly glossy. The plethodontid wet-skin look.
- Normal map is mostly flat with subtle surface undulation. No stipple.

**Albedo texture:**
- Base body: `#b83a1f` (darker, more brick-red than NOVI). Individual variation: hue [-10, 15], saturation [-0.10, 0.05].
- Spots: `#222222` black dots scattered irregularly (`scattered` pattern). No borders. 15-25 spots of varying size (6-14px diameter), placed stochastically across dorsum and flanks. Some spots on the tail.
- Belly: `#e8a060` (pale peach-orange).
- Eye: `#c9a832` (gold/yellow iris). This is the single most important diagnostic feature separating PSRU from NOVI. The iris must be rendered prominently.

**Key diagnostic features for in-hand ID:**
- Gold eye color (vs. dark in NOVI)
- Scattered black spots without borders (vs. bordered rows in NOVI)
- Smooth glossy skin (vs. granular in NOVI)
- Visible costal grooves (17)
- Larger body size at adult stage, small head relative to body
- Round tail (vs. keeled in NOVI)

**Mimic difficulty note:** Young PSRU (SVL < 45mm) are very close to NOVI in size and color. The texture generator should tighten hue toward the NOVI range for small individuals -- config.js already provides `getMimicDifficulty(svl)` for this.

---

### 2.3 PLCI -- Red-backed Salamander

*Plethodon cinereus* -- the most abundant species (58% of encounters).

**Geometry:**
- headRatio: 0.18, tailRatio: 0.50 (longest relative tail). Morph: `tailLong` at 0.8.
- SVL range: 28--54mm, TL range: 65--125mm. Base mesh scale: ~0.72.
- costalGrooves: 19. Most of any species. All 20 edge loops displaced -- very tightly spaced grooves.
- Slender build, moderate head.

**Material:**
- Skin: roughness 0.40, metalness 0.0. Smooth plethodontid skin.
- Normal map: flat with costal groove emphasis.

**Albedo texture -- three morphs:**

This species has color polymorphism. Morph is selected at instantiation per the weights in config.js (striped: 0.70, leadback: 0.28, erythristic: 0.02). The texture canvas must handle all three:

**Striped morph (70%):**
- Body (flanks + head + tail base): `#5c3a28` (dark chocolate brown).
- Dorsal stripe: `#b04a2a` (red-orange), a broad band running from behind the head to the tail tip. On the 512x256 canvas this is a ~60px-wide stripe centered on the dorsal midline.
- Belly: `#888888` with salt-and-pepper mottling -- random white and dark gray speckles (~40 dots, 2-4px).

**Leadback morph (28%):**
- Entire dorsum: `#5c3a28` uniform dark brown-gray. No stripe.
- Belly: same salt-and-pepper as striped.

**Erythristic morph (2%):**
- Base: `#5c3a28` with a strong red-orange overlay (`rgba(180, 60, 30, 0.25)`) over the entire body.
- No clear stripe demarcation -- the whole animal has a reddish tint.
- Belly: same pattern.

- Eye: `#222222` (dark).
- No spot pattern (`spotPattern: 'none'`).

**Key diagnostic features:**
- Red dorsal stripe (striped morph) or uniform dark color (leadback)
- Salt-and-pepper belly (unique among these species)
- 19 costal grooves (most of any species)
- Very long tail relative to body

---

### 2.4 PLGL -- Slimy Salamander

*Plethodon glutinosus* -- large, jet black with silver flecks.

**Geometry:**
- headRatio: 0.17, tailRatio: 0.48. No extreme morphs needed -- near median.
- SVL range: 45--85mm, TL range: 105--195mm. Large animal. Base mesh scale: ~1.15.
- costalGrooves: 16.
- Robust build.

**Material:**
- Skin: roughness 0.25, metalness 0.05. The glossiest skin of any species. In life, PLGL skin exudes a thick, sticky secretion that gives it a wet lacquered look.
- Normal map: very smooth with subtle specular variation.

**Albedo texture:**
- Base body: `#1a1a2e` (near-black with a blue-purple undertone). Very low individual variation: hue [-3, 3], saturation [-0.02, 0.02].
- Flecks: `#c0c0c0` (silver-white). `flecked` pattern. 25-40 small irregular dots (3-8px) scattered across dorsum and flanks. Some elongated, some round. Concentrated more on the lateral surfaces.
- Belly: `#222222` (dark, slightly lighter than dorsum).
- Eye: `#333333` (dark, nearly indistinguishable from body at a glance).

**Key diagnostic features:**
- Jet black body with white/silver flecks
- Large size
- Extremely glossy, sticky-looking skin
- 16 costal grooves

---

### 2.5 DEFU -- Northern Dusky Salamander

*Desmognathus fuscus* -- stream-associated, with a diagnostic pale jaw line.

**Geometry:**
- headRatio: 0.20, tailRatio: 0.45. Morph: `headLarge` at 0.5 (moderately large head). `tailKeeled` at 1.0 -- Desmognathus tails are distinctly keeled with a triangular cross-section.
- SVL range: 28--58mm, TL range: 55--115mm. Base mesh scale: ~0.70.
- costalGrooves: 14.
- Muscular hind legs -- Desmognathus are the "jumpers" of the salamander world. The base mesh hind limb region should be slightly thicker via vertex displacement or a `hindLegThick` morph target.

**Material:**
- Skin: roughness 0.40, metalness 0.0. Standard plethodontid smooth skin.
- Normal map: smooth.

**Albedo texture:**
- Base body: `#6b5b47` (warm brown, variable). Individual variation: hue [-8, 8], saturation [-0.05, 0.05]. This species is highly variable in color.
- Spots: `blotched` pattern. 5-8 darker brown irregular blotches on the dorsum, painted as soft-edged ellipses with `rgba(0, 0, 0, 0.20)` overlay. Blotches are larger and less defined than PSRU spots.
- Jaw line: `#c8b898` (pale cream). A diagnostic pale line extending from behind the eye to the angle of the jaw. On the UV-unwrapped texture, this is a 2-3px curved stroke on each side of the head region.
- Belly: `#d4cec4` (pale, almost white). Much lighter than dorsum.
- Eye: `#333333`.

**Key diagnostic features:**
- Pale line from eye to jaw angle (must be visible in VR close-up)
- Keeled tail with triangular cross-section
- Warm brown coloration with dark blotches
- Muscular build, especially hind legs
- Found near streams

---

### 2.6 EUBI -- Two-lined Salamander

*Eurycea bislineata* -- slender, yellow-bodied, stream-associated.

**Geometry:**
- headRatio: 0.17, tailRatio: 0.52 (longest tail of any species). Morph: `tailLong` at 1.0.
- SVL range: 27--48mm, TL range: 58--105mm. Small and very slender. Base mesh scale: ~0.60 with additional lateral compression (scaleX: 0.85) to achieve the narrow body.
- costalGrooves: 16.
- Delicate, elongated build. Limbs are thin.

**Material:**
- Skin: roughness 0.40, metalness 0.0. Smooth plethodontid.
- Normal map: smooth.

**Albedo texture:**
- Base body: `#c4a84a` (golden yellow-green). Individual variation: hue [-5, 5], saturation [-0.05, 0.05].
- Lines: `#4a3a28` (dark brown). `lined` pattern. Two dark dorsolateral lines running from behind the eye down the length of the body onto the tail. On the 512x256 canvas, each line is 3-4px wide, positioned at ~25% and ~75% of the body height (i.e., bordering a yellow-green dorsal stripe).
- Belly: `#e8d870` (bright yellow). The underside of the tail is particularly vivid yellow-orange.
- Eye: `#444444`.

**Key diagnostic features:**
- Two dark parallel lines framing a yellow dorsal stripe
- Bright yellow belly (especially under tail)
- Very slender, elongated build
- Small size

---

### 2.7 DEMO -- Seal Salamander

*Desmognathus monticola* -- robust stream Desmognathus with reticulated pattern.

**Geometry:**
- headRatio: 0.20, tailRatio: 0.44. Morph: `headLarge` at 0.5, `tailKeeled` at 1.0.
- SVL range: 38--72mm, TL range: 80--150mm. Medium-large. Base mesh scale: ~0.90.
- costalGrooves: 14.
- Robust, thick-bodied build. Large head like DEFU but heavier overall.

**Material:**
- Skin: roughness 0.40, metalness 0.0. Smooth plethodontid.
- Normal map: smooth.

**Albedo texture:**
- Base body: `#7a6b5a` (gray-brown). Individual variation: hue [-5, 5], saturation [-0.03, 0.03]. Less variable than DEFU.
- Pattern: `reticulated` -- a network of dark lines and irregular polygons on the dorsum giving a net-like or marbled appearance. Rendered as 10-15 overlapping unfilled ellipses (stroke only, `rgba(0, 0, 0, 0.15)`, lineWidth 1-2px) scattered across the trunk region of the texture canvas.
- Belly: `#c8b898` (cream, similar to DEFU).
- Eye: `#444444`.

**Key diagnostic features:**
- Net-like (reticulated) dorsal pattern
- Robust build with large head
- Keeled tail
- Larger than DEFU, similar habitat

---

### 2.8 GYPO -- Spring Salamander

*Gyrinophilus porphyriticus* -- large, salmon-pink, spring-associated.

**Geometry:**
- headRatio: 0.18, tailRatio: 0.46. Morph: `tailKeeled` at 0.7 (less pronounced keel than Desmognathus).
- SVL range: 40--90mm, TL range: 90--200mm. Largest species in the sim. Base mesh scale: ~1.25.
- costalGrooves: 18. Nearly as many as PLCI.
- Long, heavy body. Sluggish look.

**Material:**
- Skin: roughness 0.38, metalness 0.0. Smooth, moist.
- Normal map: smooth with subtle costal groove emphasis.

**Albedo texture:**
- Base body: `#d4907a` (salmon pink -- warm, muted, distinctly different from the bright orange of NOVI). Individual variation: hue [-8, 8], saturation [-0.05, 0.05].
- Pattern: `faint-mottled`. Subtle, low-contrast mottling. 10-18 very soft-edged dark patches (`rgba(0, 0, 0, 0.08)`) painted as large ellipses (20-40px) with feathered edges. The mottling is almost subliminal -- visible at close range but doesn't dominate.
- Belly: `#e8c8b0` (pale salmon).
- Eye: `#555555` (medium gray, lighter than most species).

**Key diagnostic features:**
- Salmon-pink color (not bright orange like NOVI)
- Large body size (largest in the sim)
- 18 costal grooves
- Faint mottling, no distinct spots
- Found near springs and seeps

---

## 3. Texture Generation

All textures are rendered at runtime on offscreen `<canvas>` elements and applied as `THREE.CanvasTexture`. No image files ship with the application.

### 3.1 Albedo Map (512x256)

The UV layout assumes a standard unwrap where the X axis maps to the animal's length (head at left, tail at right) and the Y axis maps circumferentially (dorsum at center, ventral surface at top and bottom edges).

**Rendering pipeline for each individual:**

```js
function renderAlbedoTexture(species, traits) {
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    var ctx = canvas.getContext('2d');

    // 1. Base color fill with individual variation
    var baseColor = adjustColor(species.color.body,
        traits.bodyHueOffset, traits.bodySatOffset);
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 256);

    // 2. Belly region (top and bottom 40px bands)
    if (species.color.belly) {
        ctx.fillStyle = species.color.belly;
        ctx.fillRect(0, 0, 512, 40);
        ctx.fillRect(0, 216, 512, 40);

        // Gradient transition from belly to dorsum
        var grad = ctx.createLinearGradient(0, 40, 0, 80);
        grad.addColorStop(0, species.color.belly);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 40, 512, 40);
        // mirror on bottom
        var gradB = ctx.createLinearGradient(0, 216, 0, 176);
        gradB.addColorStop(0, species.color.belly);
        gradB.addColorStop(1, 'transparent');
        ctx.fillStyle = gradB;
        ctx.fillRect(0, 176, 512, 40);
    }

    // 3. Species-specific pattern overlay
    renderPatternOverlay(ctx, species, traits);

    // 4. Head region color adjustment (slightly darker)
    var headEnd = Math.floor(512 * species.bodyProportions.headRatio);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, headEnd, 256);

    // 5. Apply canvas as texture
    var texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
```

### 3.2 Pattern Overlay Functions

Each `spotPattern` value from config.js maps to a Canvas rendering function:

**`bordered-rows` (NOVI):**
Two parallel rows of spots along the dorsolateral area (Y = 100 and Y = 156 on the 256px-high canvas). Each spot: fill a circle with `spotBorder` color (#111111) at radius R+3, then fill the inner circle with `spots` color (#cc2200) at radius R. Spot count: 6--8 per row, spaced evenly across the trunk region (X = headEnd to X = tailStart). Slight X/Y jitter per spot (+-4px) for organic feel.

**`scattered` (PSRU):**
Randomly placed dark dots across the dorsal and lateral surfaces. For each of 15--25 spots: pick random X in [headEnd, 480], random Y in [50, 206], random radius in [3, 7]. Fill with `spots` color (#222222). Some spots are slightly elliptical (scaleY 0.7--1.0) for variety.

**`flecked` (PLGL):**
Silver-white flecks. 25--40 small marks. For each: random position within the trunk+tail region, random radius 1--4px. Fill with `flecks` color (#c0c0c0) at alpha 0.7--1.0. Some are rendered as short line segments (2--6px) rather than circles for an irregular, lichen-like appearance.

**`blotched` (DEFU):**
5--8 large, soft-edged dark patches. Each blotch: create a RadialGradient from rgba(0,0,0,0.20) at center to transparent at edge, radius 15--30px. Place randomly across the trunk dorsum (Y = 80 to 176).

**`lined` (EUBI):**
Two dark lines running the length of the body. Each line: `ctx.strokeStyle = species.color.lines`, lineWidth 3--4px, draw from X = headEnd to X = tailEnd at Y = 90 and Y = 166. Slight sinusoidal wobble (amplitude 2px, period 80px) for natural feel.

**`reticulated` (DEMO):**
Network of dark outlines. Draw 10--15 randomly sized unfilled ellipses (ctx.stroke, not fill) with strokeStyle `rgba(0, 0, 0, 0.15)`, lineWidth 1.5px. Overlap creates a net-like impression. Constrain to dorsal region (Y = 70 to 186).

**`faint-mottled` (GYPO):**
Subtle cloudy patches. 10--18 large soft circles using RadialGradient, rgba(0, 0, 0, 0.08) at center, transparent at edge, radius 20--40px. Very low contrast -- barely visible until the student looks closely.

**`none` + stripe (PLCI striped morph):**
No spots. Instead, paint a broad dorsal stripe: `ctx.fillStyle = species.color.stripe` (#b04a2a), fill a rectangle from Y = 100 to Y = 156 (central 22% of circumference), X = headEnd to X = tailEnd. Edges softened with 8px gradient falloff.

**`none` (PLCI leadback morph):**
No pattern overlay. Uniform dark body color.

**Salt-and-pepper belly (PLCI, all morphs):**
After the main pattern pass, render the belly mottling. In the belly bands (Y < 40 and Y > 216): scatter ~40 dots, alternating between `rgba(255,255,255,0.4)` and `rgba(0,0,0,0.3)`, radius 1--2px.

### 3.3 Normal Map Generation (512x256)

The normal map is generated from a heightmap canvas of the same resolution. The process:

1. **Initialize a heightmap canvas** (512x256, single-channel grayscale). Fill with 128 (neutral -- no displacement).

2. **Granular texture (NOVI only):**
   Scatter 800--1200 tiny bright dots (value 140--160, radius 1--2px) across the entire surface. This creates a dense bumpy field when converted to normals. Slight Gaussian blur (radius 1px) after scattering to prevent aliasing.

3. **Smooth skin (all plethodontids):**
   Very subtle noise. Sample fractal noise (2 octaves, scale 0.02) across the canvas, map to height range [124, 132]. This gives a gentle, organic undulation without visible bumps.

4. **Costal grooves (plethodontids with costalGrooves > 0):**
   For each groove: draw a vertical dark line (value 100) at the appropriate X position within the trunk region. Line width 2px, with 1px falloff bands on each side (values 110, 120). The grooves are the most prominent normal map feature on plethodontids.

5. **Convert heightmap to normal map:**
   For each pixel, compute the gradient in X and Y by comparing neighboring pixel heights. Map the gradient to the [0, 255] range in the R and G channels (with 128 = flat). B channel = 255 (pointing outward). This is the standard tangent-space normal map encoding.

```js
function heightmapToNormalMap(heightCanvas, normalCanvas) {
    var hCtx = heightCanvas.getContext('2d');
    var nCtx = normalCanvas.getContext('2d');
    var w = heightCanvas.width;
    var h = heightCanvas.height;

    var hData = hCtx.getImageData(0, 0, w, h);
    var nImg = nCtx.createImageData(w, h);
    var strength = 2.0; // controls bumpiness

    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var idx = (y * w + x) * 4;
            var left  = x > 0     ? hData.data[((y) * w + (x - 1)) * 4] : hData.data[idx];
            var right = x < w - 1 ? hData.data[((y) * w + (x + 1)) * 4] : hData.data[idx];
            var up    = y > 0     ? hData.data[((y - 1) * w + x) * 4]   : hData.data[idx];
            var down  = y < h - 1 ? hData.data[((y + 1) * w + x) * 4]   : hData.data[idx];

            var dx = (left - right) * strength / 255;
            var dy = (up - down) * strength / 255;

            // normalize
            var len = Math.sqrt(dx * dx + dy * dy + 1);
            nImg.data[idx]     = Math.round(((dx / len) * 0.5 + 0.5) * 255); // R
            nImg.data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255); // G
            nImg.data[idx + 2] = Math.round(((1.0 / len) * 0.5 + 0.5) * 255); // B
            nImg.data[idx + 3] = 255; // A
        }
    }

    nCtx.putImageData(nImg, 0, 0);
}
```

**Strength values by species:**
| Species | Normal Strength | Reason |
|---|---|---|
| NOVI | 4.0 | Heavy granular bump |
| PSRU | 1.5 | Smooth with subtle undulation |
| PLCI | 1.5 | Smooth |
| PLGL | 1.0 | Very smooth, glossy |
| DEFU | 1.5 | Smooth |
| EUBI | 1.5 | Smooth |
| DEMO | 1.5 | Smooth |
| GYPO | 1.5 | Smooth |

---

## 4. Animation

No skeletal animation system. All movement is transform-based (position, rotation, scale), driven by update loops. This keeps the mesh simple and avoids the overhead of a bone system for animals that are mostly sitting still under cover objects.

### 4.1 Breathing Idle

Every salamander has a subtle breathing cycle. This runs continuously whenever the animal is visible.

```js
// In the per-frame update:
var breathPhase = Math.sin(elapsedTime * Math.PI * 2 * 0.5); // 0.5 Hz
mesh.scale.y = baseScaleY * (1.0 + breathPhase * 0.015);     // +-1.5% vertical
mesh.scale.x = baseScaleX * (1.0 - breathPhase * 0.005);     // slight lateral compression
```

The Y axis (dorsoventral) expands/contracts. X axis (lateral) does the inverse at 1/3 amplitude. Z axis (anteroposterior) stays constant. The effect is a barely perceptible rise-and-fall of the body. Frequency 0.5 Hz matches the resting respiration rate for plethodontids at ~15 degrees C (literature: ~30 breaths/min through cutaneous respiration, but visible body movement is slower).

### 4.2 Species-Specific Found Responses

When a cover object is flipped, the salamander performs a behavioral response before settling into its idle state. These are keyed to `species.behavior.response` in config.js.

**`stand-still` (NOVI):**
No movement at all. The eft holds position. It is toxic and has no reason to flee. Duration: 0.5--1.5s freeze, then breathing idle resumes. This conspicuous non-reaction is itself a teaching moment -- model species don't run.

**`coiled-posture` (PSRU):**
The animal curls into a defensive coil. Over 400ms, rotate the mesh 180 degrees around the Y axis (so the tail swings toward the head), then curve the tail upward (rotate tail bone equivalent -- or, without bones, tilt the back 1/3 of the mesh upward by 15 degrees using a secondary pivot point). Hold for the freeze duration (3--10s from config). Then slowly uncurl over 800ms. This is the classic Pseudotriton defensive display -- head tucked, tail raised, body coiled to display the red dorsum.

Implementation without skeletal animation: split the mesh into 3 sub-meshes at construction (head, trunk, tail) parented in a chain. The coil animation rotates each segment relative to its parent.

```js
// Coil animation keyframes
var coilSequence = [
    { time: 0,    tailRotZ: 0,     trunkRotZ: 0,    headRotZ: 0    },
    { time: 0.4,  tailRotZ: 0.26,  trunkRotZ: 0.15, headRotZ: -0.3 },  // radians
    // hold for freezeDuration...
    { time: 0.4 + freezeDur, tailRotZ: 0.26, trunkRotZ: 0.15, headRotZ: -0.3 },
    { time: 0.4 + freezeDur + 0.8, tailRotZ: 0, trunkRotZ: 0, headRotZ: 0 }
];
```

**`freeze-crawl` (PLCI, PLGL):**
Freeze in place for the species-specific freeze duration (PLCI: 1--3s, PLGL: 1--2s). Then begin a slow crawl away. Crawl is implemented as translation along the mesh's forward axis at a speed proportional to `species.behavior.speed`:
- `slow` (PLCI): 2 mm/s in model space (~0.002 units/frame at 60fps)
- `moderate` (PLGL): 4 mm/s

During the crawl, add a slight sinusoidal lateral oscillation to simulate body undulation:
```js
mesh.position.x += Math.sin(crawlTime * 6) * 0.0003; // lateral wobble
mesh.rotation.y += Math.sin(crawlTime * 6) * 0.01;   // yaw oscillation
```

PLCI also gets a tail undulation -- the tail segment oscillates laterally at 2x the body frequency, 3x amplitude.

**`rapid-escape` (DEFU, EUBI):**
Brief freeze (0.3--0.8s), then fast escape. Speed:
- `fast`: 15 mm/s in model space

The escape direction is chosen randomly (weighted toward the nearest edge of the visible area). The animal accelerates over 200ms (ease-in), reaches full speed, and exits the examination frame. DEFU may "jump" -- a single parabolic arc (Y translation up then down over 150ms, X translation of 30mm) triggered with 30% probability before the crawl begins.

**`moderate-escape` (DEMO):**
Freeze 0.5--1.5s, then moderate crawl at 6 mm/s. No jump. Steady retreat.

**`slow-retreat` (GYPO):**
Freeze 1--3s, then very slow crawl at 3 mm/s. Minimal body undulation. Matches the sluggish temperament of this large species.

### 4.3 Tail Autotomy

10% of individuals have `healthCondition: 'regeneratingTail'`. For these, the tail segment is shortened to 60% of normal length and the tip geometry is blunted (remove the taper -- set tail tip radius to 40% of base rather than the normal 15%). The regenerating portion is rendered slightly lighter in the albedo texture (add a `rgba(255, 255, 255, 0.12)` overlay to the tail region beyond the truncation point).

---

## 5. In-Hand Examination

This is the core pedagogical interaction. The student picks up the salamander and rotates it in their hands to look for diagnostic features.

### 5.1 VR Mode (WebXR)

When the student grabs the salamander (selectstart event on the XR controller), the mesh detaches from world space and parents to the grip space of the active controller.

```js
function onGrab(controller, salamanderMesh) {
    // Remove from scene root, parent to controller grip space
    scene.remove(salamanderMesh);
    controller.grip.add(salamanderMesh);

    // Position in the palm -- offset so the animal sits naturally
    salamanderMesh.position.set(0, 0.02, -0.06); // 2cm above grip, 6cm forward
    salamanderMesh.rotation.set(0, 0, 0);

    // Scale for comfortable examination (~15cm apparent length for avg species)
    var examScale = 1.5;
    salamanderMesh.scale.setScalar(examScale);

    // Switch to LOD 0 if not already
    salamanderMesh.forceLOD(0);

    // Enable breathing animation
    salamanderMesh.userData.examining = true;
}
```

The student rotates their wrist to see dorsal, ventral, and lateral views. The mesh stays attached to the grip transform -- no additional input mapping needed. The natural hand rotation provides all examination angles.

**Key considerations:**
- The ventral surface must be textured. Students flip the animal to check belly color and pattern (salt-and-pepper on PLCI, pale on DEFU, dark on PLGL). The UV unwrap must include full ventral coverage.
- The grip offset (0, 0.02, -0.06) positions the animal so the head extends past the fingertips and the body rests in the palm. This matches how a field researcher actually holds a salamander.
- Scale factor of 1.5x makes the animal comfortably large enough to see detail features at arm's length without being cartoonishly oversized.

**Release:** On selectend, re-parent to the scene at the current world position, ease the animal back to ground level over 300ms (simple Y-axis lerp down), resume the behavioral response animation from wherever it was paused.

### 5.2 Desktop Mode (OrbitControls)

For non-VR browsers, examination uses OrbitControls centered on the animal.

```js
function startDesktopExamination(salamanderMesh, camera) {
    // Tween camera to examination position
    var targetPos = salamanderMesh.position.clone().add(new THREE.Vector3(0, 0.08, 0.12));
    tweenCamera(camera, targetPos, salamanderMesh.position, 600);

    // Enable OrbitControls with animal as target
    orbitControls.target.copy(salamanderMesh.position);
    orbitControls.minDistance = 0.05;
    orbitControls.maxDistance = 0.30;
    orbitControls.enablePan = false;
    orbitControls.enabled = true;

    // Lock LOD to 0
    salamanderMesh.forceLOD(0);
}
```

Mouse drag rotates the camera around the animal. Scroll zooms in/out within the 5--30cm range. No panning -- the animal stays centered. This approximates the VR experience with standard input.

### 5.3 Diagnostic Feature Visibility Checklist

Each feature that students use for identification must be visible and unambiguous during in-hand examination:

| Feature | Implementation | Visible At |
|---|---|---|
| Costal grooves | Geometry (edge loop displacement) + normal map lines | LOD 0, <20cm |
| Spot pattern | Albedo texture | LOD 0, <50cm |
| Eye color | Emissive iris ring (see below) | LOD 0, <30cm |
| Tail shape (keeled vs round) | Morph target geometry | LOD 0, <40cm |
| Skin texture (granular vs smooth) | Normal map + roughness | LOD 0, <20cm |
| Belly pattern | Albedo texture (ventral UV region) | LOD 0, <20cm (flipped) |
| Jaw line (DEFU) | Albedo texture (head region) | LOD 0, <20cm |
| Dorsal stripe (PLCI) | Albedo texture (central dorsal band) | LOD 0, <50cm |
| Body size | Mesh scale | Any distance |

### 5.4 Eye Rendering

Eyes are not part of the body texture -- they are separate geometry (small sphere or hemisphere) positioned at the head region, with their own material. This allows:
- Species-specific iris color as an emissive tint (PSRU gold #c9a832, everyone else dark)
- A specular highlight that tracks the scene light
- A visible pupil slit or round pupil

```js
function createEye(species) {
    var irisColor = new THREE.Color(species.color.eye);

    var eyeGeo = new THREE.SphereGeometry(0.0008, 16, 16); // 0.8mm radius
    var eyeMat = new THREE.MeshStandardMaterial({
        color: irisColor,
        emissive: irisColor,
        emissiveIntensity: 0.3,    // subtle glow so it reads in shadow
        roughness: 0.15,           // wet, reflective
        metalness: 0.0
    });

    var eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);

    // Pupil: dark disc on front face
    var pupilGeo = new THREE.CircleGeometry(0.0004, 12);
    var pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    var pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.00075; // slightly proud of iris surface
    eyeMesh.add(pupil);

    // PSRU gets higher emissive to make the gold pop
    if (species.key === 'PSRU') {
        eyeMat.emissiveIntensity = 0.5;
    }

    return eyeMesh;
}
```

Two eye meshes are positioned symmetrically on the head. Position is derived from the UV head region: approximately (headLen * 0.55, +- headWidth * 0.25, headHeight * 0.3) in local coordinates.

---

## 6. Level of Detail (LOD)

Three LOD levels managed by THREE.LOD, switching based on camera distance.

### LOD 0: Full Detail (< 1 meter)

- **Mesh:** Full geometry with morph targets applied. Costal groove edge loops displaced. Eye spheres attached. 3-segment body (head/trunk/tail) for coil animation.
- **Textures:** 512x256 albedo (CanvasTexture), 512x256 normal map (CanvasTexture). Both generated per individual.
- **Material:** MeshStandardMaterial with map, normalMap, roughness, metalness set per species.
- **Triangle count:** ~6,000--8,000 per animal.
- **Memory:** ~1.5 MB textures per individual (two 512x256 RGBA canvases).

This is the examination LOD. All diagnostic features are fully resolved.

### LOD 1: Medium Detail (1--5 meters)

- **Mesh:** Simplified geometry. No morph targets -- species proportions baked into a simplified mesh at construction. No eye spheres. Single-piece body (no segmented animation). Limbs are simple tapered cylinders, 4 verts per cross-section instead of 8.
- **Textures:** 128x64 albedo (CanvasTexture, same painting code run at reduced resolution). No normal map.
- **Material:** MeshStandardMaterial with map only. Roughness from species config. No normalMap.
- **Triangle count:** ~1,500--2,000 per animal.
- **Memory:** ~64 KB texture per individual.

At this distance, the student sees a colored salamander shape with the correct spot pattern impression. Individual spots are not resolvable, but the overall color and pattern type (bright orange with spots, dark with white flecks, yellow with lines) read clearly.

### LOD 2: Billboard (> 5 meters)

- **Mesh:** A single quad (2 triangles) oriented toward the camera. Billboard behavior via `mesh.lookAt(camera.position)` each frame, constrained to Y rotation only (so the sprite stays upright on the ground).
- **Texture:** 64x32 pre-rendered canvas showing a simplified top-down salamander silhouette with species base color. Generated once per species (not per individual).
- **Material:** MeshBasicMaterial with map and alphaMap. No lighting calculations.
- **Triangle count:** 2.
- **Memory:** ~8 KB texture per species (shared).

At this distance, the salamander is a tiny colored shape on the forest floor. Its function is positional awareness ("there's something over there"), not identification.

### LOD Transition

```js
var lod = new THREE.LOD();
lod.addLevel(lodMesh0, 0);    // full detail, 0--1m
lod.addLevel(lodMesh1, 1.0);  // simplified, 1--5m
lod.addLevel(lodMesh2, 5.0);  // billboard, 5m+
scene.add(lod);
```

THREE.LOD handles switching automatically based on camera distance. No hysteresis is needed -- the visual differences between levels are subtle enough that pop-in is not distracting in a forest environment with complex ground clutter.

Exception: during in-hand examination (`userData.examining === true`), LOD is locked to 0 via `forceLOD(0)` regardless of nominal camera distance. The grip-parented mesh is physically close to the camera but the LOD system might miscalculate distance since the mesh is moving with the controller.

---

## 7. Performance Budget

### Per-Salamander Limits

| Resource | Budget | Notes |
|---|---|---|
| Triangles (LOD 0) | < 8,000 | Body + eyes + limbs |
| Triangles (LOD 1) | < 2,000 | Simplified body |
| Triangles (LOD 2) | 2 | Billboard quad |
| Texture memory (LOD 0) | < 1.5 MB | Two 512x256 RGBA |
| Texture memory (LOD 1) | < 64 KB | One 128x64 RGBA |
| Texture memory (LOD 2) | < 8 KB | One 64x32 RGBA (shared) |
| Draw calls | 2 (body + eyes) | LOD 0; LOD 1/2 = 1 each |
| Material | MeshStandardMaterial | Shared roughness/metalness uniforms per species |

### Scene-Level Budget

Worst case: 3 salamanders visible simultaneously (two under one cover object plus one from a previous flip still in frame). At LOD 0, that's 24,000 triangles and 4.5 MB texture memory for salamanders. In practice, only 1 animal is at LOD 0 during examination -- the others are at LOD 1 or LOD 2.

**Total scene triangle budget** (salamanders + forest floor + cover objects + environment): target < 100K triangles. Salamanders are well within the budget.

### Texture Generation Timing

Canvas texture rendering must complete in under 16ms to avoid frame drops during the cover-flip reveal. Benchmarks on a mid-range GPU (Quest 2 equivalent):

- 512x256 albedo: ~4ms (fill + spot pattern)
- 512x256 normal map: ~8ms (heightmap generation + Sobel conversion)
- Total: ~12ms

If this proves too tight, the normal map can be pre-generated during the approach transition (800--1000ms available) before the cover flip. The albedo is fast enough to generate on-flip.

### Material Sharing

All individuals of the same species share the same MeshStandardMaterial configuration (roughness, metalness). Only the textures differ. This means 8 material instances total, not one per animal.

```js
var speciesMaterials = {};
for (var key in SPECIES) {
    var sp = SPECIES[key];
    speciesMaterials[key] = new THREE.MeshStandardMaterial({
        roughness: getSpeciesRoughness(key),
        metalness: getSpeciesMetalness(key),
        // map and normalMap assigned per individual instance
    });
}
```

When creating an individual, clone the species material and assign its unique textures:

```js
var mat = speciesMaterials[speciesKey].clone();
mat.map = renderAlbedoTexture(species, traits);
mat.normalMap = renderNormalMap(species, traits);
```

### WebXR Frame Budget

Target: 72 fps on Quest 2, 90 fps on Quest 3. At 72 fps, the frame budget is 13.9ms. The salamander render (including LOD selection, transform animation, and material binding) should consume no more than 2ms of that budget, leaving the rest for environment, UI, and WebXR compositor overhead.

---

## Appendix: Material Properties Quick Reference

| Species | Roughness | Metalness | emissiveIntensity (eyes) | skinTexture | Normal Strength |
|---|---|---|---|---|---|
| NOVI | 0.85 | 0.00 | 0.3 | granular | 4.0 |
| PSRU | 0.35 | 0.00 | 0.5 | smooth | 1.5 |
| PLCI | 0.40 | 0.00 | 0.3 | smooth | 1.5 |
| PLGL | 0.25 | 0.05 | 0.3 | smooth-sticky | 1.0 |
| DEFU | 0.40 | 0.00 | 0.3 | smooth | 1.5 |
| EUBI | 0.40 | 0.00 | 0.3 | smooth | 1.5 |
| DEMO | 0.40 | 0.00 | 0.3 | smooth | 1.5 |
| GYPO | 0.38 | 0.00 | 0.3 | smooth | 1.5 |

## Appendix: Morph Target Assignments

| Species | headLarge | headSmall | tailLong | tailKeeled |
|---|---|---|---|---|
| NOVI | 1.0 | 0.0 | 0.0 | 1.0 |
| PSRU | 0.0 | 1.0 | 0.0 | 0.0 |
| PLCI | 0.0 | 0.0 | 0.8 | 0.0 |
| PLGL | 0.0 | 0.0 | 0.0 | 0.0 |
| DEFU | 0.5 | 0.0 | 0.0 | 1.0 |
| EUBI | 0.0 | 0.0 | 1.0 | 0.0 |
| DEMO | 0.5 | 0.0 | 0.0 | 1.0 |
| GYPO | 0.0 | 0.0 | 0.0 | 0.7 |
