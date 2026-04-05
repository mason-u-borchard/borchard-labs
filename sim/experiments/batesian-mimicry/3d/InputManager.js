/**
 * InputManager -- Unified input abstraction for VR controllers and desktop
 *
 * Provides a single interface for raycasting, select/grip events, and hover
 * state regardless of whether the user is on desktop (mouse + keyboard) or
 * in a WebXR session with motion controllers.
 *
 * Mason Borchard, 2026
 */

import * as THREE from 'three';


export class InputManager {

    constructor(renderer, camera, scene) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 3; // 3m interaction range per design spec

        this._selectCallbacks = [];
        this._gripCallbacks = [];
        this._interactiveObjects = [];
        this._hoverTarget = null;

        // VR controller refs -- populated when XR session starts
        this._rightController = null;
        this._leftController = null;
        this._controllerGrip = null;

        this._tempMatrix = new THREE.Matrix4();
        this._screenCenter = new THREE.Vector2(0, 0);

        this._setupDesktopListeners();
        this._setupXRControllers();
    }


    // -- Public API --------------------------------------------------------

    getInteractionRay() {
        if (this.isVR() && this._rightController) {
            this._tempMatrix.identity().extractRotation(this._rightController.matrixWorld);
            const origin = new THREE.Vector3();
            const direction = new THREE.Vector3(0, 0, -1);
            origin.setFromMatrixPosition(this._rightController.matrixWorld);
            direction.applyMatrix4(this._tempMatrix).normalize();
            return { origin, direction };
        }

        // Desktop -- ray from camera through screen center
        this.raycaster.setFromCamera(this._screenCenter, this.camera);
        return {
            origin: this.raycaster.ray.origin.clone(),
            direction: this.raycaster.ray.direction.clone()
        };
    }


    raycast(objects) {
        const ray = this.getInteractionRay();
        this.raycaster.set(ray.origin, ray.direction);
        const hits = this.raycaster.intersectObjects(objects, true);
        return hits.length > 0 ? hits[0] : null;
    }


    onSelect(callback) {
        this._selectCallbacks.push(callback);
    }


    onGrip(callback) {
        this._gripCallbacks.push(callback);
    }


    isVR() {
        return this.renderer.xr.isPresenting;
    }


    setInteractiveObjects(objects) {
        this._interactiveObjects = objects;
    }


    update() {
        this._updateHover();
    }


    // -- Desktop input -----------------------------------------------------

    _setupDesktopListeners() {
        this._onMouseDown = (e) => {
            if (this.isVR()) return;

            const hit = this._interactiveObjects.length > 0
                ? this.raycast(this._interactiveObjects)
                : null;

            if (e.shiftKey) {
                this._fireGrip(hit);
            } else {
                this._fireSelect(hit);
            }
        };

        this.renderer.domElement.addEventListener('mousedown', this._onMouseDown);
    }


    // -- XR controllers ----------------------------------------------------

    _setupXRControllers() {
        const xr = this.renderer.xr;

        // Right controller -- primary interaction hand
        this._rightController = xr.getController(0);
        this._rightController.addEventListener('selectstart', () => {
            const hit = this._interactiveObjects.length > 0
                ? this.raycast(this._interactiveObjects)
                : null;
            this._fireSelect(hit);
        });
        this._rightController.addEventListener('squeezestart', () => {
            const hit = this._interactiveObjects.length > 0
                ? this.raycast(this._interactiveObjects)
                : null;
            this._fireGrip(hit);
        });
        this.scene.add(this._rightController);

        // Left controller -- teleport/snap-turn, handled by VRControls
        this._leftController = xr.getController(1);
        this.scene.add(this._leftController);

        // Controller grip models (visual representation)
        this._controllerGrip = xr.getControllerGrip(0);
        this.scene.add(this._controllerGrip);
        const leftGrip = xr.getControllerGrip(1);
        this.scene.add(leftGrip);

        // Visual ray line for the right controller
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -3)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.name = 'controller-ray';
        line.scale.z = 1;
        this._rightController.add(line);
    }


    // -- Hover tracking ----------------------------------------------------

    _updateHover() {
        if (this._interactiveObjects.length === 0) return;

        const hit = this.raycast(this._interactiveObjects);
        const target = hit ? this._resolveInteractiveParent(hit.object) : null;

        if (target !== this._hoverTarget) {
            if (this._hoverTarget) {
                this._hoverTarget.dispatchEvent({ type: 'hoverend' });
            }
            if (target) {
                target.dispatchEvent({ type: 'hoverstart' });
            }
            this._hoverTarget = target;
        }
    }


    /**
     * Walk up the parent chain to find the root interactive object.
     * Interactive objects are those present in the _interactiveObjects array.
     */
    _resolveInteractiveParent(object) {
        let current = object;
        while (current) {
            if (this._interactiveObjects.indexOf(current) !== -1) {
                return current;
            }
            current = current.parent;
        }
        return object;
    }


    // -- Event dispatch ----------------------------------------------------

    _fireSelect(hit) {
        for (let i = 0; i < this._selectCallbacks.length; i++) {
            this._selectCallbacks[i](hit);
        }
    }

    _fireGrip(hit) {
        for (let i = 0; i < this._gripCallbacks.length; i++) {
            this._gripCallbacks[i](hit);
        }
    }


    // -- Cleanup -----------------------------------------------------------

    dispose() {
        this.renderer.domElement.removeEventListener('mousedown', this._onMouseDown);
    }
}
