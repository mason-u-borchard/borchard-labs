# Three.js + WebXR Architecture -- Batesian Mimicry 3D

Architecture document for replacing the Canvas 2D simulation with a photorealistic
first-person 3D experience using Three.js r170+ from CDN. Students walk through an
Appalachian cove hardwood forest, locate and flip cover objects, and identify
salamanders at close range. Desktop uses WASD + mouse. VR uses WebXR with
controller or hand tracking input.

---

## 1. CDN Import Strategy

No build tools. Everything loads via native ES module import maps resolved against
jsdelivr. Pin the exact version to avoid breakage.

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>

<script type="module" src="./3d/main.js"></script>
```

### Addon import paths

All addons resolve under `three/addons/` which maps to `examples/jsm/` on the CDN.

| Addon | Import path |
|-------|-------------|
| PointerLockControls | `three/addons/controls/PointerLockControls.js` |
| OrbitControls | `three/addons/controls/OrbitControls.js` |
| VRButton | `three/addons/webxr/VRButton.js` |
| XRControllerModelFactory | `three/addons/webxr/XRControllerModelFactory.js` |
| XRHandModelFactory | `three/addons/webxr/XRHandModelFactory.js` |
| OculusHandModel | `three/addons/webxr/OculusHandModel.js` |
| OculusHandPointerModel | `three/addons/webxr/OculusHandPointerModel.js` |
| GLTFLoader | `three/addons/loaders/GLTFLoader.js` |
| DRACOLoader | `three/addons/loaders/DRACOLoader.js` |
| RGBELoader | `three/addons/loaders/RGBELoader.js` |
| EXRLoader | `three/addons/loaders/EXRLoader.js` |
| EffectComposer | `three/addons/postprocessing/EffectComposer.js` |
| RenderPass | `three/addons/postprocessing/RenderPass.js` |
| OutputPass | `three/addons/postprocessing/OutputPass.js` |
| UnrealBloomPass | `three/addons/postprocessing/UnrealBloomPass.js` |
| SAOPass | `three/addons/postprocessing/SAOPass.js` |

DRACO decoder workers must point to the CDN path:

```javascript
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(dracoLoader);
```

---

## 2. Three.js Scene Setup

### Scene graph hierarchy

```
Scene
├── TerrainGroup
│   ├── GroundMesh (PlaneGeometry + displacement)
│   ├── StreamMesh (shaped plane, animated UVs)
│   └── RockFormations (InstancedMesh)
├── VegetationGroup
│   ├── TreeInstances (InstancedMesh, LOD x3)
│   ├── FernInstances (InstancedMesh, LOD x2)
│   ├── MossPatches (InstancedMesh, billboard at distance)
│   └── GroundCover (leaf litter plane with alpha map)
├── CoverObjectGroup
│   ├── Rocks (InstancedMesh per size class)
│   ├── Logs (individual Mesh -- low count, high detail)
│   ├── Boards (individual Mesh)
│   └── BarkPieces (individual Mesh)
├── AnimalGroup
│   ├── SalamanderMeshes (hidden until reveal)
│   └── InvertebrateMeshes (hidden until reveal)
├── LightingGroup
│   ├── DirectionalLight (sun)
│   ├── HemisphereLight (ambient sky/ground)
│   └── AmbientLight (fill -- low intensity)
├── AtmosphereGroup
│   ├── FogExp2 (scene-level, not a child)
│   ├── ParticleSystem (dust motes, falling leaves)
│   ├── GodRays (billboard planes in canopy gaps)
│   └── RainParticles (conditional on weather state)
├── PlayerRig (Group)
│   ├── PerspectiveCamera
│   ├── VR: XRController0
│   ├── VR: XRController1
│   ├── VR: Hand0
│   └── VR: Hand1
└── UIGroup (screen-space overlays, HUD sprites)
```

### WebGLRenderer configuration

```javascript
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setAnimationLoop(tick);
```

Cap `devicePixelRatio` at 2 to prevent 4x fill rate on retina displays from
tanking frame time. ACESFilmic produces naturalistic rolloff in highlights --
critical for the dappled sunlight look. SRGBColorSpace is mandatory for correct
texture display in r170+ (linear workflow internally, sRGB output).

### Camera

```javascript
const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 200);
camera.position.set(0, 1.65, 0);  // standing eye height
```

FOV 60 is a natural desktop field of view. Near plane 0.1 is tight enough for
close-up salamander inspection without z-fighting. Far plane 200 covers the
entire forest clearing with margin. In VR, the WebXR runtime overrides FOV and
near/far per-eye.

### Lighting

```javascript
// Sun -- directional with shadows
const sun = new THREE.DirectionalLight(0xfff4e0, 3.0);
sun.position.set(-15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;

// Sky/ground ambient
const hemi = new THREE.HemisphereLight(
    0x87CEEB,  // sky color -- soft blue
    0x3a5a2a,  // ground color -- forest floor green-brown
    1.5
);

// Atmospheric depth
scene.fog = new THREE.FogExp2(0x8899aa, 0.018);
```

Shadow map at 2048x2048 is the sweet spot -- sharp enough for cover object shadows
at 2m viewing distance, within the 128MB texture budget. The shadow camera frustum
(-30 to +30 on all axes) covers the playable transect area. `normalBias` at 0.02
eliminates shadow acne on the curved terrain without visibly offsetting shadows.

FogExp2 with density 0.018 produces ~50% opacity at 40m, giving depth to the
forest backdrop without hiding nearby cover objects. Fog density should modulate
with weather state: 0.025 for fogMist, 0.020 for overcast, 0.012 for clear.

---

## 3. WebXR Integration

### Session setup

```javascript
renderer.xr.enabled = true;

const sessionInit = {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking', 'bounded-floor']
};

document.body.appendChild(VRButton.createButton(renderer, sessionInit));
```

`local-floor` gives a ground-anchored reference space -- the player starts at
floor level with correct height. `hand-tracking` is optional so the experience
degrades gracefully to controllers on devices that don't support it.

### Controller setup

```javascript
const controllerModelFactory = new XRControllerModelFactory();

for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    controller.addEventListener('squeezestart', onSqueezeStart);
    controller.addEventListener('squeezeend', onSqueezeEnd);
    playerRig.add(controller);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    playerRig.add(grip);

    // Visible ray line
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);
    const rayLine = new THREE.Line(rayGeom, new THREE.LineBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.6
    }));
    rayLine.name = 'ray';
    rayLine.scale.z = 5;
    controller.add(rayLine);
}
```

Raycasting in VR is performed from the controller's world-space position and
orientation. Each frame, extract the controller's `matrixWorld`, decompose it, and
construct a `Raycaster` pointing along the controller's negative-Z axis. This
replaces the desktop screen-center raycast.

```javascript
function getControllerRay(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
    raycaster.set(origin, direction);
}
```

### Hand tracking

```javascript
const handModelFactory = new XRHandModelFactory();

