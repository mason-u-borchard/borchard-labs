/**
 * Batesian Mimicry Simulation -- 3D Cover Object
 *
 * Interactive cover objects (rocks, logs, boards, bark) that students
 * flip to discover salamanders underneath. Each object type has distinct
 * procedural geometry, a soil patch revealed on flip, and a pivot-based
 * flip animation that swings the object up from its ground-contact edge.
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';


// -------------------------------------------------------------------
// Size variant ranges per type (meters)
// -------------------------------------------------------------------

var SIZE_RANGES = {
    rock: { radius: [0.12, 0.22] },
    log:  { radiusTop: [0.06, 0.10], radiusBottom: [0.07, 0.12], length: [0.3, 0.6] },
    board: { width: 0.4, height: 0.02, depth: 0.3 },
    bark: { width: 0.2, height: 0.15 }
};


// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}


// -------------------------------------------------------------------
// CoverObject3D
// -------------------------------------------------------------------

export class CoverObject3D {

    constructor(id, type, worldX, worldZ, qualityScore, terrainHeightFn) {
        this.id = id;
        this.type = type;
        this.worldX = worldX;
        this.worldZ = worldZ;
        this.qualityScore = qualityScore;
        this.terrainHeightFn = terrainHeightFn;

        this.state = 'covered';    // 'covered' | 'flipping' | 'uncovered'
        this.checked = false;
        this.animal = null;
        this.animalFadeProgress = 0;

        this.flipProgress = 0;
        this.mesh = null;
        this.soilPatch = null;
        this.pivotGroup = null;

        // main group -- added to scene's CoverObjectGroup
        this.group = new THREE.Group();
        this.group.name = 'cover_' + id;

        // build everything
        this.createMesh();
        this.createSoilPatch();

        // position at terrain height
        var terrainY = this.terrainHeightFn(this.worldX, this.worldZ);
        this.group.position.set(this.worldX, terrainY, this.worldZ);
    }


    // ---------------------------------------------------------------
    // Mesh creation -- type-specific procedural geometry
    // ---------------------------------------------------------------

    createMesh() {
        switch (this.type) {
            case 'rock':  this._createRock();  break;
            case 'log':   this._createLog();   break;
            case 'board': this._createBoard(); break;
            case 'bark':  this._createBark();  break;
            default:      this._createRock();  break;
        }
    }

    _createRock() {
        var range = SIZE_RANGES.rock;
        var radius = randRange(range.radius[0], range.radius[1]);

        var geo = new THREE.DodecahedronGeometry(radius, 1);
        var pos = geo.attributes.position;

        // vertex displacement for irregular rock shape
        for (var i = 0; i < pos.count; i++) {
            var vx = pos.getX(i);
            var vy = pos.getY(i);
            var vz = pos.getZ(i);
            var offset = Math.sin(vx * 5) * Math.cos(vz * 3) * 0.03;
            pos.setX(i, vx + offset);
            pos.setY(i, vy + offset * 0.5);
            pos.setZ(i, vz + offset * 0.7);
        }

        // flatten the bottom slightly so it sits on ground
        for (var i = 0; i < pos.count; i++) {
            var y = pos.getY(i);
            if (y < -radius * 0.3) {
                pos.setY(i, -radius * 0.3 + (y + radius * 0.3) * 0.3);
            }
        }

        geo.computeVertexNormals();

        // add moss tinting via vertex colors on upward-facing vertices
        var colors = new Float32Array(pos.count * 3);
        var normal = geo.attributes.normal;
        var baseR = 0x88 / 255, baseG = 0x88 / 255, baseB = 0x88 / 255;
        var mossR = 0x52 / 255, mossG = 0xb7 / 255, mossB = 0x88 / 255;

        for (var i = 0; i < pos.count; i++) {
            var ny = normal.getY(i);
            var mossFactor = Math.max(0, ny) * 0.35;
            colors[i * 3]     = lerp(baseR, mossR, mossFactor);
            colors[i * 3 + 1] = lerp(baseG, mossG, mossFactor);
            colors[i * 3 + 2] = lerp(baseB, mossB, mossFactor);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        var mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            roughness: 0.75,
            metalness: 0.0
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'rock_mesh_' + this.id;

        // offset mesh so bottom edge is at y=0 within the pivot
        this.mesh.position.y = radius * 0.3;

        this._extents = { radius: radius, height: radius * 0.6 };
        this._setupPivot();
    }

    _createLog() {
        var range = SIZE_RANGES.log;
        var rTop = randRange(range.radiusTop[0], range.radiusTop[1]);
        var rBot = randRange(range.radiusBottom[0], range.radiusBottom[1]);
        var len = randRange(range.length[0], range.length[1]);

        var geo = new THREE.CylinderGeometry(rTop, rBot, len, 12);

        var mat = new THREE.MeshStandardMaterial({
            color: 0x6b4226,
            roughness: 0.85,
            metalness: 0.0
        });

        this.mesh = new THREE.Mesh(geo, mat);

        // rotate to lie on side (cylinder axis -> X axis)
        this.mesh.rotation.z = Math.PI / 2;

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'log_mesh_' + this.id;

        // position so it rests on the ground
        this.mesh.position.y = rBot;

        // add ring detail on the cut end
        this._addLogRings(rTop, len);

        this._extents = { radius: Math.max(rTop, rBot), height: rBot * 2, length: len };
        this._setupPivot();
    }

    _addLogRings(radius, length) {
        var ringGroup = new THREE.Group();
        var ringMat = new THREE.MeshStandardMaterial({
            color: 0x8B6914,
            roughness: 0.7,
            metalness: 0.0
        });

        // concentric rings on the cut face
        for (var r = 0; r < 4; r++) {
            var ringRadius = radius * (0.3 + r * 0.18);
            var ringGeo = new THREE.RingGeometry(ringRadius - 0.003, ringRadius + 0.003, 16);
            var ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.y = Math.PI / 2;
            ring.position.x = length / 2 + 0.001;
            ringGroup.add(ring);
        }

        this.mesh.add(ringGroup);
    }

    _createBoard() {
        var s = SIZE_RANGES.board;
        var geo = new THREE.BoxGeometry(s.width, s.height, s.depth, 8, 1, 6);
        var pos = geo.attributes.position;

        // warp top vertices slightly for weathered look
        for (var i = 0; i < pos.count; i++) {
            var y = pos.getY(i);
            if (y > 0) {
                var x = pos.getX(i);
                var z = pos.getZ(i);
                var warp = Math.sin(x * 8) * Math.cos(z * 6) * 0.004;
                pos.setY(i, y + warp + (Math.random() - 0.5) * 0.002);
            }
        }
        geo.computeVertexNormals();

        var mat = new THREE.MeshStandardMaterial({
            color: 0xc4a87a,
            roughness: 0.6,
            metalness: 0.0
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'board_mesh_' + this.id;

        // sit on ground -- half height up
        this.mesh.position.y = s.height / 2;

        this._extents = { radius: Math.max(s.width, s.depth) * 0.5, height: s.height };
        this._setupPivot();
    }

    _createBark() {
        var s = SIZE_RANGES.bark;
        var geo = new THREE.PlaneGeometry(s.width, s.height, 6, 4);
        var pos = geo.attributes.position;

        // curve the center vertices outward for a natural bark curl
        for (var i = 0; i < pos.count; i++) {
            var x = pos.getX(i);
            var y = pos.getY(i);
            var distFromCenter = Math.sqrt(x * x + y * y);
            var maxDist = Math.sqrt(s.width * s.width + s.height * s.height) * 0.5;
            var curvature = (1 - distFromCenter / maxDist) * 0.025;
            pos.setZ(i, curvature);
        }
        geo.computeVertexNormals();

        var mat = new THREE.MeshStandardMaterial({
            color: 0x8a6b42,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geo, mat);

        // lay flat on ground
        this.mesh.rotation.x = -Math.PI / 2;

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'bark_mesh_' + this.id;

        this.mesh.position.y = 0.01;

        this._extents = { radius: Math.max(s.width, s.height) * 0.5, height: 0.025 };
        this._setupPivot();
    }


    // ---------------------------------------------------------------
    // Pivot group -- allows rotation from the bottom edge
    // ---------------------------------------------------------------

    _setupPivot() {
        // pivot sits at ground level at one edge of the object
        // the mesh is parented to it so rotating the pivot swings
        // the mesh up from that edge
        this.pivotGroup = new THREE.Group();
        this.pivotGroup.name = 'pivot_' + this.id;

        // offset pivot to the -Z edge of the object
        var offsetZ = (this._extents.radius || 0.1) * 0.8;
        this.pivotGroup.position.set(0, 0, -offsetZ);

        // move mesh so its center is offset from pivot origin
        this.mesh.position.z = (this.mesh.position.z || 0) + offsetZ;

        this.pivotGroup.add(this.mesh);
        this.group.add(this.pivotGroup);
    }


    // ---------------------------------------------------------------
    // Soil patch -- dark disc revealed under flipped object
    // ---------------------------------------------------------------

    createSoilPatch() {
        var patchRadius = (this._extents.radius || 0.15) * 1.2;
        var geo = new THREE.CircleGeometry(patchRadius, 16);
        geo.rotateX(-Math.PI / 2);

        var mat = new THREE.MeshStandardMaterial({
            color: 0x2a1f15,
            roughness: 0.35,
            metalness: 0.0
        });

        this.soilPatch = new THREE.Mesh(geo, mat);
        this.soilPatch.receiveShadow = true;
        this.soilPatch.position.y = 0.002;  // just above terrain to avoid z-fight
        this.soilPatch.visible = false;
        this.soilPatch.name = 'soil_' + this.id;

        this.group.add(this.soilPatch);
    }


    // ---------------------------------------------------------------
    // Highlight -- emissive glow on hover / approach
    // ---------------------------------------------------------------

    createHighlight() {
        // handled inline via setHighlight -- no extra mesh needed
    }

    setHighlight(on) {
        if (!this.mesh || !this.mesh.material) return;
        if (on) {
            this.mesh.material.emissive = new THREE.Color(0xb8860b);
            this.mesh.material.emissiveIntensity = 0.3;
        } else {
            this.mesh.material.emissive = new THREE.Color(0x000000);
            this.mesh.material.emissiveIntensity = 0;
        }
    }


    // ---------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------

    getGroup() {
        return this.group;
    }

    isChecked() {
        return this.checked;
    }


    // ---------------------------------------------------------------
    // Flip
    // ---------------------------------------------------------------

    flip() {
        if (this.state === 'flipping' || this.state === 'uncovered') {
            return false;
        }
        this.state = 'flipping';
        this.flipProgress = 0;
        return true;
    }


    // ---------------------------------------------------------------
    // Animation update -- call each frame with delta time in seconds
    // ---------------------------------------------------------------

    updateAnimation(dt) {
        // flip animation
        if (this.state === 'flipping') {
            this.flipProgress += dt / 0.6;  // 600ms total

            var t = Math.min(this.flipProgress, 1);
            var eased = easeOutCubic(t);

            // rotate pivot around X axis -- swings the object up from its edge
            this.pivotGroup.rotation.x = eased * Math.PI / 2;

            // slight lateral translation so it "lands" to the side
            this.pivotGroup.position.z = this.pivotGroup.position.z;
            this.mesh.position.x = eased * (this._extents.radius || 0.1) * 0.6;

            if (this.flipProgress >= 1) {
                this.flipProgress = 1;
                this.state = 'uncovered';
                this.checked = true;
                this.soilPatch.visible = true;

                // start animal fade-in if one is set
                if (this.animal) {
                    this.animal.visible = true;
                    this.animal.material.opacity = 0;
                    this.animal.material.transparent = true;
                    this.animalFadeProgress = 0;
                }
            }
        }

        // animal fade-in after flip completes
        if (this.state === 'uncovered' && this.animal && this.animalFadeProgress < 1) {
            this.animalFadeProgress += dt / 0.3;  // 300ms fade
            if (this.animalFadeProgress > 1) this.animalFadeProgress = 1;
            this.animal.material.opacity = this.animalFadeProgress;
            if (this.animalFadeProgress >= 1) {
                this.animal.material.transparent = false;
            }
        }
    }


    // ---------------------------------------------------------------
    // Animal attachment
    // ---------------------------------------------------------------

    setAnimal(salamanderMesh) {
        this.animal = salamanderMesh;
        this.animal.visible = false;

        // position on the soil patch
        this.animal.position.set(0, 0.01, 0);
        this.group.add(this.animal);
    }


    // ---------------------------------------------------------------
    // Hit testing
    // ---------------------------------------------------------------

    hitTest(raycaster) {
        if (this.state === 'uncovered') return false;
        var intersects = raycaster.intersectObject(this.mesh, true);
        return intersects.length > 0;
    }


    // ---------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------

    dispose() {
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (this.mesh.material.map) this.mesh.material.map.dispose();
                this.mesh.material.dispose();
            }
            // dispose child meshes (log rings, etc.)
            this.mesh.traverse(function (child) {
                if (child !== this.mesh && child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            }.bind(this));
        }
        if (this.soilPatch) {
            if (this.soilPatch.geometry) this.soilPatch.geometry.dispose();
            if (this.soilPatch.material) this.soilPatch.material.dispose();
        }
        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
    }
}
