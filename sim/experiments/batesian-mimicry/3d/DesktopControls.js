/**
 * DesktopControls -- First-person WASD movement and mouse look
 *
 * Wraps PointerLockControls with WASD key tracking, crouch via Shift,
 * and a click-to-lock UI prompt. Movement is relative to camera facing
 * direction and clamped to the 60x60m terrain bounds.
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';


const SPEED_NORMAL = 2.0;   // m/s
const SPEED_CROUCH = 1.0;   // m/s
const HEIGHT_STANDING = 1.65;
const HEIGHT_CROUCHING = 0.85;
const HEIGHT_LERP_RATE = 8.0;
const TERRAIN_HALF = 30;    // 60x60m area -> +/-30 from center


export class DesktopControls {

    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;

        this.controls = new PointerLockControls(camera, renderer.domElement);

        this._keys = { w: false, a: false, s: false, d: false, shift: false };
        this._velocity = new THREE.Vector3();
        this._direction = new THREE.Vector3();
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();

        this._targetHeight = HEIGHT_STANDING;
        this._enabled = false;

        // Bound handlers so we can remove them later
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);

        this._buildLockPrompt();
    }


    // -- Public API --------------------------------------------------------

    enable() {
        this._enabled = true;
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        this._showPrompt();
    }


    disable() {
        this._enabled = false;
        this.controls.unlock();
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        this._resetKeys();
        this._hidePrompt();
    }


    update(delta) {
        if (!this._enabled) return;
        if (!this.controls.isLocked) return;

        // Determine speed based on crouch state
        const speed = this._keys.shift ? SPEED_CROUCH : SPEED_NORMAL;
        this._targetHeight = this._keys.shift ? HEIGHT_CROUCHING : HEIGHT_STANDING;

        // Build movement direction from key state
        this._direction.set(0, 0, 0);

        this.camera.getWorldDirection(this._forward);
        this._forward.y = 0;
        this._forward.normalize();

        this._right.crossVectors(this._forward, this.camera.up).normalize();

        if (this._keys.w) this._direction.add(this._forward);
        if (this._keys.s) this._direction.sub(this._forward);
        if (this._keys.d) this._direction.add(this._right);
        if (this._keys.a) this._direction.sub(this._right);

        if (this._direction.lengthSq() > 0) {
            this._direction.normalize();
        }

        // Apply movement
        this._velocity.copy(this._direction).multiplyScalar(speed * delta);
        this.camera.position.x += this._velocity.x;
        this.camera.position.z += this._velocity.z;

        // Smoothly interpolate camera height
        this.camera.position.y += (this._targetHeight - this.camera.position.y) * HEIGHT_LERP_RATE * delta;

        // Clamp to terrain bounds
        this.camera.position.x = Math.max(-TERRAIN_HALF, Math.min(TERRAIN_HALF, this.camera.position.x));
        this.camera.position.z = Math.max(-TERRAIN_HALF, Math.min(TERRAIN_HALF, this.camera.position.z));
    }


    isLocked() {
        return this.controls.isLocked;
    }


    getPosition() {
        return this.camera.position.clone();
    }


    // -- Pointer lock prompt -----------------------------------------------

    _buildLockPrompt() {
        this._promptEl = document.createElement('div');
        const s = this._promptEl.style;
        s.position = 'absolute';
        s.top = '0';
        s.left = '0';
        s.width = '100%';
        s.height = '100%';
        s.display = 'none';
        s.alignItems = 'center';
        s.justifyContent = 'center';
        s.background = 'rgba(0, 0, 0, 0.55)';
        s.zIndex = '100';
        s.cursor = 'pointer';

        const label = document.createElement('span');
        label.textContent = 'Click to look around (WASD to walk, Shift to crouch)';
        const ls = label.style;
        ls.color = '#e0e0e0';
        ls.fontFamily = 'monospace';
        ls.fontSize = '16px';
        ls.padding = '16px 32px';
        ls.border = '1px solid #555';
        ls.borderRadius = '4px';
        ls.background = 'rgba(0, 0, 0, 0.7)';
        ls.textAlign = 'center';
        ls.lineHeight = '1.5';

        this._promptEl.appendChild(label);

        // Append to the renderer's parent (sim container), not document.body
        this.renderer.domElement.parentElement.appendChild(this._promptEl);

        // Click on the prompt overlay to lock the pointer
        this._promptEl.addEventListener('click', () => {
            if (!this._enabled) return;
            this.controls.lock();
        });

        // Also allow clicking on the canvas directly
        this.renderer.domElement.addEventListener('click', () => {
            if (!this._enabled || this.controls.isLocked) return;
            this._showPrompt();
        });

        // When pointer lock is acquired, hide the prompt
        this.controls.addEventListener('lock', () => {
            this._hidePrompt();
        });

        // When pointer lock is released, show the prompt again
        this.controls.addEventListener('unlock', () => {
            if (this._enabled) {
                this._resetKeys();
                this._showPrompt();
            }
        });
    }


    _showPrompt() {
        this._promptEl.style.display = 'flex';
    }

    _hidePrompt() {
        this._promptEl.style.display = 'none';
    }


    // -- Key handling ------------------------------------------------------

    _handleKeyDown(e) {
        switch (e.code) {
            case 'KeyW': this._keys.w = true; break;
            case 'KeyA': this._keys.a = true; break;
            case 'KeyS': this._keys.s = true; break;
            case 'KeyD': this._keys.d = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': this._keys.shift = true; break;
        }
    }


    _handleKeyUp(e) {
        switch (e.code) {
            case 'KeyW': this._keys.w = false; break;
            case 'KeyA': this._keys.a = false; break;
            case 'KeyS': this._keys.s = false; break;
            case 'KeyD': this._keys.d = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': this._keys.shift = false; break;
        }
    }


    _resetKeys() {
        this._keys.w = false;
        this._keys.a = false;
        this._keys.s = false;
        this._keys.d = false;
        this._keys.shift = false;
    }


    // -- Cleanup -----------------------------------------------------------

    dispose() {
        this.disable();
        if (this._promptEl && this._promptEl.parentNode) {
            this._promptEl.parentNode.removeChild(this._promptEl);
        }
        this.controls.dispose();
    }
}