for (let i = 0; i < 2; i++) {
    const hand = renderer.xr.getHand(i);
    hand.add(handModelFactory.createHandModel(hand, 'mesh'));
    playerRig.add(hand);

    hand.addEventListener('pinchstart', onPinchStart);
    hand.addEventListener('pinchend', onPinchEnd);
}
```

Pinch detection: the XR hand input API fires `pinchstart` / `pinchend` on the
`XRHand` object. The pinch origin is at the midpoint between the index fingertip
and thumb tip joints. Use this as the raycast origin for object interaction in
hand-tracking mode. Pinch replaces the trigger button for selection.

For grab interactions (picking up a flipped cover object to look underneath),
track the distance between index tip and thumb tip each frame. When distance <
0.02m, fire a custom `grab` event. The grabbed object parents to the hand group
and follows with a `THREE.Quaternion.slerp` lag of 0.15 for natural feel.

### Teleportation

The primary locomotion method in VR. The dominant-hand controller (index 1) owns
the teleport arc.

**Arc calculation:**

```javascript
function computeTeleportArc(controller, gravity, segments) {
    const points = [];
    const velocity = new THREE.Vector3(0, 0, -8);
    velocity.applyQuaternion(controller.quaternion);

    const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const dt = 1 / segments;

    for (let i = 0; i < segments; i++) {
        points.push(pos.clone());
        velocity.y -= gravity * dt;
        pos.add(velocity.clone().multiplyScalar(dt));
        if (pos.y < 0) {
            pos.y = 0;
            points.push(pos.clone());
            break;
        }
    }
    return points;
}
```

Render the arc as a `THREE.Line` with gradient opacity (1.0 at hand, 0.3 at
landing). At the landing point, display a ring indicator (torus geometry, green
when valid surface, red when obstructed). On trigger release, lerp the
`playerRig.position` to the landing point over 200ms with an ease-out curve.
Constrain teleport distance to 8m max to prevent students from skipping transect
segments.

**Snap-turn:**

Poll the thumbstick on the non-dominant controller (index 0) each frame. When
the X-axis exceeds 0.6 (dead zone 0.3), apply a 30-degree yaw rotation to
`playerRig` with a 300ms cooldown to prevent repeat firing. Haptic pulse on
snap: `controller.gamepad?.hapticActuators?.[0]?.pulse(0.3, 50)`.

### Performance targets

VR must sustain 72fps per eye (Quest 2/3 native rate). That's a 13.8ms total
frame budget per stereo pair -- the renderer draws the scene twice (once per eye),
so per-eye scene render must complete in ~6ms. The strategies:

- Reduce shadow map to 1024x1024 in VR mode
- Skip post-processing passes (bloom, SAO)
- Drop LOD thresholds by one level (near detail at 3m instead of 5m)
- Disable particle count above 8
- Use `renderer.xr.setFoveation(1.0)` for full foveated rendering on supported
  hardware (Quest 3 with eye tracking)

---

## 4. Desktop Controls

### PointerLockControls

```javascript
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const controls = new PointerLockControls(camera, renderer.domElement);

renderer.domElement.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock();
});

controls.addEventListener('lock', () => {
    // Hide instruction overlay
});

controls.addEventListener('unlock', () => {
    // Show instruction overlay, pause if needed
});
```

### WASD movement

Movement is implemented manually since PointerLockControls only handles look
rotation, not translation. Each frame, read the movement state and apply velocity
in camera-local space.

```javascript
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const WALK_SPEED = 3.0;   // m/s
const CROUCH_SPEED = 1.5; // m/s

