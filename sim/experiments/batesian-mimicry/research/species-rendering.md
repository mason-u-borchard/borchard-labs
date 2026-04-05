# Species Rendering -- Scientific Illustration Approach for Canvas 2D

**Experiment:** Salamander Batesian Mimicry in Appalachian Forests
**Scope:** Programmatic rendering of 8 salamander species at field-guide illustration quality
**Platform:** Canvas 2D API (vanilla JS, no WebGL, no external image files)
**Date:** 2026-04-04

---

## 1. Scientific Illustration Philosophy

### What Makes Field Guide Illustrations Work

The best field guide plates -- Petranka's *Salamanders of the United States and Canada*, the Peterson series, Conant & Collins -- succeed not because they're photorealistic but because they're *editorially selective*. A photograph captures everything indiscriminately: glare, shadow, substrate color bleed, motion blur, poor angle. An illustration captures only what matters for identification, and it emphasizes those features beyond what a photograph can.

The principles:

1. **Diagnostic exaggeration.** Features that separate species are rendered at slightly higher contrast and clarity than they appear in life. The black borders around red eft spots are drawn crisply. The golden iris of *P. ruber* is rendered prominently. The pale jaw line of *D. fuscus* is a clean stroke.

2. **Consistent lighting.** Every animal is drawn under the same imaginary light source -- diffuse overhead, slightly anterior. This eliminates the visual noise of varying field lighting and lets students compare species on equal terms.

3. **Standardized pose.** Dorsal views are flat, limbs splayed at consistent angles. Lateral views show the animal in gentle profile with the tail fully extended. This is not how you find them in nature, but it's how you learn to see them.

4. **Clean background.** The animal is the data. No leaf litter, no substrate texture behind it. In the examination view, the salamander sits on a neutral field.

5. **Readable at distance.** Spot patterns, stripes, and body outlines must remain identifiable when the animal is drawn at 60px total length on the survey canvas. At that scale, the rendering is a silhouette with color -- the spots collapse into a texture impression rather than individually resolved circles.

### The Balance for Canvas 2D

We're not painting watercolors. The Canvas 2D API gives us:
- Bezier paths (body outlines)
- Solid fills and gradient fills (body color, sheen)
- Arcs and ellipses (spots, eyes)
- Compositing modes (overlays for texture)
- Shadow/blur (subtle soft edges)

This is enough. The goal is "illustration" not "painting" -- clean vector-like shapes with careful coloring. Think of it as a digital version of the pen-and-wash technique used in classic field guides.

---

## 2. Rendering Wet, Glossy Skin

### Plethodontid Sheen (Smooth Skin)

Most species in this sim are plethodontids with smooth, moist skin. In life, their skin has a wet sheen that creates soft specular highlights along the dorsal midline and darker tonal values where the body curves away from the light.

**Canvas technique -- dorsal view:**

```
// 1. Fill the body shape with the base color
ctx.fillStyle = baseColor;
ctx.fill(bodyPath);

// 2. Dorsal highlight: a narrow elliptical gradient along the spine
let dorsalGrad = ctx.createRadialGradient(
    cx, cy - bodyW * 0.1, 0,
    cx, cy - bodyW * 0.1, bodyW * 0.6
);
dorsalGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
dorsalGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.06)');
dorsalGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = dorsalGrad;
ctx.fill(bodyPath);

// 3. Ventral shadow: darken the edges where the body curves under
let ventralGrad = ctx.createLinearGradient(cx, cy - bodyW, cx, cy + bodyW);
ventralGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
ventralGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
ventralGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
ctx.fillStyle = ventralGrad;
ctx.fill(bodyPath);

// 4. Specular "wet spots": 2-3 small bright ellipses on trunk
ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
ctx.beginPath();
ctx.ellipse(cx - bodyLen * 0.08, cy - bodyW * 0.2, 3, 1.5, -0.3, 0, Math.PI * 2);
ctx.fill();
```

