/**
 * Batesian Mimicry Simulation -- 3D Scene Builder
 *
 * Constructs a photorealistic Appalachian cove hardwood forest.
 * Dense ground vegetation, moss-covered rocks and logs, bark-textured
 * trunks, dappled canopy light, atmospheric particles and mist.
 *
 * Uses PBR textures from ../assets/textures/ and HDRI from ../assets/hdri/.
 * Falls back gracefully to solid colors when textures are unavailable.
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { COLORS, getSeason } from '../config.js';


// ---------------------------------------------------------------
// Pseudo-noise helpers (sine-based, no dependency)
// ---------------------------------------------------------------

function terrainNoise(x, z) {
    return Math.sin(x * 0.3) * Math.cos(z * 0.4) * 0.3
         + Math.sin(x * 0.7 + z * 0.5) * 0.15;
}

function hash(x, z) {
    var h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return h - Math.floor(h);
}


// ---------------------------------------------------------------
// Utility: merge two BufferGeometries into one
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


// ---------------------------------------------------------------
// Poisson disk sampling on a rectangular domain
// ---------------------------------------------------------------

function poissonDisk(width, height, minDist, maxAttempts, exclusionRadius) {
    maxAttempts = maxAttempts || 30;
    exclusionRadius = exclusionRadius || 0;
    var cellSize = minDist / Math.SQRT2;
    var gridW = Math.ceil(width / cellSize);
    var gridH = Math.ceil(height / cellSize);
    var grid = new Array(gridW * gridH).fill(-1);
    var points = [];
    var active = [];

    function gridIndex(px, pz) {
        var gx = Math.floor((px + width / 2) / cellSize);
        var gz = Math.floor((pz + height / 2) / cellSize);
        return gz * gridW + gx;
    }

    function inBounds(px, pz) {
        return Math.abs(px) < width / 2 && Math.abs(pz) < height / 2;
    }

    // seed
    var sx = (Math.random() - 0.5) * width * 0.5;
    var sz = (Math.random() - 0.5) * height * 0.5;
    points.push({ x: sx, z: sz });
    active.push(0);
    grid[gridIndex(sx, sz)] = 0;

    while (active.length > 0) {
        var ri = Math.floor(Math.random() * active.length);
        var pi = active[ri];
        var px = points[pi].x;
        var pz = points[pi].z;
        var found = false;

        for (var a = 0; a < maxAttempts; a++) {
            var angle = Math.random() * Math.PI * 2;
            var dist = minDist + Math.random() * minDist;
            var nx = px + Math.cos(angle) * dist;
            var nz = pz + Math.sin(angle) * dist;

            if (!inBounds(nx, nz)) continue;

            // exclusion zone around center (player spawn)
            if (exclusionRadius > 0 && Math.sqrt(nx * nx + nz * nz) < exclusionRadius) continue;

            var gi = gridIndex(nx, nz);
            var gx = Math.floor((nx + width / 2) / cellSize);
            var gz = Math.floor((nz + height / 2) / cellSize);
            var ok = true;

            for (var dz = -2; dz <= 2 && ok; dz++) {
                for (var dx = -2; dx <= 2 && ok; dx++) {
                    var cx = gx + dx;
                    var cz = gz + dz;
                    if (cx < 0 || cx >= gridW || cz < 0 || cz >= gridH) continue;
                    var ci = cz * gridW + cx;
                    if (grid[ci] === -1) continue;
                    var op = points[grid[ci]];
                    var ddx = nx - op.x;
                    var ddz = nz - op.z;
                    if (ddx * ddx + ddz * ddz < minDist * minDist) ok = false;
                }
            }

            if (ok) {
                var ni = points.length;
                points.push({ x: nx, z: nz });
                active.push(ni);
                grid[gi] = ni;
                found = true;
                break;
            }
        }

        if (!found) {
            active.splice(ri, 1);
        }
    }

    return points;
}


// ---------------------------------------------------------------
// Procedural canvas textures for vegetation
// ---------------------------------------------------------------

var VegetationTextures = {

    herbClump: function() {
        var canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        var ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 128, 128);

        // several small leaves radiating from center base
        for (var i = 0; i < 7 + Math.floor(Math.random() * 5); i++) {
            var angle = (Math.random() - 0.5) * 1.4;
            var stemH = 30 + Math.random() * 55;
            var leafW = 8 + Math.random() * 12;
            var baseX = 54 + Math.random() * 20;
            var g = 80 + Math.floor(Math.random() * 80);
            var r = 20 + Math.floor(Math.random() * 50);
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',20)';

            ctx.save();
            ctx.translate(baseX, 124);
            ctx.rotate(angle);

            // stem
            ctx.fillRect(-1, -stemH, 2, stemH);

            // leaf
            ctx.beginPath();
            ctx.ellipse(0, -stemH + 5, leafW / 2, stemH * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        return new THREE.CanvasTexture(canvas);
    },

    fern: function() {
        var canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 256);

        var g = 80 + Math.floor(Math.random() * 60);
        var baseColor = 'rgb(30,' + g + ',20)';

        // central rachis
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(64, 250);
        ctx.quadraticCurveTo(64 + (Math.random() - 0.5) * 10, 120, 64, 6);
        ctx.stroke();

        // pinnae
        for (var y = 30; y < 245; y += 8) {
            var progress = (y - 30) / 215;
            var spread = 10 + (1 - progress) * 38;
            var pinnaeLen = spread * (0.7 + Math.random() * 0.3);

            g = 70 + Math.floor(Math.random() * 70);
            ctx.fillStyle = 'rgb(25,' + g + ',15)';

            // left pinna
            ctx.beginPath();
            ctx.moveTo(64, y);
            ctx.quadraticCurveTo(64 - pinnaeLen * 0.6, y - 6, 64 - pinnaeLen, y - 3);
            ctx.lineTo(64 - pinnaeLen, y - 1);
            ctx.quadraticCurveTo(64 - pinnaeLen * 0.6, y + 2, 64, y + 2);
            ctx.fill();

            // right pinna
            ctx.beginPath();
            ctx.moveTo(64, y);
            ctx.quadraticCurveTo(64 + pinnaeLen * 0.6, y - 6, 64 + pinnaeLen, y - 3);
            ctx.lineTo(64 + pinnaeLen, y - 1);
            ctx.quadraticCurveTo(64 + pinnaeLen * 0.6, y + 2, 64, y + 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    },

    wildflower: function(petalColor, petalCount) {
        petalColor = petalColor || '#ffffff';
        petalCount = petalCount || 5;
        var canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 128;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 64, 128);

        // stem
        ctx.strokeStyle = '#3a6b28';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(32, 126);
        ctx.quadraticCurveTo(30, 80, 32, 40);
        ctx.stroke();

        // small leaf on stem
        ctx.fillStyle = '#4a8a38';
        ctx.beginPath();
        ctx.ellipse(28, 85, 6, 10, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // flower head
        ctx.fillStyle = petalColor;
        var cx = 32, cy = 30;
        for (var i = 0; i < petalCount; i++) {
            var a = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
            var px = cx + Math.cos(a) * 9;
            var py = cy + Math.sin(a) * 9;
            ctx.beginPath();
            ctx.ellipse(px, py, 6, 9, a, 0, Math.PI * 2);
            ctx.fill();
        }

        // center
        ctx.fillStyle = '#c8a820';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    },

    trillium: function() {
        var canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 128;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 96, 128);

        // stem
        ctx.strokeStyle = '#4a7a38';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(48, 126);
        ctx.lineTo(48, 55);
        ctx.stroke();

        // three large leaves
        ctx.fillStyle = '#3a6a2a';
        for (var i = 0; i < 3; i++) {
            var a = (i / 3) * Math.PI * 2 - Math.PI / 2;
            ctx.save();
            ctx.translate(48, 62);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(12, -8, 18, -22, 0, -30);
            ctx.bezierCurveTo(-18, -22, -12, -8, 0, 0);
            ctx.fill();
            ctx.restore();
        }

        // three yellow petals
        ctx.fillStyle = '#d4c020';
        for (var i = 0; i < 3; i++) {
            var a = (i / 3) * Math.PI * 2 - Math.PI / 6;
            ctx.save();
            ctx.translate(48, 50);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(5, -4, 7, -14, 0, -18);
            ctx.bezierCurveTo(-7, -14, -5, -4, 0, 0);
            ctx.fill();
            ctx.restore();
        }

        return new THREE.CanvasTexture(canvas);
    }
};


// ---------------------------------------------------------------
// SceneBuilder
// ---------------------------------------------------------------

export class SceneBuilder {

    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.season = getSeason(config.surveyMonth ?? 4);

        this.textureLoader = new THREE.TextureLoader();
        this.textures = {};
        this.texturesLoaded = false;

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

        // references for queries and animation
        this.terrain = null;
        this.treePositions = [];
        this.dustPoints = null;
        this.fallingLeaves = [];
        this.mistPlanes = [];
        this.elapsedTime = 0;
    }


    // ---------------------------------------------------------------
    // Texture loading
    // ---------------------------------------------------------------

    _loadPBRSet(name, path, repeatX, repeatY) {
        repeatX = repeatX || 1;
        repeatY = repeatY || 1;
        var self = this;
        var set = {};

        var files = {
            albedo: path + '/albedo.jpg',
            normal: path + '/normal.jpg',
            roughness: path + '/roughness.jpg'
        };

        var keys = Object.keys(files);
        for (var i = 0; i < keys.length; i++) {
            (function(key, url) {
                try {
                    var tex = self.textureLoader.load(url, function(t) {
                        t.colorSpace = (key === 'albedo') ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
                    }, undefined, function() {
                        console.warn('Texture not found: ' + url);
                    });
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(repeatX, repeatY);
                    set[key] = tex;
                } catch (e) {
                    console.warn('Failed to load texture: ' + url);
                }
            })(keys[i], files[keys[i]]);
        }

        self.textures[name] = set;
    }

    _loadAllTextures() {
        var basePath = '../assets/textures';

        this._loadPBRSet('forestFloor', basePath + '/forest_floor', 6, 6);
        this._loadPBRSet('soil',        basePath + '/soil',         4, 4);
        this._loadPBRSet('rock',        basePath + '/rock',         1, 1);
        this._loadPBRSet('bark',        basePath + '/bark',         1, 2);
        this._loadPBRSet('moss',        basePath + '/moss',         2, 2);

        this.texturesLoaded = true;
    }

    _loadHDRI() {
        var self = this;
        var rgbeLoader = new RGBELoader();
        rgbeLoader.load('../assets/hdri/forest.hdr', function(texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            self.scene.environment = texture;
        }, undefined, function() {
            console.warn('HDRI not found, using default environment');
        });
    }


    // ---------------------------------------------------------------
    // Material helpers
    // ---------------------------------------------------------------

    _pbrMaterial(texSet, fallbackColor, opts) {
        opts = opts || {};
        var params = {
            roughness: opts.roughness || 0.85,
            metalness: opts.metalness || 0.0
        };

        if (texSet && texSet.albedo) {
            params.map = texSet.albedo;
        } else {
            params.color = new THREE.Color(fallbackColor);
        }

        if (texSet && texSet.normal) {
            params.normalMap = texSet.normal;
            params.normalScale = new THREE.Vector2(
                opts.normalStrength || 1.0,
                opts.normalStrength || 1.0
            );
        }

        if (texSet && texSet.roughness) {
            params.roughnessMap = texSet.roughness;
        }

        if (opts.transparent) params.transparent = true;
        if (opts.opacity !== undefined) params.opacity = opts.opacity;
        if (opts.alphaTest !== undefined) params.alphaTest = opts.alphaTest;
        if (opts.side) params.side = opts.side;
        if (opts.alphaMap) params.alphaMap = opts.alphaMap;
        if (opts.map) params.map = opts.map;

        return new THREE.MeshStandardMaterial(params);
    }


    // ---------------------------------------------------------------
    // Main entry -- call once after scene + lights are ready
    // ---------------------------------------------------------------

    async build() {
        this._loadAllTextures();
        this._loadHDRI();

        this._buildTerrain();
        this._buildTrees();
        this._buildCanopy();
        this._buildFallenLogs();
        this._buildRocks();
        this._buildGroundHerbs();
        this._buildFerns();
        this._buildWildflowers();
        this._buildTwigs();
        this._buildAtmosphere();
    }


    // ---------------------------------------------------------------
    // Terrain
    // ---------------------------------------------------------------

    _buildTerrain() {
        var geo = new THREE.PlaneGeometry(60, 60, 128, 128);
        geo.rotateX(-Math.PI / 2);

        var pos = geo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
            var x = pos.getX(i);
            var z = pos.getZ(i);
            pos.setY(i, terrainNoise(x, z));
        }
        geo.computeVertexNormals();

        var texSet = this.textures.forestFloor || null;
        var mat = this._pbrMaterial(texSet, 0x4a5a38, {
            roughness: 0.92,
            normalStrength: 0.8
        });

        this.terrain = new THREE.Mesh(geo, mat);
        this.terrain.name = 'terrain';
        this.terrain.receiveShadow = true;
        this.terrainGroup.add(this.terrain);

        // secondary soil layer visible through vegetation gaps -- darker earth
        var soilGeo = new THREE.PlaneGeometry(60, 60, 32, 32);
        soilGeo.rotateX(-Math.PI / 2);

        var soilPos = soilGeo.attributes.position;
        for (var i = 0; i < soilPos.count; i++) {
            var x = soilPos.getX(i);
            var z = soilPos.getZ(i);
            soilPos.setY(i, terrainNoise(x, z) - 0.01);
        }
        soilGeo.computeVertexNormals();

        var soilTex = this.textures.soil || null;
        var soilMat = this._pbrMaterial(soilTex, 0x6b5b47, { roughness: 0.95 });

        var soilMesh = new THREE.Mesh(soilGeo, soilMat);
        soilMesh.receiveShadow = true;
        this.terrainGroup.add(soilMesh);
    }


    // ---------------------------------------------------------------
    // Trees -- 14 trunks with bark texture and root flare
    // ---------------------------------------------------------------

    _buildTrees() {
        var count = 14;
        var barkTex = this.textures.bark || null;

        var trunkMat = this._pbrMaterial(barkTex, 0x5a4a3a, {
            roughness: 0.88,
            normalStrength: 1.2
        });

        // custom trunk geometry with root flare (wider at base)
        var trunkGeo = new THREE.CylinderGeometry(0.12, 0.3, 16, 10, 8);
        var trunkPos = trunkGeo.attributes.position;
        for (var i = 0; i < trunkPos.count; i++) {
            var y = trunkPos.getY(i);
            var normalizedY = (y + 8) / 16; // 0 at bottom, 1 at top

            // root flare: exponential widening in the bottom 15%
            if (normalizedY < 0.15) {
                var flare = 1 + (1 - normalizedY / 0.15) * 0.6;
                trunkPos.setX(i, trunkPos.getX(i) * flare);
                trunkPos.setZ(i, trunkPos.getZ(i) * flare);
            }
        }
        trunkGeo.computeVertexNormals();

        var mesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        var dummy = new THREE.Matrix4();
        var scaleMat = new THREE.Matrix4();
        var rotMat = new THREE.Matrix4();
        var transMat = new THREE.Matrix4();
        var placed = [];

        for (var i = 0; i < count; i++) {
            var x, z, tooClose;
            var attempts = 0;

            do {
                x = (Math.random() - 0.5) * 54;
                z = (Math.random() - 0.5) * 54;
                tooClose = (Math.sqrt(x * x + z * z) < 2.5);
                if (!tooClose) {
                    for (var j = 0; j < placed.length; j++) {
                        var dx = x - placed[j].x;
                        var dz = z - placed[j].z;
                        if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
                            tooClose = true;
                            break;
                        }
                    }
                }
                attempts++;
            } while (tooClose && attempts < 300);

            var terrainY = this.getTerrainHeightAt(x, z);

            // vary each trunk
            var radiusScale = 0.7 + Math.random() * 0.8;
            var heightScale = 0.85 + Math.random() * 0.35;
            var trunkH = 16 * heightScale;
            var y = terrainY + trunkH / 2 - 0.3; // sink slightly into ground

            dummy.identity();
            transMat.makeTranslation(x, y, z);
            scaleMat.makeScale(radiusScale, heightScale, radiusScale);
            rotMat.makeRotationY(Math.random() * Math.PI * 2);
            dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);

            mesh.setMatrixAt(i, dummy);
            placed.push({ x: x, z: z });
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.treePositions = placed;
        this.vegetationGroup.add(mesh);
    }


    // ---------------------------------------------------------------
    // Canopy -- multiple layered planes for natural dappled shadows
    // ---------------------------------------------------------------

    _buildCanopy() {
        var planeCount = 10;

        for (var p = 0; p < planeCount; p++) {
            var canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            var ctx = canvas.getContext('2d');

            // start opaque (blocks light)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 512, 512);

            // punch holes where light comes through
            ctx.fillStyle = '#ffffff';
            var holeCount = 120 + Math.floor(Math.random() * 160);
            for (var i = 0; i < holeCount; i++) {
                var cx = Math.random() * 512;
                var cy = Math.random() * 512;
                var rx = 4 + Math.random() * 22;
                var ry = 3 + Math.random() * 16;
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

            var size = 18 + Math.random() * 22;
            var geo = new THREE.PlaneGeometry(size, size);
            geo.rotateX(-Math.PI / 2);

            // tint variation -- golden-green to deep green
            var tintG = 0x50 + Math.floor(Math.random() * 0x30);
            var tintR = 0x20 + Math.floor(Math.random() * 0x20);
            var tintB = 0x15 + Math.floor(Math.random() * 0x18);
            var tint = (tintR << 16) | (tintG << 8) | tintB;

            var mat = new THREE.MeshStandardMaterial({
                color: tint,
                alphaMap: alphaMap,
                transparent: true,
                opacity: 0.55 + Math.random() * 0.2,
                side: THREE.DoubleSide,
                roughness: 0.5,
                metalness: 0.0
            });

            var canopyPlane = new THREE.Mesh(geo, mat);
            canopyPlane.position.set(
                (Math.random() - 0.5) * 30,
                18 + Math.random() * 7,
                (Math.random() - 0.5) * 30
            );
            canopyPlane.rotation.y = Math.random() * Math.PI;
            canopyPlane.castShadow = true;
            canopyPlane.receiveShadow = false;
            canopyPlane.name = 'canopy_' + p;
            this.vegetationGroup.add(canopyPlane);
        }
    }


    // ---------------------------------------------------------------
    // Fallen logs -- 6 moss-covered logs lying on the ground
    // ---------------------------------------------------------------

    _buildFallenLogs() {
        var logCount = 6;
        var barkTex = this.textures.bark || null;
        var mossTex = this.textures.moss || null;

        for (var i = 0; i < logCount; i++) {
            var length = 1.5 + Math.random() * 2.0;
            var radius = 0.08 + Math.random() * 0.12;
            var logGeo = new THREE.CylinderGeometry(radius * 0.85, radius, length, 8, 1);

            var logMat = this._pbrMaterial(barkTex, 0x6b4226, {
                roughness: 0.88,
                normalStrength: 1.0
            });

            var log = new THREE.Mesh(logGeo, logMat);

            var x = (Math.random() - 0.5) * 44;
            var z = (Math.random() - 0.5) * 44;
            var terrainY = this.getTerrainHeightAt(x, z);

            log.position.set(x, terrainY + radius * 0.4, z);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = Math.random() * Math.PI;
            // slight tilt so it's not perfectly level
            log.rotation.x = (Math.random() - 0.5) * 0.15;

            log.castShadow = true;
            log.receiveShadow = true;
            this.terrainGroup.add(log);

            // moss covering on top surface
            var mossGeo = new THREE.PlaneGeometry(length * 0.8, radius * 2.2);
            var mossMat = this._pbrMaterial(mossTex, 0x52b788, {
                roughness: 0.95,
                normalStrength: 0.6,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            });

            var mossLayer = new THREE.Mesh(mossGeo, mossMat);
            mossLayer.position.set(x, terrainY + radius * 1.1, z);
            mossLayer.rotation.x = -Math.PI / 2;
            mossLayer.rotation.z = log.rotation.y;
            mossLayer.receiveShadow = true;
            this.terrainGroup.add(mossLayer);
        }
    }


    // ---------------------------------------------------------------
    // Rocks -- 25 moss-covered rocks scattered through the scene
    // ---------------------------------------------------------------

    _buildRocks() {
        var rockCount = 25;
        var rockTex = this.textures.rock || null;
        var mossTex = this.textures.moss || null;

        var geo = new THREE.SphereGeometry(1, 7, 5);
        var rockMat = this._pbrMaterial(rockTex, 0x888888, {
            roughness: 0.78,
            normalStrength: 1.0
        });

        var mesh = new THREE.InstancedMesh(geo, rockMat, rockCount);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        var dummy = new THREE.Matrix4();
        var scaleMat = new THREE.Matrix4();
        var transMat = new THREE.Matrix4();
        var rotMat = new THREE.Matrix4();

        var rockPositions = [];

        for (var i = 0; i < rockCount; i++) {
            var x = (Math.random() - 0.5) * 50;
            var z = (Math.random() - 0.5) * 50;
            var terrainY = this.getTerrainHeightAt(x, z);

            // mix of small and medium rocks
            var s = 0.06 + Math.random() * 0.18;
            var sy = s * (0.4 + Math.random() * 0.5); // flattened
            var sx = s * (0.8 + Math.random() * 0.4);
            var sz = s * (0.8 + Math.random() * 0.4);

            dummy.identity();
            transMat.makeTranslation(x, terrainY + sy * 0.3, z);
            scaleMat.makeScale(sx, sy, sz);
            rotMat.makeRotationY(Math.random() * Math.PI * 2);
            dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);

            mesh.setMatrixAt(i, dummy);
            rockPositions.push({ x: x, z: z, s: s, sy: sy, terrainY: terrainY });
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.terrainGroup.add(mesh);

        // moss caps on top of the larger rocks
        var mossCapGeo = new THREE.CircleGeometry(1, 8);
        mossCapGeo.rotateX(-Math.PI / 2);

        var mossCapMat = this._pbrMaterial(mossTex, 0x52b788, {
            roughness: 0.95,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        var mossCount = 0;
        for (var i = 0; i < rockPositions.length; i++) {
            if (rockPositions[i].s > 0.1) mossCount++;
        }

        if (mossCount > 0) {
            var mossMesh = new THREE.InstancedMesh(mossCapGeo, mossCapMat, mossCount);
            mossMesh.receiveShadow = true;
            var mi = 0;

            for (var i = 0; i < rockPositions.length; i++) {
                var rp = rockPositions[i];
                if (rp.s <= 0.1) continue;

                dummy.identity();
                transMat.makeTranslation(rp.x, rp.terrainY + rp.sy * 0.7, rp.z);
                scaleMat.makeScale(rp.s * 0.9, 1, rp.s * 0.9);
                rotMat.makeRotationY(Math.random() * Math.PI);
                dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);
                mossMesh.setMatrixAt(mi, dummy);
                mi++;
            }

            mossMesh.instanceMatrix.needsUpdate = true;
            this.terrainGroup.add(mossMesh);
        }
    }


    // ---------------------------------------------------------------
    // Dense ground herbs -- 300 cross-billboard instances
    // ---------------------------------------------------------------

    _buildGroundHerbs() {
        var count = 300;

        // generate several herb texture variants
        var herbTextures = [];
        for (var t = 0; t < 4; t++) {
            herbTextures.push(VegetationTextures.herbClump());
        }

        var quad1 = new THREE.PlaneGeometry(0.35, 0.28);
        var quad2 = new THREE.PlaneGeometry(0.35, 0.28);
        quad2.rotateY(Math.PI / 2);
        var crossGeo = mergeGeometries([quad1, quad2]);

        // one instanced mesh per texture variant
        var perVariant = Math.ceil(count / herbTextures.length);

        for (var v = 0; v < herbTextures.length; v++) {
            var thisBatch = Math.min(perVariant, count - v * perVariant);
            if (thisBatch <= 0) break;

            var mat = new THREE.MeshStandardMaterial({
                map: herbTextures[v],
                transparent: true,
                alphaTest: 0.3,
                side: THREE.DoubleSide,
                roughness: 0.5,
                metalness: 0.0,
                color: new THREE.Color(
                    0.15 + Math.random() * 0.15,
                    0.35 + Math.random() * 0.25,
                    0.08 + Math.random() * 0.1
                )
            });

            var mesh = new THREE.InstancedMesh(crossGeo, mat, thisBatch);
            mesh.receiveShadow = true;

            var dummy = new THREE.Matrix4();
            var scaleMat = new THREE.Matrix4();
            var rotMat = new THREE.Matrix4();
            var transMat = new THREE.Matrix4();

            for (var i = 0; i < thisBatch; i++) {
                var x = (Math.random() - 0.5) * 52;
                var z = (Math.random() - 0.5) * 52;
                var terrainY = this.getTerrainHeightAt(x, z);
                var s = 0.6 + Math.random() * 0.7;

                dummy.identity();
                transMat.makeTranslation(x, terrainY + s * 0.12, z);
                scaleMat.makeScale(s, s, s);
                rotMat.makeRotationY(Math.random() * Math.PI * 2);
                dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);

                mesh.setMatrixAt(i, dummy);
            }

            mesh.instanceMatrix.needsUpdate = true;
            this.vegetationGroup.add(mesh);
        }
    }


    // ---------------------------------------------------------------
    // Ferns -- 100 cross-billboard instances
    // ---------------------------------------------------------------

    _buildFerns() {
        var count = 100;

        // generate several fern variants for visual diversity
        var fernTextures = [];
        for (var t = 0; t < 3; t++) {
            fernTextures.push(VegetationTextures.fern());
        }

        var quad1 = new THREE.PlaneGeometry(0.6, 1.0);
        var quad2 = new THREE.PlaneGeometry(0.6, 1.0);
        quad2.rotateY(Math.PI / 2);
        var crossGeo = mergeGeometries([quad1, quad2]);

        var perVariant = Math.ceil(count / fernTextures.length);

        for (var v = 0; v < fernTextures.length; v++) {
            var thisBatch = Math.min(perVariant, count - v * perVariant);
            if (thisBatch <= 0) break;

            var mat = new THREE.MeshStandardMaterial({
                map: fernTextures[v],
                transparent: true,
                alphaTest: 0.3,
                side: THREE.DoubleSide,
                roughness: 0.45,
                metalness: 0.0,
                color: new THREE.Color(
                    0.12 + Math.random() * 0.1,
                    0.3 + Math.random() * 0.25,
                    0.06 + Math.random() * 0.08
                )
            });

            var mesh = new THREE.InstancedMesh(crossGeo, mat, thisBatch);
            mesh.receiveShadow = true;

            var dummy = new THREE.Matrix4();
            var scaleMat = new THREE.Matrix4();
            var rotMat = new THREE.Matrix4();
            var transMat = new THREE.Matrix4();

            for (var i = 0; i < thisBatch; i++) {
                var x = (Math.random() - 0.5) * 52;
                var z = (Math.random() - 0.5) * 52;
                var terrainY = this.getTerrainHeightAt(x, z);
                var s = 0.4 + Math.random() * 0.5;

                dummy.identity();
                transMat.makeTranslation(x, terrainY + s * 0.45, z);
                scaleMat.makeScale(s, s, s);
                rotMat.makeRotationY(Math.random() * Math.PI * 2);
                dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);

                mesh.setMatrixAt(i, dummy);
            }

            mesh.instanceMatrix.needsUpdate = true;
            this.vegetationGroup.add(mesh);
        }
    }


    // ---------------------------------------------------------------
    // Wildflowers -- clustered patches of trillium, phlox, phacelia
    // ---------------------------------------------------------------

    _buildWildflowers() {
        var self = this;

        var flowerTypes = [
            { gen: function() { return VegetationTextures.trillium(); }, height: 0.35, width: 0.25, count: 12 },
            { gen: function() { return VegetationTextures.wildflower('#b088d0', 5); }, height: 0.30, width: 0.15, count: 10 },
            { gen: function() { return VegetationTextures.wildflower('#ffffff', 5); }, height: 0.25, width: 0.12, count: 18 },
            { gen: function() { return VegetationTextures.wildflower('#e8e0a0', 6); }, height: 0.22, width: 0.10, count: 10 }
        ];

        for (var f = 0; f < flowerTypes.length; f++) {
            var ft = flowerTypes[f];
            var tex = ft.gen();

            var quad1 = new THREE.PlaneGeometry(ft.width, ft.height);
            var quad2 = new THREE.PlaneGeometry(ft.width, ft.height);
            quad2.rotateY(Math.PI / 2);
            var crossGeo = mergeGeometries([quad1, quad2]);

            var mat = new THREE.MeshStandardMaterial({
                map: tex,
                transparent: true,
                alphaTest: 0.25,
                side: THREE.DoubleSide,
                roughness: 0.4,
                metalness: 0.0
            });

            var mesh = new THREE.InstancedMesh(crossGeo, mat, ft.count);
            mesh.receiveShadow = true;

            var dummy = new THREE.Matrix4();
            var scaleMat = new THREE.Matrix4();
            var rotMat = new THREE.Matrix4();
            var transMat = new THREE.Matrix4();

            // cluster flowers in patches
            var clusterCenters = [];
            var clustersNeeded = Math.ceil(ft.count / 5);
            for (var c = 0; c < clustersNeeded; c++) {
                clusterCenters.push({
                    x: (Math.random() - 0.5) * 44,
                    z: (Math.random() - 0.5) * 44
                });
            }

            for (var i = 0; i < ft.count; i++) {
                var cluster = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
                var x = cluster.x + (Math.random() - 0.5) * 2.0;
                var z = cluster.z + (Math.random() - 0.5) * 2.0;
                var terrainY = self.getTerrainHeightAt(x, z);
                var s = 0.7 + Math.random() * 0.5;

                dummy.identity();
                transMat.makeTranslation(x, terrainY + ft.height * s * 0.45, z);
                scaleMat.makeScale(s, s, s);
                rotMat.makeRotationY(Math.random() * Math.PI * 2);
                dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);

                mesh.setMatrixAt(i, dummy);
            }

            mesh.instanceMatrix.needsUpdate = true;
            this.vegetationGroup.add(mesh);
        }
    }


    // ---------------------------------------------------------------
    // Twigs and leaf litter
    // ---------------------------------------------------------------

    _buildTwigs() {
        var twigCount = 25;
        var geo = new THREE.CylinderGeometry(0.005, 0.008, 1, 4);
        var mat = new THREE.MeshStandardMaterial({
            color: 0x6b4226,
            roughness: 0.85,
            metalness: 0.0
        });

        var mesh = new THREE.InstancedMesh(geo, mat, twigCount);
        mesh.receiveShadow = true;

        var dummy = new THREE.Matrix4();
        var scaleMat = new THREE.Matrix4();
        var transMat = new THREE.Matrix4();
        var rotation = new THREE.Euler();
        var rotMat = new THREE.Matrix4();

        for (var i = 0; i < twigCount; i++) {
            var x = (Math.random() - 0.5) * 56;
            var z = (Math.random() - 0.5) * 56;
            var len = 0.15 + Math.random() * 0.35;
            var terrainY = this.getTerrainHeightAt(x, z);

            rotation.set(
                Math.PI / 2 + (Math.random() - 0.5) * 0.3,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.2
            );

            dummy.identity();
            transMat.makeTranslation(x, terrainY + 0.005, z);
            rotMat.makeRotationFromEuler(rotation);
            scaleMat.makeScale(1, len, 1);
            dummy.multiply(transMat).multiply(rotMat).multiply(scaleMat);

            mesh.setMatrixAt(i, dummy);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.terrainGroup.add(mesh);
    }


    // ---------------------------------------------------------------
    // Atmosphere -- dust, mist, falling leaves
    // ---------------------------------------------------------------

    _buildAtmosphere() {
        this._buildDustMotes();
        this._buildMistPlanes();
        this._buildFallingLeaves();
    }

    _buildDustMotes() {
        var particleCount = 600;
        var positions = new Float32Array(particleCount * 3);
        var sizes = new Float32Array(particleCount);

        for (var i = 0; i < particleCount; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 30;
            positions[i * 3 + 1] = 0.5 + Math.random() * 12;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
            sizes[i] = 0.015 + Math.random() * 0.035;
        }

        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        var mat = new THREE.PointsMaterial({
            color: 0xfffae0,
            size: 0.035,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.dustPoints = new THREE.Points(geo, mat);
        this.dustPoints.name = 'dustMotes';
        this.atmosphereGroup.add(this.dustPoints);
    }

    _buildMistPlanes() {
        var mistCount = 4;

        for (var i = 0; i < mistCount; i++) {
            var canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            var ctx = canvas.getContext('2d');

            // soft radial gradient for mist blob
            var gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
            gradient.addColorStop(0, 'rgba(200, 210, 200, 0.25)');
            gradient.addColorStop(0.4, 'rgba(180, 200, 180, 0.12)');
            gradient.addColorStop(1, 'rgba(180, 200, 180, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);

            var tex = new THREE.CanvasTexture(canvas);

            var size = 8 + Math.random() * 12;
            var geo = new THREE.PlaneGeometry(size, size * 0.4);
            var mat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.3 + Math.random() * 0.15,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.NormalBlending
            });

            var mist = new THREE.Mesh(geo, mat);
            mist.position.set(
                (Math.random() - 0.5) * 30,
                0.3 + Math.random() * 0.7,
                (Math.random() - 0.5) * 30
            );
            mist.rotation.x = -Math.PI / 2;
            mist.rotation.z = Math.random() * Math.PI;

            mist.userData.driftX = (Math.random() - 0.5) * 0.08;
            mist.userData.driftZ = (Math.random() - 0.5) * 0.04;
            mist.userData.baseX = mist.position.x;
            mist.userData.baseZ = mist.position.z;

            this.mistPlanes.push(mist);
            this.atmosphereGroup.add(mist);
        }
    }

    _buildFallingLeaves() {
        var leafCount = 12;
        var seasonColors = COLORS[this.season] || COLORS.spring;
        var palette = seasonColors.litter;

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

        // stem vein
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(16, 4);
        ctx.lineTo(16, 28);
        ctx.stroke();

        var leafTex = new THREE.CanvasTexture(canvas);
        var leafMat = new THREE.SpriteMaterial({
            map: leafTex,
            transparent: true,
            depthWrite: false
        });

        this.fallingLeaves = [];

        for (var i = 0; i < leafCount; i++) {
            var sprite = new THREE.Sprite(leafMat.clone());
            sprite.scale.set(0.12, 0.12, 0.12);

            var c = palette[Math.floor(Math.random() * palette.length)];
            sprite.material.color.set(c);

            sprite.position.set(
                (Math.random() - 0.5) * 30,
                10 + Math.random() * 10,
                (Math.random() - 0.5) * 30
            );

            sprite.userData.vy = -0.25 - Math.random() * 0.12;
            sprite.userData.vx = (Math.random() - 0.5) * 0.15;
            sprite.userData.vz = (Math.random() - 0.5) * 0.08;
            sprite.userData.spin = (Math.random() - 0.5) * 0.02;
            sprite.userData.wobblePhase = Math.random() * Math.PI * 2;

            this.fallingLeaves.push(sprite);
            this.atmosphereGroup.add(sprite);
        }
    }


    // ---------------------------------------------------------------
    // Per-frame animation (called from the render loop)
    // ---------------------------------------------------------------

    update(dt) {
        dt = dt || 1 / 60;
        this.elapsedTime += dt;

        // dust mote drift
        if (this.dustPoints) {
            var pos = this.dustPoints.geometry.attributes.position;
            for (var i = 0; i < pos.count; i++) {
                var x = pos.getX(i);
                var y = pos.getY(i);
                var z = pos.getZ(i);

                // gentle Brownian drift with slight upward bias in sunbeams
                x += (Math.random() - 0.5) * 0.003;
                y += (Math.random() - 0.48) * 0.001; // slight upward drift
                z += (Math.random() - 0.5) * 0.003;

                // wrap around bounds
                if (Math.abs(x) > 15) x *= -0.9;
                if (y < 0.3 || y > 12) y = 0.5 + Math.random() * 10;
                if (Math.abs(z) > 15) z *= -0.9;

                pos.setX(i, x);
                pos.setY(i, y);
                pos.setZ(i, z);
            }
            pos.needsUpdate = true;
        }

        // mist plane drift
        for (var m = 0; m < this.mistPlanes.length; m++) {
            var mist = this.mistPlanes[m];
            var wave = Math.sin(this.elapsedTime * 0.15 + m * 1.7) * 3;
            mist.position.x = mist.userData.baseX + wave * mist.userData.driftX * 10;
            mist.position.z = mist.userData.baseZ + Math.cos(this.elapsedTime * 0.1 + m) * mist.userData.driftZ * 8;

            // subtle opacity pulse
            mist.material.opacity = 0.25 + Math.sin(this.elapsedTime * 0.2 + m * 2) * 0.08;
        }

        // falling leaves with realistic tumble
        for (var j = 0; j < this.fallingLeaves.length; j++) {
            var leaf = this.fallingLeaves[j];

            leaf.position.x += leaf.userData.vx * dt * 60;
            leaf.position.y += leaf.userData.vy * dt * 60;
            leaf.position.z += leaf.userData.vz * dt * 60;

            // oscillating drift (pendulum-like)
            leaf.userData.wobblePhase += dt * 2.5;
            leaf.userData.vx += Math.sin(leaf.userData.wobblePhase) * 0.003;
            leaf.userData.vx = Math.max(-0.12, Math.min(0.12, leaf.userData.vx));
            leaf.userData.vz += Math.cos(leaf.userData.wobblePhase * 0.7) * 0.001;

            // respawn at top when below ground
            var groundY = this.getTerrainHeightAt(leaf.position.x, leaf.position.z);
            if (leaf.position.y < groundY) {
                leaf.position.set(
                    (Math.random() - 0.5) * 30,
                    15 + Math.random() * 8,
                    (Math.random() - 0.5) * 30
                );
                leaf.userData.vx = (Math.random() - 0.5) * 0.15;
                leaf.userData.vz = (Math.random() - 0.5) * 0.08;
                leaf.userData.wobblePhase = Math.random() * Math.PI * 2;
            }
        }
    }


    // ---------------------------------------------------------------
    // Terrain height query (unchanged public API)
    // ---------------------------------------------------------------

    getTerrainHeightAt(x, z) {
        return terrainNoise(x, z);
    }
}