document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'ShiftLeft':
            isCrouching = true;
            camera.position.y = CROUCH_HEIGHT;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
        case 'ShiftLeft':
            isCrouching = false;
            camera.position.y = STAND_HEIGHT;
            break;
    }
});

// In the render loop:
function updateMovement(delta) {
    const speed = isCrouching ? CROUCH_SPEED : WALK_SPEED;
    direction.set(0, 0, 0);

    if (moveState.forward) direction.z -= 1;
    if (moveState.backward) direction.z += 1;
    if (moveState.left) direction.x -= 1;
    if (moveState.right) direction.x += 1;

    direction.normalize();
    direction.applyQuaternion(camera.quaternion);
    direction.y = 0;  // lock to horizontal plane
    direction.normalize();

    velocity.copy(direction).multiplyScalar(speed * delta);
    camera.position.add(velocity);

    // Clamp to terrain bounds
    clampToPlayArea(camera.position);

    // Snap Y to terrain height + eye offset
    camera.position.y = sampleTerrainHeight(camera.position.x, camera.position.z)
        + (isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT);
}
```

### Height constants

```javascript
const STAND_HEIGHT = 1.65;   // average eye height standing
const CROUCH_HEIGHT = 0.85;  // 0.8m lower than standing
```

Crouching is essential for the approach and examination phases. When the student
crouches near a cover object, the camera drops to 0.85m, putting the forest floor
and the object at a natural close-inspection angle.

### Interaction raycasting (desktop)

```javascript
const interactRaycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

function updateDesktopRaycast() {
    interactRaycaster.setFromCamera(screenCenter, camera);
    const hits = interactRaycaster.intersectObjects(
        coverObjectGroup.children, true
    );

    if (hits.length > 0 && hits[0].distance < 3.0) {
        highlightObject(hits[0].object);
    } else {
        clearHighlight();
    }
}
```

The raycast fires from screen center (crosshair position) into the scene. Max
interaction distance is 3m -- the student must physically approach a cover object
before the highlight activates.

---

## 5. Object Interaction System

### Unified raycaster interface

Both VR and desktop feed into a single interaction pipeline. The difference is
only where the ray originates.

```javascript
class InteractionManager {
    constructor(scene, camera) {
        this.raycaster = new THREE.Raycaster();
        this.hoveredObject = null;
        this.mode = 'desktop';  // or 'vr'
    }

    update(camera, controllers) {
        if (this.mode === 'vr' && controllers[0]) {
            this._rayFromController(controllers[0]);
        } else {
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        }

        const hits = this.raycaster.intersectObjects(
            this.interactables, true
        );

        const target = hits.length > 0 && hits[0].distance < 3.0
            ? this._resolveParent(hits[0].object)
            : null;

        if (target !== this.hoveredObject) {
            if (this.hoveredObject) this._unhighlight(this.hoveredObject);
            if (target) this._highlight(target);
            this.hoveredObject = target;
        }
    }
}
```

### Cover object highlight

On hover, apply an emissive outline by pushing the object's material emissive
color toward white. This avoids a second render pass for outlines.

```javascript
_highlight(obj) {
    obj.userData.originalEmissive = obj.material.emissive.clone();
    obj.material.emissive.setHex(0x333322);
    // Also show a name label sprite above the object
    obj.userData.label.visible = true;
}

_unhighlight(obj) {
    obj.material.emissive.copy(obj.userData.originalEmissive);
    obj.userData.label.visible = false;
}
```

### Flip animation

When the player activates a cover object (click on desktop, trigger in VR), the
object plays a flip animation: rotate 90 degrees around one edge and translate
upward, as if being lifted and turned over.

```javascript
function animateFlip(coverMesh, duration, onComplete) {
    const pivotEdge = new THREE.Vector3(
        coverMesh.position.x - coverMesh.userData.halfWidth,
        coverMesh.position.y,
        coverMesh.position.z
    );

    const startQuat = coverMesh.quaternion.clone();
    const endQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), Math.PI / 2
    );
    endQuat.premultiply(startQuat);

    const startPos = coverMesh.position.clone();
    const peakY = startPos.y + 0.3;  // lift 30cm during flip

    const startTime = performance.now();

    function step() {
        const elapsed = performance.now() - startTime;
        let t = Math.min(elapsed / duration, 1.0);
        // Ease-out cubic
        t = 1 - Math.pow(1 - t, 3);

        coverMesh.quaternion.slerpQuaternions(startQuat, endQuat, t);

        // Parabolic Y arc
        const yArc = 4 * peakY * t * (1 - t);
        coverMesh.position.y = startPos.y + yArc;

        if (t < 1.0) {
            requestAnimationFrame(step);
        } else {
            coverMesh.position.y = startPos.y;
            onComplete();
        }
    }
    step();
}
```

Duration: 600ms. The ease-out cubic gives a natural "heave then settle" feel. The
parabolic Y arc lifts the object at the midpoint and sets it down. On completion,
fire the encounter generation through EventEngine and reveal any animal mesh
underneath.

### Animal reveal

After the flip animation completes:

1. Query `EventEngine.generateEncounter(coverObject.userData)` with the cover
   object's type and qualityScore
2. If `result.type === 'salamander'`, unhide the pre-placed salamander mesh at
   the cover object's ground position
3. Apply species-specific material from `result.speciesKeys[0]` to the mesh
4. Play the species behavior animation (freeze, slow crawl, rapid escape) per
   the config `behavior.response` field
5. The mesh starts invisible (`visible = false`) and fades in over 200ms by
   animating material opacity

For multi-animal encounters (2--4 salamanders), offset each mesh by 3--5cm
laterally so they're visible simultaneously.

### VR grab interaction

Grip button (squeeze event) picks up a cover object. The object parents to the
controller group and follows with quaternion slerp lag.

```javascript
function onSqueezeStart(event) {
    const controller = event.target;
    getControllerRay(controller);
    const hits = raycaster.intersectObjects(coverObjectGroup.children, true);

    if (hits.length > 0 && hits[0].distance < 1.0) {
        const obj = resolveParent(hits[0].object);
        obj.userData.isGrabbed = true;
        obj.userData.grabOffset = obj.position.clone().sub(
            new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
        );
        controller.userData.grabbed = obj;
    }
}