The specular spots should be placed with slight randomization per individual (seeded by a hash of the animal's traits) so they don't flicker between frames but do vary between animals.

### Newt Skin (Granular Texture)

The red eft's skin is rough and dry-looking -- distinctly different from plethodontid skin. In illustration, this is rendered as dense stippling: many tiny dots overlaid on the base color to break up the smooth gradient.

**Canvas technique:**

```
// After filling the base body color, overlay stipple dots
// Use a seeded PRNG so dots are consistent across frames
let rng = seededRandom(individual.id);
ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
for (let i = 0; i < 120; i++) {
    let tx = bodyStart + rng() * bodyLength;
    let ty = cy + (rng() - 0.5) * bodyW * 1.6;
    // Only draw if point is inside the body path
    if (ctx.isPointInPath(bodyPath, tx, ty)) {
        ctx.beginPath();
        ctx.arc(tx, ty, 0.4 + rng() * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}
// Add a second pass of lighter dots for the "raised gland" look
ctx.fillStyle = 'rgba(255, 200, 150, 0.08)';
for (let i = 0; i < 40; i++) {
    let tx = bodyStart + rng() * bodyLength;
    let ty = cy + (rng() - 0.5) * bodyW * 1.4;
    if (ctx.isPointInPath(bodyPath, tx, ty)) {
        ctx.beginPath();
        ctx.arc(tx, ty, 0.6 + rng() * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}
```

At ground-view scale (60px), reduce the stipple count to ~20 dots and increase their opacity slightly so the texture reads as "rough" even at low resolution.

### Slimy Salamander Gloss

*P. glutinosus* has the glossiest skin in this assemblage. Its jet-black body should have a stronger specular highlight than other species -- a wider, brighter dorsal sheen line. The white flecks sit on top of this gloss.

---

## 3. Body Shape Drawing -- Canvas Path Data

### Current Problem

The existing code draws bodies as ellipses and tails as simple quadratic curves. This produces shapes that are symmetrical, blobby, and biologically wrong. Real salamanders have:
- Heads that are distinct from the neck (narrowing behind the jaw, then widening at the trunk)
- Trunks that are widest at the mid-point and taper toward both ends
- Tails that arise from a thick base and taper to a fine point, with species-specific cross-sections
- Limbs that emerge from specific insertion points, not from the ellipse edge

### General Approach for Body Outlines

Each body outline should be drawn as a single closed path using `bezierCurveTo()` calls. The path traces the dorsal (top-down) silhouette of the animal, starting at the snout tip, running along the right side to the tail tip, then back along the left side to the snout.

All coordinates are normalized to a unit body where total length = 1.0 and maximum body width = 1.0. The drawing function scales these to the actual pixel dimensions.

### Species-Specific Body Outlines

#### Notophthalmus viridescens (Red Eft) -- THE MODEL

**Silhouette characteristics:**
- Head relatively large for body size (22% of total length), broadly rounded snout
- Prominent eyes that bulge slightly beyond the head outline
- Distinct neck constriction -- head is wider than the neck
- Trunk roughly cylindrical, widest at mid-trunk
- Tail laterally compressed with a slight dorsal keel, about 45% of total length
- Tail tapers to a rounded (not sharp) tip
- Overall: compact, chunky proportions

**Head shape:** Broad, rounded, almost spatulate. The snout is bluntly rounded in dorsal view. Eyes sit laterally, about 55% back from snout tip, and protrude slightly beyond the head margin. Head width is about 115% of trunk width.

**Trunk:** Short relative to total length (33% of TL). Nearly parallel-sided in dorsal view with gentle convex curvature. Width-to-length ratio about 1:2.8.

**Tail:** Laterally compressed. In dorsal view, starts wide (80% of trunk width) and tapers relatively quickly. The dorsal keel makes the tail appear slightly thicker in lateral view. Tip is blunt-rounded, not whip-thin.

**Limbs:** 4 toes on front feet, 5 on rear (though at our scale, individual toes are only visible at examination view). Front limbs insert just behind the head-trunk junction. Rear limbs insert at roughly 88% of trunk length. Limbs are relatively short and stout compared to plethodontids. In dorsal view, they splay at about 45 degrees from the body axis.

**Canvas path (dorsal view, normalized coordinates):**

```javascript
// Red Eft dorsal outline
// Origin at snout tip, x increases toward tail, y=0 is midline
// Total length normalized to 1.0, max half-width ~0.06 (body) to ~0.07 (head)
function drawEftOutline(ctx, x0, y0, totalLen, scale) {
    let s = totalLen; // scale factor
    ctx.beginPath();

    // Start at snout tip
    ctx.moveTo(x0, y0);

    // RIGHT SIDE: snout to tail tip

    // Snout curve -- broad, rounded
    ctx.bezierCurveTo(
        x0 + 0.03 * s, y0 - 0.05 * s,   // cp1: slight forward bulge
        x0 + 0.08 * s, y0 - 0.065 * s,  // cp2: widening to eye area
        x0 + 0.12 * s, y0 - 0.07 * s    // eye position, widest head point
    );

    // Head past eye to neck constriction
    ctx.bezierCurveTo(
        x0 + 0.16 * s, y0 - 0.068 * s,  // cp1: behind eye
        x0 + 0.19 * s, y0 - 0.055 * s,  // cp2: narrowing toward neck
        x0 + 0.22 * s, y0 - 0.048 * s   // neck constriction (head-trunk junction)
    );

    // Neck to mid-trunk (widening)
    ctx.bezierCurveTo(
        x0 + 0.26 * s, y0 - 0.052 * s,  // cp1: trunk begins widening
        x0 + 0.32 * s, y0 - 0.058 * s,  // cp2: approaching max width
        x0 + 0.38 * s, y0 - 0.06 * s    // mid-trunk, maximum width
    );

    // Mid-trunk to tail base (narrowing)
    ctx.bezierCurveTo(
        x0 + 0.44 * s, y0 - 0.058 * s,  // cp1: beginning to narrow
        x0 + 0.50 * s, y0 - 0.05 * s,   // cp2: approaching tail base
        x0 + 0.55 * s, y0 - 0.042 * s   // tail base
    );

    // Tail: wide base tapering to blunt tip
    ctx.bezierCurveTo(
        x0 + 0.65 * s, y0 - 0.032 * s,  // cp1: first third of tail
        x0 + 0.80 * s, y0 - 0.018 * s,  // cp2: mid-tail
        x0 + 0.92 * s, y0 - 0.006 * s   // near tail tip
    );

    // Tail tip (blunt-rounded)
    ctx.bezierCurveTo(
        x0 + 0.97 * s, y0 - 0.003 * s,
        x0 + 1.00 * s, y0,
        x0 + 0.97 * s, y0 + 0.003 * s
    );

    // LEFT SIDE: tail tip back to snout (mirror of right side)
    ctx.bezierCurveTo(
        x0 + 0.92 * s, y0 + 0.006 * s,
        x0 + 0.80 * s, y0 + 0.018 * s,
        x0 + 0.65 * s, y0 + 0.032 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.55 * s, y0 + 0.042 * s,
        x0 + 0.50 * s, y0 + 0.05 * s,
        x0 + 0.44 * s, y0 + 0.058 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.38 * s, y0 + 0.06 * s,
        x0 + 0.32 * s, y0 + 0.058 * s,
        x0 + 0.26 * s, y0 + 0.052 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.22 * s, y0 + 0.048 * s,
        x0 + 0.19 * s, y0 + 0.055 * s,
        x0 + 0.16 * s, y0 + 0.068 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.12 * s, y0 + 0.07 * s,
        x0 + 0.08 * s, y0 + 0.065 * s,
        x0 + 0.03 * s, y0 + 0.05 * s
    );

    // Return to snout tip
    ctx.bezierCurveTo(
        x0 + 0.01 * s, y0 + 0.03 * s,
        x0, y0 + 0.01 * s,
        x0, y0
    );

    ctx.closePath();
}
```

#### Pseudotriton ruber (Red Salamander) -- THE MIMIC

**Silhouette characteristics:**
- Head proportionally smaller relative to body than the eft (16% of TL)
- Snout slightly longer, less blunt than the eft -- this is a field mark
- No neck constriction -- head flows smoothly into a stout trunk
- Trunk is stout, broad, longest body segment (42% of TL)
- Costal grooves visible as subtle transverse lines at examination scale (16-18 grooves)
- Tail round in cross-section, about 42% of TL, relatively short for a plethodontid
- Overall: heavier, more elongate than the eft

**Head shape:** Narrower than the eft relative to body width. Snout is slightly pointed in dorsal view -- not squared off. Eyes less prominent, sit more within the head outline rather than bulging. Head width is about 90-95% of trunk width.

**Trunk:** Long and stout. The body has a distinctly heavier build than the eft. Widest at about 40% of trunk length. Width-to-length ratio about 1:3.5.

**Tail:** Round in cross-section (no keel). In dorsal view, tapers more gradually than the eft's tail. Tip is finer and more pointed.

**Limbs:** 4 toes front, 5 rear. Longer and more slender than eft limbs. Front limbs insert further back (plethodontid proportions). Rear limbs insert at about 85% of trunk length. In dorsal view, limbs extend further from the body -- plethodontids are generally leggier.

**Canvas path (dorsal view, normalized coordinates):**

```javascript
// Red Salamander dorsal outline
function drawPsruOutline(ctx, x0, y0, totalLen, scale) {
    let s = totalLen;
    ctx.beginPath();

    // Start at snout tip -- slightly more pointed than eft
    ctx.moveTo(x0, y0);

    // RIGHT SIDE

    // Snout curve -- narrower, slightly pointed
    ctx.bezierCurveTo(
        x0 + 0.02 * s, y0 - 0.03 * s,
        x0 + 0.05 * s, y0 - 0.048 * s,
        x0 + 0.08 * s, y0 - 0.052 * s   // eye area
    );

    // Past eye, smooth transition to trunk (no neck constriction)
    ctx.bezierCurveTo(
        x0 + 0.11 * s, y0 - 0.054 * s,
        x0 + 0.14 * s, y0 - 0.056 * s,
        x0 + 0.16 * s, y0 - 0.057 * s   // head-trunk boundary
    );

    // Trunk widens to maximum
    ctx.bezierCurveTo(
        x0 + 0.22 * s, y0 - 0.060 * s,
        x0 + 0.30 * s, y0 - 0.065 * s,
        x0 + 0.38 * s, y0 - 0.067 * s   // maximum trunk width
    );

    // Trunk narrows toward tail base
    ctx.bezierCurveTo(
        x0 + 0.46 * s, y0 - 0.064 * s,
        x0 + 0.52 * s, y0 - 0.055 * s,
        x0 + 0.58 * s, y0 - 0.044 * s   // tail base
    );

    // Tail taper -- more gradual than eft
    ctx.bezierCurveTo(
        x0 + 0.68 * s, y0 - 0.032 * s,
        x0 + 0.78 * s, y0 - 0.020 * s,
        x0 + 0.88 * s, y0 - 0.010 * s
    );

    // Tail tip -- finer point
    ctx.bezierCurveTo(
        x0 + 0.94 * s, y0 - 0.005 * s,
        x0 + 1.00 * s, y0,
        x0 + 0.94 * s, y0 + 0.005 * s
    );

    // LEFT SIDE (mirror)
    ctx.bezierCurveTo(
        x0 + 0.88 * s, y0 + 0.010 * s,
        x0 + 0.78 * s, y0 + 0.020 * s,
        x0 + 0.68 * s, y0 + 0.032 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.58 * s, y0 + 0.044 * s,
        x0 + 0.52 * s, y0 + 0.055 * s,
        x0 + 0.46 * s, y0 + 0.064 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.38 * s, y0 + 0.067 * s,
        x0 + 0.30 * s, y0 + 0.065 * s,
        x0 + 0.22 * s, y0 + 0.060 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.16 * s, y0 + 0.057 * s,
        x0 + 0.14 * s, y0 + 0.056 * s,
        x0 + 0.11 * s, y0 + 0.054 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.08 * s, y0 + 0.052 * s,
        x0 + 0.05 * s, y0 + 0.048 * s,
        x0 + 0.02 * s, y0 + 0.03 * s
    );

    ctx.bezierCurveTo(
        x0 + 0.01 * s, y0 + 0.015 * s,
        x0, y0 + 0.005 * s,
        x0, y0
    );

    ctx.closePath();
}
```

#### Other Species -- Outline Notes

**Plethodon cinereus (Red-backed Salamander):**
- Slender and elongate -- the most pencil-shaped species in this assemblage
- Head small, barely wider than neck, snout rounded
- Trunk very long, narrow (width-to-length ~1:5)
- Tail very long (50% of TL), round, gradually tapering to a fine whip-like tip
- 19 costal grooves (most of any species here)
- Overall silhouette: a thin line with tiny legs

**Plethodon glutinosus (Slimy Salamander):**
- Heavier build than *P. cinereus* but still elongate
- Head slightly wider with a more rounded snout
- Trunk broad for a *Plethodon*, stout
- Tail long (48% of TL), round, tapering
- 16 costal grooves
- Overall: a large, solid-looking plethodontid

**Desmognathus fuscus (Northern Dusky Salamander):**
- Robust head, distinctly wedge-shaped in dorsal view -- broader at the rear
- Hind limbs markedly larger than forelimbs (diagnostic for *Desmognathus*)
- Tail laterally compressed with a distinct dorsal keel, knife-edge in cross-section
- Tail shorter than SVL -- about 45% of TL
- 14 costal grooves
- Overall: chunky front end, muscular hind legs, compressed tail

**Eurycea bislineata (Two-lined Salamander):**
- Very slender, lithe body
- Head small, snout slightly pointed
- Trunk narrow and elongate
- Tail very long (52% of TL), round, very thin at tip
- 16 costal grooves
- Overall: slim, delicate, long-tailed

**Desmognathus monticola (Seal Salamander):**
- Heaviest-built *Desmognathus* in this assemblage
- Broad, flat head -- distinctly wider than neck
- Massive jaw muscles give the head a triangular appearance from above
- Hind limbs very robust
- Tail keeled, about 44% of TL
- 14 costal grooves
- Overall: a powerfully built stream salamander

**Gyrinophilus porphyriticus (Spring Salamander):**
- Largest species in this assemblage (up to 200mm TL)
- Head broad with distinctive squared-off snout
- Canthus rostralis (ridge from eye to snout tip) is a diagnostic feature -- render as a subtle pale line
- Trunk long and moderately stout
- Tail keeled, about 46% of TL
- 18 costal grooves
- Overall: large, somewhat lumbering, with a distinctive flat-topped head

---

## 4. Multi-View Rendering

### Dorsal View (Top-Down)

The default view. This is what you see when you flip a cover object and look down at the animal.

**Visible diagnostic features:**
- Dorsal coloration and overall body color
- Spot patterns (bordered-rows, scattered, flecked, etc.)
- Dorsal stripe (*P. cinereus* striped morph)
- Lateral lines (*E. bislineata*)
- Body proportions and head shape
- Skin texture (granular vs. smooth)
- Tail shape (width of tail base, taper rate)

**Drawing approach:**
The body outline is the full dorsal silhouette (as described in Section 3). The animal fills most of the examination canvas width. All pattern overlays (spots, stripes, flecks) are drawn on top of the base body fill and gradients.

At ground-view scale (~60px), the dorsal view should still read clearly: body color, overall shape, and the general impression of the spot pattern (dense/sparse, organized/random) should be distinguishable.

### Lateral View (Side Profile)

Shown when the student clicks a "Side View" button in the examination panel.

**Visible diagnostic features:**
- Body depth (how tall/thin the animal is in lateral profile)
- Tail cross-section: round vs. keeled -- this is critical. A keeled tail has a visible dorsal fin-like ridge; a round tail is a smooth oval
- Jaw line (*D. fuscus*: pale line from eye to angle of jaw)
- Costal groove count (visible as vertical lines along the flanks)
- Eye position and size
- Snout profile (blunt vs. pointed)
- Relative limb size (hind limbs larger in *Desmognathus*)
- Dorsal keel on tail (*N. viridescens*)

**Drawing differences from dorsal:**
- The body is much narrower -- a lateral salamander is roughly 1/3 to 1/2 the width of the dorsal view
- The outline is a different shape: flat belly, curved back, with the head in profile showing the snout, eye, and jaw angle
- Spots appear foreshortened or only partially visible (only those on the visible flank)
- Costal grooves are most visible in this view
- Limbs are drawn in profile: one set overlapping the body, one visible as small projections

**Canvas approach:**
Use a separate bezier path for the lateral outline. The path traces: snout tip -> top of head -> dorsal midline -> tail dorsal edge -> tail tip -> tail ventral edge -> vent -> belly -> chin -> snout tip.

### Ventral View (Belly-Up)

Shown when the student clicks a "Flip" button.

**Visible diagnostic features:**
- Belly coloration: yellow-orange (*N. viridescens*), pinkish-white (*P. ruber*), salt-and-pepper mottled (*P. cinereus*), dark (*P. glutinosus*), whitish (*D. fuscus*)
- Chin spots or melanistic chin (*P. ruber schencki*)
- Belly spot pattern -- eft belly is yellow with fine black spots
- Throat gular fold presence
- Toe count: 4 front / 5 rear (visible when flipped)

**Drawing differences from dorsal:**
- The outline is nearly identical to the dorsal view but reversed (belly is the visible surface)
- No dorsal spots or stripes visible -- replaced by belly coloration
- Limbs show ventral side, toe pads may be visible at exam scale
- The belly pattern is drawn instead of the dorsal pattern

**Canvas approach:**
Reuse the dorsal outline path. Apply belly color as the base fill. Overlay belly-specific patterns (salt-and-pepper stipple for *P. cinereus*, yellow with black dots for *N. viridescens*, etc.).

---

## 5. Spot Pattern Rendering

### Red Eft Spots (bordered-rows) -- Aposematic Signal

The red eft's spots are its warning badge. They must look deliberate, almost printed -- clean, well-defined, and symmetrically arranged. This is an honest signal of toxicity, not camouflage.

**Biological accuracy:**
- Two dorsolateral rows of spots, roughly symmetric left-right
- Each spot is a red/vermillion/orange circle with a distinct black ring around it
- Typical count: 2-5 spots per side per row (occasionally up to 7)
- Spots are roughly evenly spaced along the trunk
- Some spots may extend onto the tail base
- Spot diameter: about 1.5-2.5mm in life, or roughly 5-8% of trunk width

**Canvas rendering at examination scale:**

```javascript
function drawEftSpots(ctx, traits, trunkStart, trunkLen, cy, bodyW) {
    let rng = seededRandom(traits.id);
    let spotsPerSide = 3 + Math.floor(rng() * 3); // 3-5 spots per side

    for (let row = -1; row <= 1; row += 2) {
        for (let i = 0; i < spotsPerSide; i++) {
            // Evenly spaced with slight jitter
            let spacing = trunkLen / (spotsPerSide + 1);
            let sx = trunkStart + (i + 1) * spacing + (rng() - 0.5) * spacing * 0.2;
            let sy = cy + row * bodyW * 0.4 + (rng() - 0.5) * bodyW * 0.08;

            let spotR = bodyW * 0.12 + rng() * bodyW * 0.04;

            // Black border ring
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.arc(sx, sy, spotR + spotR * 0.35, 0, Math.PI * 2);
            ctx.fill();

            // Red/vermillion center
            ctx.fillStyle = '#cc3311';
            ctx.beginPath();
            ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
```

**Variation:**
- Spot count: Poisson(lambda=4), clamped to [2, 7]
- Spot positions: jittered +-10% of spacing interval
- Occasional asymmetry: one row might have one more spot than the other
- Spot size: +-20% of base radius
- Rare: a spot on the head, or one on the tail base

### Red Salamander Spots (scattered) -- Age-Dependent

The red salamander's spots are the anti-eft: random, unbordered, and increasingly messy with age. Young *P. ruber* are the hardest to distinguish from efts because their spots are small and sparse on a bright background.

**Biological accuracy:**
- Irregular black spots scattered across the entire dorsum, flanks, and tail
- No borders, no row organization -- genuinely random placement
- Young animals: fewer spots (15-30), brighter red-orange background, spots are small and discrete
- Old animals: spots enlarge, merge into blotches, background darkens to brownish-red or purplish
- Spots also appear on the head and legs (unlike eft spots which are mostly trunk)
- Spot density is higher toward the dorsal midline

**Age-dependent rendering (using SVL as proxy):**

```javascript
function drawPsruSpots(ctx, traits, bodyStart, bodyLen, cy, bodyW) {
    let rng = seededRandom(traits.id);
    let svlFrac = (traits.svl - 35) / (80 - 35); // 0 = youngest, 1 = oldest

    // Spot count increases with age
    let spotCount = Math.round(15 + svlFrac * 40); // 15-55 spots

    // Spot size increases with age
    let baseSpotR = bodyW * 0.04 + svlFrac * bodyW * 0.06;

    // Background darkening is handled by the body color system (satOffset)

    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < spotCount; i++) {
        let sx = bodyStart + rng() * bodyLen;
        let sy = cy + (rng() - 0.5) * bodyW * 1.5;

        // Cluster more spots near the dorsal midline
        sy = cy + (sy - cy) * (0.5 + rng() * 0.5);

        let sr = baseSpotR * (0.5 + rng() * 1.0);

        // Old animals: some spots merge (draw as ellipses)
        if (svlFrac > 0.6 && rng() < 0.2) {
            let angle = rng() * Math.PI;
            ctx.beginPath();
            ctx.ellipse(sx, sy, sr * 1.8, sr, angle, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
```

### Other Species Patterns

**P. cinereus striped morph -- Dorsal Stripe:**
- A clean, straight-edged copper-red to orangey-red stripe running from the base of the head to the tail tip
- Stripe width: about 35% of trunk width
- Edges are fairly crisp, not feathered
- The stripe narrows toward the tail tip, matching the body taper
- Flanks (outside the stripe) are dark gray-black
- Draw as a filled path that follows the body midline, clipped to the body outline

**P. cinereus leadback morph:**
- Uniformly dark gray-black on the dorsum -- no stripe
- May show very faint darker mottling at examination scale
- The belly is the diagnostic here: salt-and-pepper pattern of black and white

**P. cinereus erythristic morph:**
- Rare (2% of population) -- entirely reddish-orange
- Similar color to the dorsal stripe of the striped morph but covering the whole body
- No spots, no black flanks

**P. glutinosus -- White/Silver Flecks:**
- Dense scattering of white to silver-white flecks across a glossy black body
- Flecks are tiny (0.5-1.5mm in life) and irregularly shaped -- not perfect circles
- Fleck density is highest on the flanks and sides, somewhat less on the dorsal midline
- Some flecks are elongated, some clustered into small patches
- At ground-view scale, the overall impression should be "black with sparkle"
- Draw as tiny irregular ellipses with random rotation angles

**D. fuscus -- Dark Blotches:**
- Darker brown blotches/patches on a lighter brown background
- Young animals: a broad tan dorsal stripe with darker flanks and paired dark spots
- Old animals: the stripe fades, the whole dorsum becomes more uniformly dark brown
- Blotches are irregular, somewhat elongate, with soft edges
- Draw as semi-transparent dark ellipses with feathered edges (use radial gradients per blotch)

**E. bislineata -- Two Lateral Lines:**
- Two dark brown/black lines running from behind each eye along the flanks to about 60% of tail length
- Lines may break into dashes on the tail
- The dorsal stripe between the lines is bright yellow-green to golden-yellow
- Lines are about 1-2px wide at examination scale
- Draw as two stroked paths following the body outline at about 50% of body half-width

**D. monticola -- Reticulated Pattern:**
- Dark brown/black markings form a net-like pattern on a lighter tan-brown background
- Pattern is most distinct on younger animals, becomes obscured with age
- Markings look like irregular polygons or interconnected blotches
- Draw as a network of thin dark stroked ellipses/curves overlaid on the body
- At ground-view scale, this reads as "mottled brown"

**G. porphyriticus -- Faint Mottling:**
- Subtle dark streaks and flecks on a salmon-pink background
- Pattern is very faint compared to the other species -- almost looks plain-colored at a glance
- Draw as low-opacity (alpha ~0.10) dark streaks and dots
- The canthus rostralis line: a pale cream-colored line from each eye to the snout tip, paralleled below by a faint dark line -- render as two thin strokes at examination scale

---

## 6. Eye Rendering

The eye is a surprisingly important diagnostic in this system. At examination scale (~400px body length), the eye should be about 6-10px in diameter -- large enough to clearly show iris color.

### Rendering Structure

Every eye is drawn with the same three-layer structure:

```javascript
function drawEye(ctx, ex, ey, radius, irisColor, pupilColor) {
    // Layer 1: Iris (colored ring)
    ctx.fillStyle = irisColor;
    ctx.beginPath();
    ctx.arc(ex, ey, radius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: Pupil (dark center)
    ctx.fillStyle = pupilColor || '#0a0a0a';
    ctx.beginPath();
    ctx.arc(ex, ey, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: Specular highlight (tiny bright spot, upper-left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(ex - radius * 0.25, ey - radius * 0.25, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
}
```

### Species-Specific Eye Colors

**Red Eft (*N. viridescens*):**
- Iris: dark brown, almost black -- very little visible iris ring
- At typical viewing distance, the eye appears as a solid dark dot
- Iris color: `#2a2018` (very dark brown)
- The dark eye against the bright orange body is part of the gestalt

**Red Salamander (*P. ruber*):**
- Iris: gold/brass/yellow -- THE key diagnostic
- A dark horizontal bar runs through the pupil (render as a thin horizontal dark line across the iris)
- Iris color: `#c4a030` (rich gold)
- This eye immediately says "not an eft" to anyone who knows to look

```javascript
// P. ruber eye with horizontal bar
function drawPsruEye(ctx, ex, ey, radius) {
    // Gold iris
    ctx.fillStyle = '#c4a030';
    ctx.beginPath();
    ctx.arc(ex, ey, radius, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupil
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(ex, ey, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal bar through iris
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    ctx.moveTo(ex - radius * 0.95, ey);
    ctx.lineTo(ex + radius * 0.95, ey);
    ctx.stroke();

    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(ex - radius * 0.22, ey - radius * 0.28, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
}
```

**Other species:**
- *P. cinereus*: dark brown-black iris, `#1a1510`
- *P. glutinosus*: very dark, nearly black, `#151515`
- *D. fuscus*: dark brown, `#2a2520`
- *E. bislineata*: dark brown, `#252018`
- *D. monticola*: dark brown, `#2a2820`
- *G. porphyriticus*: medium brown, slightly lighter than others, `#3a3028`

At ground-view scale (~60px body), eyes are reduced to a single 1-2px dark dot. No iris detail is visible. Color is irrelevant at this scale -- the eye just provides a "face" to orient the animal.

---

## 7. Individual Variation System

### Color Variation

Each individual gets a unique appearance generated at construction time and stored in traits. The variation parameters:

**Hue shift:** `bodyHueOffset`
- Drawn from a uniform distribution within the species' `bodyRange`
- Red eft: [0, +20] degrees (varies from pure orange-red to slightly more orange)
- Red salamander: [-10, +15] degrees (varies from darker brick to more orange)
- Other species: typically +-5 to +-8 degrees

**Saturation shift:** `bodySatOffset`
- Small shifts around the base saturation
- Juveniles should trend toward higher saturation (more vivid)
- Old adults trend toward lower saturation (more muted)
- Implementation: bias the saturation offset by age class:
  - juvenile: +0.05 to +0.10
  - subadult: -0.02 to +0.05
  - adult: -0.08 to +0.02

**Lightness variation:**
- Not currently in the config but should be added
- +-5-10% lightness shift simulates "wet" (darker) vs. "dry" (lighter) appearance
- Could also correlate with the weather state -- animals found during rain are slightly darker/glossier

### Spot Variation

**Spot count:** Draw from Poisson(lambda = speciesMean), clamped to [min, max].
- Red eft: lambda=4, range [2, 7] per side
- Red salamander: base lambda=25, adjusted by age (see Section 5)

**Spot positions:** Seeded random placement. Each spot position is generated from the individual's seed, so it's consistent across frames and re-renders. A minimum-distance constraint prevents spots from overlapping:

```javascript
function generateSpotPositions(count, bounds, minDist, rng) {
    let spots = [];
    let attempts = 0;
    while (spots.length < count && attempts < count * 10) {
        let x = bounds.x + rng() * bounds.w;
        let y = bounds.y + rng() * bounds.h;
        let tooClose = false;
        for (let s of spots) {
            let dx = x - s.x, dy = y - s.y;
            if (dx * dx + dy * dy < minDist * minDist) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) spots.push({ x, y, r: 1.0 + rng() * 0.5 });
        attempts++;
    }
    return spots;
}
```

**Spot size variation:** Each spot radius is independently scaled by +-30% from the base.

### Size-Dependent Proportions

Juveniles (low SVL fraction) should have proportionally larger heads. This is a real allometric relationship in salamanders -- young animals are more head-heavy.

```
headRatio = baseHeadRatio + (1 - svlFrac) * 0.03
// A juvenile gets +3% head ratio, adult gets +0%
```

This slight adjustment makes juveniles look subtly different from adults even at the same drawing scale.

### Seed System

Every individual needs a deterministic seed derived from its construction parameters. Use a simple hash of the species key + a random ID assigned at construction. This seed drives all random variation (spot positions, stipple placement, color jitter) so the animal looks the same every time it's rendered.

```javascript
function seededRandom(seed) {
    // Simple mulberry32 PRNG
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
```

---

## 8. Implementation Approach

### Recommendation: Hybrid (Option 3)

**Use hand-authored SVG path data for base body outlines + programmatic overlays for everything else.**

The reasoning:

**Why not pure programmatic (Option 1):**
The bezier paths in Section 3 are functional but authoring beautiful organic curves by typing coordinate pairs is painful and error-prone. It's very difficult to iterate on the shape -- each adjustment requires re-running the code to see the result. The shapes will always feel slightly stiff compared to paths drawn freehand.

**Why not pure SVG imports (Option 2):**
Pre-drawn SVGs would give beautiful shapes but make variation difficult. We'd need 8 species x 3 views = 24 SVG shapes. Each would need to be flexible enough to accommodate size variation. And the spots/patterns still need to be programmatic (they vary per individual), so we'd be doing hybrid work anyway.

**Why hybrid works best:**

1. **Author body outlines in Inkscape/Illustrator.** Draw each species in each view (dorsal, lateral, ventral) as a clean vector path. These paths encode the species-specific silhouette -- the head shape, trunk proportions, tail taper, neck constriction (or lack thereof).

2. **Export as normalized path data.** Extract the SVG path `d` attribute and normalize coordinates to a unit box. Store this as a string constant in a `species-paths.js` module.

3. **Render on Canvas via `Path2D`.** At draw time, create a `Path2D` from the SVG data, apply a transform matrix to scale/position it, and fill/stroke it.

```javascript
// species-paths.js
export const BODY_PATHS = {
    NOVI: {
        dorsal: 'M 0,50 C 3,5 8,3 ...',  // SVG path data
        lateral: 'M 0,70 C 2,10 ...',
        ventral: 'M 0,50 C 3,95 ...'
    },
    PSRU: {
        dorsal: 'M 0,50 C 2,8 ...',
        // ...
    }
    // ...
};

// Drawing function
function drawSpeciesBody(ctx, speciesKey, view, x, y, length, width) {
    let pathData = BODY_PATHS[speciesKey][view];
    let path = new Path2D(pathData);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(length / 100, width / 100); // assuming 100x100 unit box
    ctx.fillStyle = bodyColor;
    ctx.fill(path);
    ctx.restore();
}
```

4. **Overlay programmatic details.** After drawing the base body shape, add:
   - Skin texture (stipple for newts, sheen for plethodontids)
   - Color gradients (dorsal highlight, ventral shadow)
   - Spot patterns (seeded per individual)
   - Dorsal stripe (*P. cinereus*)
   - Lateral lines (*E. bislineata*)
   - Costal grooves
   - Eyes
   - Limbs (these could also come from SVG paths or remain programmatic)

### Why This Meets the Constraints

**24 base shapes:** 8 species x 3 views. Each is a single SVG path string -- a few hundred characters. Total data for all 24 paths fits in <10KB of JS.

**Individual variation:** All variation (color, spots, size) is applied programmatically on top of the fixed body outline. The outline itself doesn't need to vary -- body proportions are close enough within a species that a single shape works at both juvenile and adult scale (the allometric head-ratio adjustment is applied via the scale transform).

**Two render scales:** The same path data works at both 60px and 400px. At 60px, fine details (costal grooves, individual spot shapes) are simply skipped. At 400px, everything is drawn.

**Performance:** `Path2D` objects should be created once and cached, not reconstructed every frame. Fill and stroke operations on cached paths are fast -- well under 1ms per animal. Total rendering budget of <5ms per animal per frame is easily met, even with 40+ stipple dots and a dozen spots.

**No external files:** All path data is embedded in JS source. No image loading, no SVG file fetching.

### Limb Rendering

Limbs are better done programmatically than via SVG because they need to respond to body size and vary slightly between individuals. The current approach (bent lines) should be upgraded to filled shapes:

```javascript
// Draw a single limb as a tapered filled shape
function drawLimb(ctx, shoulderX, shoulderY, angle, limbLen, thickness, toeCount, color) {
    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(angle);

    // Upper leg
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -thickness * 0.5);
    ctx.quadraticCurveTo(limbLen * 0.4, -thickness * 0.45, limbLen * 0.55, -thickness * 0.15);
    // Elbow bend
    ctx.quadraticCurveTo(limbLen * 0.6, thickness * 0.1, limbLen * 0.55, thickness * 0.15);
    ctx.quadraticCurveTo(limbLen * 0.4, thickness * 0.45, 0, thickness * 0.5);
    ctx.closePath();
    ctx.fill();

    // Lower leg (from elbow to foot)
    // ... similar tapered bezier shape

    // Toes (at examination scale only)
    if (limbLen > 15) { // only draw toes when big enough to see
        for (let t = 0; t < toeCount; t++) {
            // fan of tiny lines from the foot
        }
    }

    ctx.restore();
}
```

Front limbs: 4 toes. Rear limbs: 5 toes (except *N. viridescens* which has 4 rear toes -- a newt diagnostic that only matters in the hand).

---

## 9. Revised Color Palette

Colors below are based on photographic reference from AmphibiaWeb, the Virginia Herpetological Society photo archives, SREL Herpetology (Savannah River Ecology Lab), iNaturalist verified observations, and Petranka (1998) color descriptions. Each species lists the main body color, a light variant (young/bright individual), a dark variant (old/dull individual), and accessory colors.

### Notophthalmus viridescens (Red Eft)

| Element | Hex | Description |
|---|---|---|
| Body (main) | `#d45a28` | Bright orange-red, the classic eft color |
| Body (light) | `#e87040` | Young/fresh eft, more orange |
| Body (dark) | `#b84820` | Drier or older eft, more brick-red |
| Spot centers | `#c43018` | Vermillion-red, slightly darker than body |
| Spot borders | `#101010` | Near-black rings |
| Belly | `#e8b848` | Bright yellow-orange |
| Belly spots | `#1a1a1a` | Fine black dots on yellow belly |
| Eye (iris) | `#2a2018` | Very dark brown, nearly black |
| Eye (pupil) | `#080808` | Black |

Current config body color `#d4572a` is close but slightly too brown. Shift toward more vivid orange: `#d45a28`.

### Pseudotriton ruber (Red Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (main) | `#c44828` | Red-orange, slightly darker than eft |
| Body (light/young) | `#d85830` | Young animal, bright orange-red, closest to eft |
| Body (dark/old) | `#7a3028` | Old animal, dark brownish-red, almost maroon |
| Body (very old) | `#5c2828` | Ancient animal, purplish-dark red |
| Spots | `#181818` | Black, no borders |
| Belly | `#dca070` | Pinkish-cream, lighter than dorsum |
| Chin (dark morph) | `#2a2020` | Melanistic chin (subspecies schencki) |
| Eye (iris) | `#c4a030` | Rich gold/brass -- the key diagnostic |
| Eye (pupil) | `#0a0a0a` | Black |
| Eye (bar) | `#1a1208` | Dark horizontal bar through iris |

Current config body color `#b83a1f` is too dark for the average animal. Young *P. ruber* should be alarmingly close to eft color -- `#d85830` is only about 10 hue degrees from the eft's `#d45a28`.

### Plethodon cinereus (Red-backed Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (flanks) | `#3a3032` | Dark gray-brown to charcoal flanks |
| Body (leadback) | `#2e2a2c` | Leadback morph, uniformly dark |
| Dorsal stripe | `#b85030` | Copper-red to orangey-red |
| Stripe (bright) | `#c86038` | Vivid copper on a bright individual |
| Stripe (dull) | `#9a4028` | Duller brick on a dark individual |
| Erythristic body | `#c05535` | All-red morph, like the stripe color everywhere |
| Belly (white) | `#d0ccc8` | Pale gray-white base |
| Belly (pepper) | `#2a2828` | Black mottling on belly |
| Eye | `#1a1510` | Dark brown-black |

Current config body color `#5c3a28` is too warm/brown for the flanks -- they should be cooler and darker gray-brown. Current stripe `#b04a2a` is reasonable but slightly too dark.

### Plethodon glutinosus (Slimy Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (main) | `#141420` | Glossy blue-black |
| Body (highlight) | `#202030` | Wet sheen catches light with slight blue cast |
| White flecks | `#d8d8e0` | Silvery-white, slightly cool-toned |
| Brass flecks | `#b8a870` | Some individuals have brassy rather than white flecks |
| Belly | `#1a1a20` | Very dark, slightly lighter than dorsum |
| Throat | `#282830` | Slightly paler than belly |
| Eye | `#151515` | Essentially black |

Current config body color `#1a1a2e` is reasonable. The blue undertone is correct -- *P. glutinosus* is blue-black, not pure black.

### Desmognathus fuscus (Northern Dusky Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (main) | `#6a5a48` | Tan-brown, the most variable species |
| Body (light/young) | `#8a7858` | Lighter tan, younger individuals |
| Body (dark/old) | `#4a3a30` | Dark brown, older individuals |
| Body (reddish var) | `#7a5840` | Some individuals have reddish-brown tones |
| Dorsal blotches | `#3a3028` | Darker brown patches on dorsum |
| Jaw line | `#c8b898` | Pale cream line from eye to jaw angle |
| Belly | `#d4ccc0` | Whitish with gray flecks |
| Tail keel | `#584838` | Slightly darker line along dorsal keel |
| Eye | `#2a2520` | Dark brown |

Current config body `#6b5b47` is very close -- the brown tones are accurate. The jaw line color `#c8b898` is good.

### Eurycea bislineata (Two-lined Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (dorsal stripe) | `#c4a848` | Golden-yellow to yellowish-olive |
| Body (bright) | `#d4b850` | Vivid yellow-green on a fresh animal |
| Body (dull) | `#a89040` | More olive on a dull individual |
| Lateral lines | `#3a2e20` | Dark brown to black |
| Flanks | `#8a7848` | Darker yellow-brown below the lines |
| Belly | `#e8d868` | Bright yellow, especially under the tail |
| Tail underside | `#e8c838` | Distinctive bright yellow-orange |
| Eye | `#252018` | Dark brown |

Current config body `#c4a84a` is close. The lines color `#4a3a28` is reasonable but could be slightly darker.

### Desmognathus monticola (Seal Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (main) | `#7a6850` | Tan-brown, lighter than dusky |
| Body (light) | `#8a7860` | Lighter variant |
| Body (dark) | `#5a4838` | Darker/older variant |
| Reticulated marks | `#3a3028` | Dark brown, net-like pattern |
| Belly | `#d8ceb8` | Pale, nearly white |
| Flank spots | `#e0d8c8` | Small white spots along lower sides |
| Eye | `#2a2820` | Dark brown |

Current config body `#7a6b5a` is slightly too gray -- should trend warmer brown.

### Gyrinophilus porphyriticus (Spring Salamander)

| Element | Hex | Description |
|---|---|---|
| Body (main) | `#d4887a` | Salmon-pink, distinctive |
| Body (young) | `#e09888` | More vivid pink-orange in young animals |
| Body (old) | `#a06858` | Darker, more brownish in old animals |
| Mottling | `#7a5848` | Faint dark streaks and flecks |
| Canthus line (pale) | `#e8d8c8` | Pale line from eye to snout tip |
| Canthus line (dark) | `#685848` | Faint dark line paralleling below |
| Belly | `#e8c8b0` | Pale pinkish-cream |
| Eye | `#3a3028` | Medium brown, slightly lighter than most |

Current config body `#d4907a` is close -- could be very slightly more saturated/pink.

---

## 10. Performance Budget and Rendering Pipeline

### Drawing Order (per animal, per frame)

1. **Body fill** -- fill the cached `Path2D` with base color (~0.1ms)
2. **Dorsal gradient** -- fill path with highlight gradient (~0.1ms)
3. **Ventral shadow** -- fill path with shadow gradient (~0.1ms)
4. **Skin texture** -- stipple dots (newt: ~0.3ms) or sheen highlight (plethodontid: ~0.1ms)
5. **Pattern overlay** -- spots, stripes, flecks, lines (~0.2-0.5ms depending on count)
6. **Costal grooves** -- thin stroked lines at exam scale (~0.1ms)
7. **Limbs** -- 4 filled shapes (~0.2ms)
8. **Eyes** -- 2 layered circles with highlight (~0.1ms)
9. **Special features** -- jaw line, canthus line, tail keel (~0.1ms)

**Total estimated: 1.0-1.6ms at examination scale, <0.5ms at ground scale.**

Well within the 5ms budget. The ground-view rendering skips steps 2-4, 6, and 9, and reduces pattern detail in step 5.

### Caching Strategy

- `Path2D` objects: create once per species per view, reuse for all individuals of that species. Store in a module-level cache keyed by `speciesKey + '_' + view`.
- Individual variation (spot positions, stipple seed): compute once at construction time, store in traits. Do not re-randomize each frame.
- Color computations (adjustColor results): compute once at construction time, store in traits as `resolvedBodyColor`, `resolvedBellyColor`, etc.

### Level-of-Detail Thresholds

| Scale | Body Length | Detail Level |
|---|---|---|
| Ground overview | 40-60px | Silhouette + solid fill + simplified pattern |
| Hover preview | 80-120px | Add basic gradients + pattern |
| Examination view | 200-400px | Full detail: texture, costal grooves, eye iris, toes |

The `detail` boolean in the current code should be replaced with a numeric LOD value (0, 1, 2) corresponding to these three tiers.

---

## 11. File Organization

Recommended file structure for the rendering upgrade:

```
batesian-mimicry/
  species-paths.js       -- SVG path data for all 8 species, 3 views
  species-renderer.js    -- drawSalamanderBody() and all sub-functions
  Salamander.js           -- agent class (mostly unchanged, calls species-renderer)
  config.js              -- updated color palette (see Section 9)
```

The current monolithic `drawSalamanderBody()` / `drawSpots()` / `drawLimbs()` functions in `Salamander.js` should be extracted into `species-renderer.js`. This separates the rendering concern from the agent/entity concern and makes the drawing code independently testable.

### SVG Path Authoring Workflow

1. In Inkscape, create a 100x100 artboard for each species+view combination
2. Draw the body outline as a single closed bezier path
3. Keep it simple: 8-12 bezier segments per outline is sufficient
4. Export the path `d` attribute (not the full SVG file)
5. Paste into `species-paths.js` as a string constant
6. Test by rendering the path on a Canvas at various scales

For iteration speed, build a small test harness (`test-render.html`) that draws all 8 species side by side at both ground and examination scale. This allows visual comparison and rapid path adjustment without running the full simulation.

---

## Summary of Priorities

1. **Highest priority:** Nail the Red Eft vs. Red Salamander rendering. These two species are the pedagogical core. If a student can't tell them apart visually in the examination view, the mimicry simulation doesn't work. The key differentiators to get right: body proportions (eft is compact, *P. ruber* is elongate), skin texture (granular vs. smooth), spot pattern (bordered-rows vs. scattered), and eye color (dark vs. gold).

2. **Second priority:** *P. cinereus* striped and leadback morphs. This is 58% of all encounters. It must look good and be instantly recognizable as "not the red one."

3. **Third priority:** All other species, plus the three-view system, plus individual variation polish.
