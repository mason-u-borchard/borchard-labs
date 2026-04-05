/**
 * Batesian Mimicry Simulation -- 3D Scene Builder
 *
 * Constructs the photorealistic Appalachian cove hardwood forest environment.
 * Terrain, trees, canopy, ferns, ground debris, and atmospheric effects.
 * All geometry uses solid-color PBR materials for the POC -- real textures
 * get swapped in later via AssetLoader.
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';
import { COLORS, getSeason } from '../config.js';


// ---------------------------------------------------------------
// Pseudo-noise helpers (sine-based, no dependency)
// ---------------------------------------------------------------

function terrainNoise(x, z) {
    return Math.sin(x * 0.3) * Math.cos(z * 0.4) * 0.3
         + Math.sin(x * 0.7 + z * 0.5) * 0.15;
}


export class SceneBuilder {

    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.season = getSeason(config.surveyMonth ?? 4);

        // groups matching the scene graph spec
        this.terrainGroup = new THREE.Group();
        this.terrainGroup.name = 'TerrainGroup';
        this.vegetationGroup = new THREE.Group();
        this.vegetationGroup.name = 'VegetationGroup';
        this.atmosphereGroup = new THREE.Group();
        this.atmosphereGroup.name = 'AtmosphereGroup';

        this.scene.add(this.terrainGroup);
        this.scene.add(this.vegetationGroup);
        this.scene.add(this.atmosphereGroup);

        // store references for external queries
        this.terrain = null;
        this.treePositions = [];
        this.dustPoints = null;
        this.fallingLeaves = [];
    }


    // ---------------------------------------------------------------
    // Main entry -- call once after scene + lights are ready
    // ---------------------------------------------------------------

    async build() {
        this.buildTerrain();
        this.buildTrees();
        this.buildCanopy();
        this.buildFerns();
        this.buildGroundDebris();
        this.buildAtmosphere();
    }


    // ---------------------------------------------------------------
    // Terrain
    // ---------------------------------------------------------------

    buildTerrain() {
        var geo = new THREE.PlaneGeometry(60, 60, 128, 128);
        geo.rotateX(-Math.PI / 2);

        // displace vertices for gentle undulation
        var pos = geo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
            var x = pos.getX(i);
            var z = pos.getZ(i);
            pos.setY(i, terrainNoise(x, z));
        }
        geo.computeVertexNormals();

        var mat = new THREE.MeshStandardMaterial({
            color: 0x6b5b47,
            roughness: 0.9,
            metalness: 0.0
        });

        this.terrain = new THREE.Mesh(geo, mat);
        this.terrain.name = 'terrain';
        this.terrain.receiveShadow = true;
        this.terrainGroup.add(this.terrain);
    }


    // ---------------------------------------------------------------
    // Trees
    // ---------------------------------------------------------------

    buildTrees(count) {
        count = count ?? 6;

        var trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 15, 8);
        var trunkMat = new THREE.MeshStandardMaterial({
            color: 0x5a4a3a,
            roughness: 0.85,
            metalness: 0.0
        });

        var mesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        var dummy = new THREE.Matrix4();
        var placed = [];

        for (var i = 0; i < count; i++) {
            var x, z, tooClose;

            // find a position that isn't too close to center or other trunks
            var attempts = 0;
            do {
                x = (Math.random() - 0.5) * 56;   // stay 2m inside the 60m edge
                z = (Math.random() - 0.5) * 56;
                tooClose = (Math.sqrt(x * x + z * z) < 3);
                if (!tooClose) {
                    for (var j = 0; j < placed.length; j++) {
                        var dx = x - placed[j].x;
                        var dz = z - placed[j].z;
                        if (Math.sqrt(dx * dx + dz * dz) < 3) {
                            tooClose = true;
                            break;
                        }
                    }
                }
                attempts++;
            } while (tooClose && attempts < 200);

            var terrainY = this.getTerrainHeightAt(x, z);
            var y = terrainY + 15 / 2;

            dummy.identity();
            dummy.makeTranslation(x, y, z);
            mesh.setMatrixAt(i, dummy);
            placed.push({ x: x, z: z });
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.treePositions = placed;
        this.vegetationGroup.add(mesh);
    }


    // ---------------------------------------------------------------
    // Canopy (shadow-casting dapple plane)
    // ---------------------------------------------------------------

    buildCanopy() {
        // procedural alpha map for dappled shadow
        var canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        var ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 512);

        ctx.fillStyle = '#ffffff';
        for (var i = 0; i < 260; i++) {
            var cx = Math.random() * 512;
            var cy = Math.random() * 512;
            var rx = 6 + Math.random() * 18;
            var ry = 4 + Math.random() * 14;
            var angle = Math.random() * Math.PI;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        var alphaMap = new THREE.CanvasTexture(canvas);
        alphaMap.wrapS = THREE.RepeatWrapping;
        alphaMap.wrapT = THREE.RepeatWrapping;

        var geo = new THREE.PlaneGeometry(60, 60);
        geo.rotateX(-Math.PI / 2);

        var mat = new THREE.MeshStandardMaterial({
            color: 0x3a6a30,
            alphaMap: alphaMap,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            roughness: 0.6,
            metalness: 0.0
        });

        var canopyPlane = new THREE.Mesh(geo, mat);
        canopyPlane.position.y = 20;
        canopyPlane.castShadow = true;
        canopyPlane.receiveShadow = false;
        canopyPlane.name = 'canopy';
        this.vegetationGroup.add(canopyPlane);
    }


    // ---------------------------------------------------------------
    // Ferns (cross-billboard instances)
    // ---------------------------------------------------------------

    buildFerns(count) {
        count = count ?? 40;

        // generate a simple fern frond alpha map
        var canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        var ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 256);

        // central spine
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(64, 256);
        ctx.lineTo(64, 10);
        ctx.stroke();

        // pinnae (leaf segments) along the spine
        for (var y = 30; y < 250; y += 12) {
            var spread = 20 + (1 - (y - 30) / 220) * 30;
            // left
            ctx.beginPath();
            ctx.moveTo(64, y);
            ctx.lineTo(64 - spread, y - 8);
            ctx.lineWidth = 3;
            ctx.stroke();
            // right
            ctx.beginPath();
            ctx.moveTo(64, y);
            ctx.lineTo(64 + spread, y - 8);
            ctx.stroke();
        }

        var alphaMap = new THREE.CanvasTexture(canvas);

        var fernMat = new THREE.MeshStandardMaterial({
            color: 0x3a6a30,
            roughness: 0.5,
            metalness: 0.0,
            alphaMap: alphaMap,
            transparent: true,
            alphaTest: 0.3,
            side: THREE.DoubleSide
        });

        // cross-billboard: two quads at 90 degrees
        var quad = new THREE.PlaneGeometry(0.6, 1.0);
        var crossGeo = new THREE.BufferGeometry();

        // clone quad for the second plane rotated 90 degrees
        var quad2 = new THREE.PlaneGeometry(0.6, 1.0);
        quad2.rotateY(Math.PI / 2);

        // merge them
        crossGeo = mergeGeometries([quad, quad2]);

        var mesh = new THREE.InstancedMesh(crossGeo, fernMat, count);
        mesh.receiveShadow = true;

        var dummy = new THREE.Matrix4();
        var scale = new THREE.Matrix4();
        var rotation = new THREE.Matrix4();
        var translation = new THREE.Matrix4();

        for (var i = 0; i < count; i++) {
            var x = (Math.random() - 0.5) * 54;
            var z = (Math.random() - 0.5) * 54;
            var s = 0.6 + Math.random() * 0.6;
            var terrainY = this.getTerrainHeightAt(x, z);

            dummy.identity();
            translation.makeTranslation(x, terrainY + s * 0.5, z);
            scale.makeScale(s, s, s);
            rotation.makeRotationY(Math.random() * Math.PI * 2);
            dummy.multiply(translation).multiply(rotation).multiply(scale);

            mesh.setMatrixAt(i, dummy);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.vegetationGroup.add(mesh);
    }


    // ---------------------------------------------------------------
    // Ground debris (rocks + twigs)
    // ---------------------------------------------------------------

    buildGroundDebris() {
        this._scatterRocks();
        this._scatterTwigs();
    }

    _scatterRocks() {
        var rockCount = 30 + Math.floor(Math.random() * 21);   // 30--50
        var geo = new THREE.SphereGeometry(1, 6, 5);            // unit sphere, scaled per instance
        var mat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.75,
            metalness: 0.0
        });

        var mesh = new THREE.InstancedMesh(geo, mat, rockCount);
        mesh.receiveShadow = true;
        mesh.castShadow = true;

        var dummy = new THREE.Matrix4();
        var scale = new THREE.Matrix4();
        var translation = new THREE.Matrix4();
        var rotation = new THREE.Matrix4();

        for (var i = 0; i < rockCount; i++) {
            var x = (Math.random() - 0.5) * 56;
            var z = (Math.random() - 0.5) * 56;
            var r = 0.03 + Math.random() * 0.05;
            var terrainY = this.getTerrainHeightAt(x, z);

            dummy.identity();
            translation.makeTranslation(x, terrainY + r * 0.5, z);
            scale.makeScale(r, r * (0.6 + Math.random() * 0.4), r);
            rotation.makeRotationY(Math.random() * Math.PI * 2);
            dummy.multiply(translation).multiply(rotation).multiply(scale);

            mesh.setMatrixAt(i, dummy);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.terrainGroup.add(mesh);
    }

    _scatterTwigs() {
        var twigCount = 20 + Math.floor(Math.random() * 11);   // 20--30
        var geo = new THREE.CylinderGeometry(0.005, 0.008, 1, 4);
        var mat = new THREE.MeshStandardMaterial({
            color: 0x6b4226,
            roughness: 0.85,
            metalness: 0.0
        });

        var mesh = new THREE.InstancedMesh(geo, mat, twigCount);
        mesh.receiveShadow = true;

        var dummy = new THREE.Matrix4();
        var scale = new THREE.Matrix4();
        var translation = new THREE.Matrix4();
        var rotation = new THREE.Euler();
        var rotMat = new THREE.Matrix4();

        for (var i = 0; i < twigCount; i++) {
            var x = (Math.random() - 0.5) * 56;
            var z = (Math.random() - 0.5) * 56;
            var len = 0.15 + Math.random() * 0.35;
            var terrainY = this.getTerrainHeightAt(x, z);

            rotation.set(
                Math.PI / 2 + (Math.random() - 0.5) * 0.3,   // nearly flat
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.2
            );

            dummy.identity();
            translation.makeTranslation(x, terrainY + 0.005, z);
            rotMat.makeRotationFromEuler(rotation);
            scale.makeScale(1, len, 1);
            dummy.multiply(translation).multiply(rotMat).multiply(scale);

            mesh.setMatrixAt(i, dummy);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.terrainGroup.add(mesh);
    }


    // ---------------------------------------------------------------
    // Atmosphere (dust motes + falling leaves)
    // ---------------------------------------------------------------

    buildAtmosphere() {
        this._buildDustMotes();
        this._buildFallingLeaves();
    }

    _buildDustMotes() {
        var particleCount = 300;
        var positions = new Float32Array(particleCount * 3);
        var sizes = new Float32Array(particleCount);

        for (var i = 0; i < particleCount; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 30;
            positions[i * 3 + 1] = Math.random() * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
            sizes[i] = 0.02 + Math.random() * 0.03;
        }

        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        var mat = new THREE.PointsMaterial({
            color: 0xfffae0,
            size: 0.04,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.dustPoints = new THREE.Points(geo, mat);
        this.dustPoints.name = 'dustMotes';
        this.atmosphereGroup.add(this.dustPoints);
    }

    _buildFallingLeaves() {
        var leafCount = 5 + Math.floor(Math.random() * 4);  // 5--8
        var seasonColors = COLORS[this.season] || COLORS.spring;
        var palette = seasonColors.litter;

        // simple teardrop leaf on a small canvas
        var canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 32, 32);

        var baseColor = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.bezierCurveTo(24, 10, 26, 22, 16, 30);
        ctx.bezierCurveTo(6, 22, 8, 10, 16, 2);
        ctx.fill();

        var leafTex = new THREE.CanvasTexture(canvas);
        var leafMat = new THREE.SpriteMaterial({
            map: leafTex,
            transparent: true,
            depthWrite: false
        });

        this.fallingLeaves = [];

        for (var i = 0; i < leafCount; i++) {
            var sprite = new THREE.Sprite(leafMat.clone());
            sprite.scale.set(0.15, 0.15, 0.15);

            // recolor each leaf individually
            var c = palette[Math.floor(Math.random() * palette.length)];
            sprite.material.color.set(c);

            // random starting position in the canopy volume
            sprite.position.set(
                (Math.random() - 0.5) * 30,
                10 + Math.random() * 10,
                (Math.random() - 0.5) * 30
            );

            // stash velocity data on the sprite for animation
            sprite.userData.vy = -0.3 - Math.random() * 0.1;
            sprite.userData.vx = (Math.random() - 0.5) * 0.2;
            sprite.userData.vz = (Math.random() - 0.5) * 0.1;
            sprite.userData.spin = (Math.random() - 0.5) * 0.02;

            this.fallingLeaves.push(sprite);
            this.atmosphereGroup.add(sprite);
        }
    }


    // ---------------------------------------------------------------
    // Per-frame animation (called from the render loop)
    // ---------------------------------------------------------------

    update(dt) {
        dt = dt || 1 / 60;

        // dust mote drift
        if (this.dustPoints) {
            var pos = this.dustPoints.geometry.attributes.position;
            for (var i = 0; i < pos.count; i++) {
                pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.002);
                pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.001);
                pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.002);

                // keep inside the volume
                if (Math.abs(pos.getX(i)) > 15) pos.setX(i, pos.getX(i) * -0.9);
                if (pos.getY(i) < 0 || pos.getY(i) > 10) pos.setY(i, Math.random() * 10);
                if (Math.abs(pos.getZ(i)) > 15) pos.setZ(i, pos.getZ(i) * -0.9);
            }
            pos.needsUpdate = true;
        }

        // falling leaves
        for (var j = 0; j < this.fallingLeaves.length; j++) {
            var leaf = this.fallingLeaves[j];
            leaf.position.x += leaf.userData.vx * dt * 60;
            leaf.position.y += leaf.userData.vy * dt * 60;
            leaf.position.z += leaf.userData.vz * dt * 60;

            // slight drift oscillation
            leaf.userData.vx += (Math.random() - 0.5) * 0.005;
            leaf.userData.vx = Math.max(-0.15, Math.min(0.15, leaf.userData.vx));

            // respawn at top when below ground
            var groundY = this.getTerrainHeightAt(leaf.position.x, leaf.position.z);
            if (leaf.position.y < groundY) {
                leaf.position.set(
                    (Math.random() - 0.5) * 30,
                    15 + Math.random() * 8,
                    (Math.random() - 0.5) * 30
                );
                leaf.userData.vx = (Math.random() - 0.5) * 0.2;
            }
        }
    }


    // ---------------------------------------------------------------
    // Terrain height query
    // ---------------------------------------------------------------

    getTerrainHeightAt(x, z) {
        return terrainNoise(x, z);
    }
}


// ---------------------------------------------------------------
// Utility: merge two BufferGeometries into one
// (avoids importing BufferGeometryUtils for a single use)
// ---------------------------------------------------------------

function mergeGeometries(geometries) {
    var totalVerts = 0;
    var totalIdx = 0;

    for (var g = 0; g < geometries.length; g++) {
        totalVerts += geometries[g].attributes.position.count;
        if (geometries[g].index) {
            totalIdx += geometries[g].index.count;
        }
    }

    var positions = new Float32Array(totalVerts * 3);
    var normals = new Float32Array(totalVerts * 3);
    var uvs = new Float32Array(totalVerts * 2);
    var indices = totalIdx > 0 ? new Uint16Array(totalIdx) : null;

    var vertOffset = 0;
    var idxOffset = 0;
    var vertCount = 0;

    for (var g = 0; g < geometries.length; g++) {
        var geo = geometries[g];
        var p = geo.attributes.position.array;
        var n = geo.attributes.normal ? geo.attributes.normal.array : null;
        var u = geo.attributes.uv ? geo.attributes.uv.array : null;

        for (var i = 0; i < p.length; i++) positions[vertOffset * 3 + i] = p[i];
        if (n) for (var i = 0; i < n.length; i++) normals[vertOffset * 3 + i] = n[i];
        if (u) for (var i = 0; i < u.length; i++) uvs[vertOffset * 2 + i] = u[i];

        if (geo.index && indices) {
            var idx = geo.index.array;
            for (var i = 0; i < idx.length; i++) {
                indices[idxOffset + i] = idx[i] + vertCount;
            }
            idxOffset += idx.length;
        }

        vertCount += geo.attributes.position.count;
        vertOffset += geo.attributes.position.count;
    }

    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));

    return merged;
}