function onSqueezeEnd(event) {
    const controller = event.target;
    if (controller.userData.grabbed) {
        const obj = controller.userData.grabbed;
        obj.userData.isGrabbed = false;
        controller.userData.grabbed = null;
        // Trigger encounter generation from the flip/lift action
        triggerEncounter(obj);
    }
}

// In animation loop:
function updateGrab(controller) {
    const obj = controller.userData.grabbed;
    if (!obj) return;

    const targetPos = new THREE.Vector3()
        .setFromMatrixPosition(controller.matrixWorld)
        .add(obj.userData.grabOffset);

    obj.position.lerp(targetPos, 0.25);  // slight lag for natural feel
    obj.quaternion.slerp(controller.quaternion, 0.15);
}
```

---

## 6. Terrain and Environment

### Ground mesh

```javascript
const terrainGeom = new THREE.PlaneGeometry(60, 60, 256, 256);
terrainGeom.rotateX(-Math.PI / 2);

// Displace vertices with fractal Brownian motion
const posAttr = terrainGeom.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const h = fbm(x * 0.05, z * 0.05, 4) * 2.0;  // 4 octaves, 2m max height
    posAttr.setY(i, h);
}
terrainGeom.computeVertexNormals();
```

60x60m plane at 256x256 subdivision gives ~0.23m per vertex -- smooth enough for
natural terrain undulation without burning geometry budget. The FBM displacement
produces gentle Appalachian forest floor topography: slight rises, shallow gullies,
flat benches where cover objects sit.

### Terrain material

PBR material with blended textures for soil, leaf litter, and moss:

```javascript
const terrainMat = new THREE.MeshStandardMaterial({
    map: groundAlbedo,          // tiled soil + leaf litter diffuse
    normalMap: groundNormal,     // surface detail without geometry
    roughnessMap: groundRough,   // wet areas shinier
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: 0.3
});
```

Use a custom shader chunk or `onBeforeCompile` to blend between soil and moss
textures based on vertex height and slope. Low areas and north-facing slopes get
more moss. Higher exposed areas get drier leaf litter. This avoids a second
material and keeps draw calls at 1 for the terrain.

### Vegetation instancing

Trees, ferns, and ground debris use `InstancedMesh` to batch hundreds of objects
into single draw calls.

```javascript
// Example: ferns
const fernGeom = fernModel.geometry;
const fernMat = fernModel.material;
const fernCount = 200;
const fernMesh = new THREE.InstancedMesh(fernGeom, fernMat, fernCount);

const dummy = new THREE.Object3D();
for (let i = 0; i < fernCount; i++) {
    const x = (Math.random() - 0.5) * 50;
    const z = (Math.random() - 0.5) * 50;
    const y = sampleTerrainHeight(x, z);

    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(0.8 + Math.random() * 0.4);
    dummy.updateMatrix();
    fernMesh.setMatrixAt(i, dummy.matrix);
}
fernMesh.instanceMatrix.needsUpdate = true;
```

### LOD strategy

Three LOD levels per vegetation type. Distance thresholds in meters:

| Object | LOD0 (high) | LOD1 (med) | LOD2 (low / billboard) |
|--------|-------------|------------|------------------------|
| Tree trunk + canopy | 0--15m, full mesh ~2K tris | 15--40m, simplified ~500 tris | 40--100m, cross-billboard 2 tris |
| Fern | 0--8m, full fronds ~400 tris | 8--20m, flat card ~4 tris | 20m+, hidden |
| Ground debris | 0--5m, mesh ~100 tris | 5--12m, flat sprite | 12m+, hidden |
| Cover object | 0--10m, full detail | 10--25m, simplified | 25m+, hidden |

Use `THREE.LOD` instances for trees. For ferns and debris, swap InstancedMesh
buffers at distance thresholds or use camera distance checks in the update loop
to toggle `visible` on individual instances.

### Weather-driven atmosphere

The existing `WeatherSystem` provides `getCurrentConditions()` with temperature,
humidity, cloud cover, wind speed, and rain state. The 3D layer reads these values
each frame and adjusts:

| Weather property | 3D effect |
|------------------|-----------|
| `isRaining` | Enable rain particle emitter, darken sky hemisphere color, increase fog density |
| `cloudCover` | Modulate sun DirectionalLight intensity (100% cloud = intensity 0.8, clear = 3.0) |
| `humidity > 85` | Increase terrain roughnessMap wetness, add specular sheen to cover objects |
| `weather === 'fogMist'` | FogExp2 density -> 0.025, desaturate hemisphere light |
| `windSpeed` | Animate tree sway amplitude (vertex shader uniform), particle drift velocity |
| `weather === 'lightRain'` / `'heavyRain'` | Rain particle count: 200 / 500, ripple decals on wet surfaces |

Seasonal palette from `COLORS[season].litter` maps to terrain texture tinting:
- Spring: greener ground cover, wildflower instances
- Summer: dense green canopy, deeper shadows
- Fall: orange/gold leaf litter, falling leaf particles
- Winter: bare canopy mesh, gray-brown ground, sparse understory

---

## 7. Salamander Rendering

Each of the 8 species in `config.SPECIES` needs a distinct 3D model. Two
approaches, not mutually exclusive:

### Option A: GLTF models (preferred for photorealism)

Commission or sculpt 8 salamander meshes in Blender. Export as .glb with DRACO
compression. Each model: ~1500 tris, 1 material, 512x512 albedo + normal + roughness
texture atlas. Total: ~12K tris, ~6MB on disk compressed.

Load with GLTFLoader + DRACOLoader. On encounter, clone the appropriate species
mesh, apply per-individual color variation by tinting the albedo via
`material.color.offsetHSL(hueOffset, satOffset, 0)` using the species' `bodyRange`
and `satRange` from config.

Morphometric scaling: `mesh.scale.set(svl / meanSVL, svl / meanSVL, tl / meanTL)`
where SVL and TL are sampled from the species' gaussian distributions.

### Option B: Procedural geometry (fallback)

Build salamanders from parametric curves (the approach used in the current 2D
`Salamander.js`). Extrude a body profile along a spine spline. This is more
work in 3D but eliminates the external asset dependency.

The body is a `TubeGeometry` along a `CatmullRomCurve3` spine with variable radius:
- Head: radius peaks at `headRatio * svl`
- Trunk: gradual taper
- Tail: quadratic taper to tip, `tailRatio * tl` long

Limbs are simple cylinder + sphere joints, posed in a resting splay. Toes
rendered as 3 short cylinders per foot.

### Skin materials per species

| Species | Material properties |
|---------|--------------------|
| NOVI (eft) | MeshStandardMaterial, roughness 0.95 (granular), no metalness, bump map for sandpaper texture, bordered spot decals |
| PSRU (red sal) | roughness 0.3 (smooth glossy), slight clearcoat for wet look, scattered irregular spot decals |
| PLCI (red-backed) | roughness 0.4, dorsal stripe via UV-mapped texture or vertex color |
| PLGL (slimy) | roughness 0.2 (very glossy), high clearcoat, white fleck particles |
| DEFU (dusky) | roughness 0.5, keeled tail geometry, pale jaw line decal |
| EUBI (two-lined) | roughness 0.4, dark lateral line decals on yellow base |
| DEMO (seal) | roughness 0.45, reticulated pattern via normal map |
| GYPO (spring) | roughness 0.35, salmon-pink base, faint mottling |

### Behavior animation

Each species has a `behavior.response` in config. Map these to animation clips:

- `stand-still` (NOVI): no movement. Mesh stays at reveal position.
- `coiled-posture` (PSRU): keyframe animation curling the spine spline over
  500ms, raising the tail.
- `freeze-crawl` (PLCI, PLGL): hold position for `freezeDuration` seconds,
  then animate spine in a sinusoidal crawl at `speed` rate along a random
  direction vector.
- `rapid-escape` (DEFU, EUBI): brief freeze, then fast sinusoidal locomotion
  toward nearest cover or off-screen.
- `moderate-escape` (DEMO): same as freeze-crawl but faster.
- `slow-retreat` (GYPO): slow crawl.

Locomotion animation: oscillate spine control points in a traveling sine wave.
Amplitude and frequency scale with the species' speed class. Limbs step in
alternating diagonal pairs (trot gait, accurate for salamander locomotion).

---

## 8. Performance Budget

### Triangle budget

| Category | Count | Tris per | Total tris |
|----------|-------|----------|------------|
| Terrain | 1 | 131K (256x256 grid) | 131,000 |
| Trees LOD0 (within 15m, ~8 trees) | 8 | 2,000 | 16,000 |
| Trees LOD1 (15--40m, ~20 trees) | 20 | 500 | 10,000 |
| Trees LOD2 (40m+, ~40 trees) | 40 | 2 | 80 |
| Ferns LOD0 (~30) | 30 | 400 | 12,000 |
| Ferns LOD1 (~80) | 80 | 4 | 320 |
| Cover objects (~40) | 40 | 800 | 32,000 |
| Salamander (1--4 visible) | 4 | 1,500 | 6,000 |
| Ground debris | 1 | ~5,000 | 5,000 |
| Particles (100 max) | 100 | 2 | 200 |
| UI elements | -- | -- | 1,000 |
| **Total** | | | **~213,600** |

Well under the 500K ceiling. Leaves headroom for additional detail meshes
(stream rocks, fallen branches, stumps) without exceeding budget.

### Draw call budget

| Category | Draw calls |
|----------|-----------|
| Terrain | 1 |
| Tree InstancedMesh (3 LOD levels) | 3 |
| Fern InstancedMesh (2 LOD levels) | 2 |
| Cover objects (4 types, InstancedMesh each) | 4 |
| Rock formations (InstancedMesh) | 1 |
| Ground debris (InstancedMesh) | 1 |
| Salamander meshes (up to 4) | 4 |
| Skybox / environment | 1 |
| Shadow pass | ~10 |
| Particles | 1 |
| **Total** | **~28** |

Well under the 100-call target. Shadow pass adds roughly 10 calls for shadow-
casting objects.

### GPU texture memory

| Texture | Resolution | Format | Size |
|---------|------------|--------|------|
| Terrain albedo | 2048x2048 | RGBA8 | 16MB |
| Terrain normal | 2048x2048 | RGB8 | 12MB |
| Terrain roughness | 1024x1024 | R8 | 1MB |
| Tree atlas (bark + leaves) | 2048x2048 | RGBA8 | 16MB |
| Fern atlas | 1024x1024 | RGBA8 | 4MB |
| Cover object atlas | 1024x1024 | RGBA8 | 4MB |
| Salamander atlas (all species) | 2048x1024 | RGBA8 | 8MB |
| Shadow map | 2048x2048 | Depth16 | 8MB |
| HDR environment | 1024x512 | RGBA16F | 4MB |
| Misc (particles, UI) | -- | -- | 2MB |
| **Total** | | | **~75MB** |

Within the 128MB budget with margin for runtime framebuffers.

### Frame time targets

| Mode | Target FPS | Frame budget | Scene render budget |
|------|-----------|-------------|---------------------|
| Desktop | 60 | 16.67ms | ~11ms (leave 5ms for OS + compositing) |
| Desktop high | 90 | 11.11ms | ~8ms |
| VR (Quest 2/3) | 72 | 13.89ms | ~6ms per eye (stereo) |
| VR (PCVR) | 90 | 11.11ms | ~5ms per eye |

---

## 9. Integration Contract

The 3D rendering layer consumes the existing simulation systems without modifying
them. The contract is a one-way data flow: simulation logic produces state, 3D
layer reads it and renders.

### EventEngine

```
EventEngine.generateEncounter(coverObject) -> {
    type: 'empty' | 'invertebrate' | 'salamander' | 'snake' | 'otherHerp',
    speciesKeys: string[],
    description: string,
    event: object | null
}
```

**3D layer usage:** When a cover object flip animation completes, call
`generateEncounter()` with the cover object's simulation data (type, qualityScore).
The returned `speciesKeys` array indexes into `config.SPECIES` to determine which
salamander mesh to instantiate, what color/pattern material to apply, and which
behavior animation to play.

The `coverObject` parameter expected by EventEngine must have:
- `.type` -- string, one of `'rock' | 'log' | 'bark' | 'board'`
- `.qualityScore` -- float 0--1, Beta(2,5) distributed, spatially correlated

The 3D CoverObject3D class stores these in `mesh.userData` so the existing
EventEngine consumes them directly.

### WeatherSystem

```
WeatherSystem.getCurrentConditions() -> {
    weather, weatherLabel, temperature, humidity,
    windSpeed, cloudCover, isRaining, rainedRecently, daysSinceRain
}
WeatherSystem.getEncounterModifier() -> float
WeatherSystem.update(elapsedMinutes) -> void
WeatherSystem.getDescription() -> string
```

**3D layer usage:** Read `getCurrentConditions()` at scene init and every 60
seconds (or on each cover object flip). Adjust lighting, fog, particle systems,
and material wetness accordingly. The 3D layer never writes to WeatherSystem --
it calls `update()` through the existing simulation tick mechanism.

### FieldNotebook

```
FieldNotebook.mount(container) -> void
FieldNotebook.openEntry(animal, coverObj) -> void
FieldNotebook.onSave(callback) -> void
```

**3D layer usage:** FieldNotebook is an HTML overlay, not a 3D element. When the
student finishes species identification, the 3D layer calls `openEntry()` with the
animal data. The notebook DOM slides in over the WebGL canvas. When the student
saves, the `onSave` callback fires, and the 3D layer resumes normal rendering
(un-pause the render loop, transition camera back to walking position).

The canvas must remain visible behind the notebook panel. Set the notebook
container to `position: absolute; right: 0; width: 400px; z-index: 10` so it
overlays the right side of the viewport without hiding the scene.

### AnalysisPanel

```
AnalysisPanel.show(encounterHistory, speciesCounts, notebook) -> void
```

**3D layer usage:** When all cover objects have been flipped (survey complete),
call `AnalysisPanel.show()`. The panel is pure DOM -- it replaces the WebGL canvas
entirely. Stop the render loop. The 3D layer doesn't render during analysis.

### IdentificationChallenge

```
IdentificationChallenge.show(animal, species, difficulty) -> void
IdentificationChallenge.onSubmit(callback) -> void
```

**3D layer usage:** After animal reveal, pause player movement and show the ID
challenge as an HTML overlay on the right side. The 3D scene remains visible on
the left with the salamander in view. The student compares the 3D animal model
to the diagnostic features listed in the panel. On submit, the callback
receives the ID result and passes it to the FieldNotebook.

### Data flow sequence

```
Player flips cover object
  |
  v
3D: play flip animation (600ms)
  |
  v
3D: call EventEngine.generateEncounter(coverObj.userData)
  |
  v
EventEngine: roll contents, apply weather/seasonal modifiers, return result
  |
  v
3D: if salamander, instantiate mesh, apply species material, play behavior anim
  |
  v
3D: camera moves to examination position (crouch + close-up)
  |
  v
3D: call IdentificationChallenge.show() -- HTML overlay
  |
  v
Student: selects species, features --> onSubmit fires
  |
  v
3D: call FieldNotebook.openEntry() -- HTML overlay
  |
  v
Student: records measurements --> onSave fires
  |
  v
3D: transition camera back, despawn animal, mark cover object as checked
  |
  v
3D: read WeatherSystem.getCurrentConditions(), update atmosphere
```

---

## 10. File Structure

```
sim/experiments/batesian-mimicry/
├── config.js                    # (existing) species data, probabilities
├── EventEngine.js               # (existing) encounter generation
├── WeatherSystem.js             # (existing) weather simulation
├── FieldNotebook.js             # (existing) data recording UI
├── AnalysisPanel.js             # (existing) post-survey analysis
├── IdentificationChallenge.js   # (existing) species ID panel
├── FieldSetup.js                # (existing) config screen
│
├── 3d/
│   ├── main.js                  # Entry point. Creates SceneManager, starts loop
│   ├── SceneManager.js          # Scene graph setup, renderer config, resize handling
│   ├── PlayerController.js      # Unified input: PointerLock (desktop) + XR (VR)
│   ├── DesktopControls.js       # WASD movement, mouse look, crouch, click-to-interact
│   ├── VRControls.js            # XR controller setup, hand tracking, teleport, snap-turn
│   ├── InteractionManager.js    # Raycasting, hover highlight, flip trigger, grab
│   ├── TerrainBuilder.js        # Ground plane, heightmap displacement, material blending
│   ├── VegetationSystem.js      # InstancedMesh trees, ferns, debris with LOD
│   ├── CoverObject3D.js         # 3D cover objects, flip animation, encounter bridge
│   ├── SalamanderRenderer.js    # Species mesh loading/generation, materials, behavior anims
│   ├── AtmosphereSystem.js      # Fog, particles, god rays, rain, weather-driven updates
│   ├── LightingSystem.js        # Sun, hemisphere, shadow config, weather modulation
│   ├── AssetLoader.js           # GLTF/DRACO/RGBE loading pipeline with progress tracking
│   ├── LODManager.js            # Distance-based LOD switching for all instanced groups
│   └── constants.js             # 3D-specific constants (speeds, distances, LOD thresholds)
│
├── 3d/assets/
│   ├── models/
│   │   ├── salamanders/         # 8 species .glb files
│   │   ├── cover-objects/       # rock.glb, log.glb, board.glb, bark.glb
│   │   ├── vegetation/          # tree.glb, fern.glb, etc.
│   │   └── invertebrates/       # centipede.glb, beetle.glb (simple meshes)
│   ├── textures/
│   │   ├── terrain/             # albedo, normal, roughness maps
│   │   ├── bark/                # tree bark texture atlas
│   │   ├── leaves/              # leaf litter, canopy alpha maps
│   │   └── env/                 # HDR environment map (.hdr)
│   └── audio/                   # ambient loops, interaction sounds (optional)
│
├── BatesianMimicrySim.js        # (modified) orchestrator -- delegates to 3d/main.js
├── ForestEnvironment.js         # (existing, kept for data) transect generation logic
├── CoverObject.js               # (existing, kept for data) cover object state
├── Salamander.js                # (existing, kept for data) 2D rendering as fallback
│
├── research/                    # design documents
│   ├── threejs-architecture.md  # (this document)
│   └── ...
│
└── index.html                   # (modified) add importmap, mount point
```

### Key architectural boundaries

- **3d/ is a rendering layer only.** It never modifies simulation state directly.
  It reads from EventEngine, WeatherSystem, and config. It writes to the DOM
  overlay components (FieldNotebook, IdentificationChallenge, AnalysisPanel) via
  their existing public APIs.

- **ForestEnvironment.js remains the source of truth** for cover object layout,
  quality scores, and weather. `TerrainBuilder` reads these positions and builds
  3D geometry at the corresponding world-space coordinates.

- **Fallback path:** If WebGL context creation fails (old hardware, disabled GPU),
  `BatesianMimicrySim` falls back to the existing Canvas 2D rendering path.
  The 2D code stays in place and is not deleted.

- **No npm, no bundler.** All source files are ES modules loaded via `<script
  type="module">`. The importmap resolves `three` and `three/addons/` to the CDN.
  Local project files use relative paths (`./TerrainBuilder.js`).

### BatesianMimicrySim.js modifications

The existing orchestrator gains a feature flag:

```javascript
this._use3D = this._detect3DSupport();

if (this._use3D) {
    // Import and initialize SceneManager from 3d/main.js
    const { initScene } = await import('./3d/main.js');
    this._sceneManager = initScene(this._container, this._config);
    this._sceneManager.onFlip((coverObj) => {
        const encounter = this._eventEngine.generateEncounter(coverObj);
        this._sceneManager.handleEncounterResult(encounter);
    });
} else {
    // Existing Canvas 2D path
    this.canvas = document.createElement('canvas');
    // ...
}
```

---

## 11. Loading and Initialization Sequence

```
1. HTML loads, importmap resolves Three.js from CDN
2. main.js creates SceneManager
3. SceneManager initializes:
   a. WebGLRenderer (with WebXR check)
   b. Scene, Camera, Lights
   c. AssetLoader begins parallel fetch of:
      - Terrain textures (3 maps)
      - HDR environment map
      - Tree model (1 GLTF)
      - Fern model (1 GLTF)
      - Cover object models (4 GLTFs)
      - Salamander models (8 GLTFs)
      Total: ~20--30MB first load, cached by browser after
   d. Progress bar shown during loading
4. On load complete:
   a. TerrainBuilder generates displaced ground mesh
   b. VegetationSystem scatters instanced meshes
   c. ForestEnvironment.generateTransect() places cover objects
   d. CoverObject3D reads positions, creates 3D meshes at those coordinates
   e. LightingSystem configures sun from WeatherSystem conditions
   f. AtmosphereSystem initializes fog, particles from weather state
5. PlayerController activates:
   - Desktop: PointerLockControls, bind WASD
   - VR: check navigator.xr, show VRButton if supported
6. Render loop starts via renderer.setAnimationLoop()
7. Survey begins -- student walks and flips objects
```

---

## 12. Coordinate System Conventions

- Three.js uses Y-up, right-handed coordinates
- 1 unit = 1 meter
- World origin (0, 0, 0) is the center of the transect
- Terrain extends -30 to +30 on X and Z axes
- Player spawns at (0, 1.65, 25) -- south end of transect, facing north (-Z)
- Cover objects are placed on the terrain surface (Y = terrain height at their XZ)
- The existing ForestEnvironment places objects in pixel coordinates on a 2D
  canvas. The 3D layer must map these to world-space meters:

```javascript
function canvasToWorld(px, py, canvasW, canvasH) {
    const worldX = ((px / canvasW) - 0.5) * 60;  // -30 to +30
    const worldZ = ((py / canvasH) - 0.5) * 60;  // -30 to +30
    const worldY = sampleTerrainHeight(worldX, worldZ);
    return new THREE.Vector3(worldX, worldY, worldZ);
}
```

---

## 13. Shader Notes

### Terrain blending (vertex shader injection)

Use `material.onBeforeCompile` to inject a height/slope-based blend between soil
and moss textures:

```glsl
// In fragment shader, after #include <map_fragment>
float slope = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
float heightBlend = smoothstep(0.3, 0.8, vWorldPosition.y / 2.0);
float mossWeight = (1.0 - heightBlend) * (1.0 - slope) * uMoisture;
diffuseColor.rgb = mix(diffuseColor.rgb, mossSample.rgb, mossWeight);
```

### Tree sway (vertex shader injection)

Wind animation on tree canopy vertices. Inject into the vertex shader:

```glsl
float sway = sin(time * uWindFreq + position.x * 0.5) * uWindAmplitude;
sway *= smoothstep(0.0, 3.0, position.y);  // only upper vertices move
transformed.x += sway;
transformed.z += sway * 0.3;
```

`uWindAmplitude` maps from `WeatherSystem.windSpeed`: calm = 0.02, moderate =
0.08, strong = 0.15.

### Salamander wet sheen

For recently-revealed salamanders on damp soil, increase clearcoat dynamically:

```javascript
salamanderMat.clearcoat = humidity > 80 ? 0.6 : 0.2;
salamanderMat.clearcoatRoughness = 0.15;
```

---

## 14. Testing and Debug Tools

### Debug overlays (development only)

- **Stats.js:** Import from `three/addons/libs/stats.module.js`. Shows FPS, MS,
  MB in the corner.
- **Shadow camera helper:** `new THREE.CameraHelper(sun.shadow.camera)` to
  visualize the shadow frustum.
- **LOD wireframe:** Toggle wireframe on LOD1/LOD2 meshes to verify distance
  switching.
- **Raycaster debug:** Draw the raycast line as a visible `THREE.ArrowHelper`.
- **Terrain grid:** Show the 256x256 wireframe to verify displacement.

### Performance profiling checklist

1. Open Chrome DevTools -> Performance tab -> Record 5 seconds of gameplay
2. Check `requestAnimationFrame` callback duration -- must be < 11ms at 90fps
3. Check GPU duration in `chrome://gpu` -- look for shader compile stalls
4. Monitor `renderer.info.render.calls` -- should stay under 30
5. Monitor `renderer.info.memory.textures` -- should stay under 20
6. Test on integrated GPU (Intel UHD 630 or equivalent) at 1080p
7. Test in Quest 2 browser for VR path

### Fallback detection

```javascript
function detect3DSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2')
            || canvas.getContext('webgl');
        if (!gl) return false;

        // Check for required extensions
        const ext = gl.getExtension('OES_texture_float');
        const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        return maxTexSize >= 2048;
    } catch (e) {
        return false;
    }
}
```

If `detect3DSupport()` returns false, the simulation falls back to the existing
Canvas 2D rendering path with the ViewManager three-view system. No student is
locked out of the exercise because of hardware.
