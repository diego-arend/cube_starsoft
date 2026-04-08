import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type CameraMode = "cube" | "face";

export interface CameraState {
  mode: CameraMode;
  distance: number;
  isAnimating: boolean;
  direction: THREE.Vector3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private _mode: CameraMode = "cube";
  private _isAnimating = false;
  private _faceFitDist = 3.2;
  /** Minimum camera-to-face-surface distance (= max zoom, 8 chunks visible) */
  private _faceMinDist = 0.1;
  /** Normal of the currently active face */
  private _faceNormal = new THREE.Vector3(0, 0, 1);
  /** Tangent right-vector on the face plane (for panning) */
  private _faceTangentX = new THREE.Vector3(1, 0, 0);
  /** Tangent up-vector on the face plane (for panning) */
  private _faceTangentY = new THREE.Vector3(0, 1, 0);

  private animProgress = 0;
  private readonly animDuration = 0.85;
  private animFromPos = new THREE.Vector3();
  private animFromTarget = new THREE.Vector3();
  private animToPos = new THREE.Vector3();
  private animToTarget = new THREE.Vector3();
  private animCallback: (() => void) | null = null;

  private readonly CUBE_MIN_DIST = 2.5;
  private readonly CUBE_MAX_DIST = 18;
  /** Multiplicative zoom step per wheel tick in face mode */
  private readonly FACE_ZOOM_FACTOR = 1.12;

  onBackToCubeRequested?: () => void;

  private readonly _canvas: HTMLCanvasElement;
  private readonly _boundWheel: (e: WheelEvent) => void;
  private readonly _boundMouseDown: (e: MouseEvent) => void;
  private readonly _boundMouseMove: (e: MouseEvent) => void;
  private readonly _boundMouseUp: (e: MouseEvent) => void;

  /** Pan drag state */
  private _isPanning = false;
  private _panLastX = 0;
  private _panLastY = 0;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this._canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.01, 500);
    this.camera.position.set(2.8, 2.0, 2.8);

    // Register face-mode listeners BEFORE OrbitControls so stopImmediatePropagation works.
    this._boundWheel = this._onWheel.bind(this);
    this._boundMouseDown = this._onMouseDown.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    canvas.addEventListener("wheel", this._boundWheel, { passive: false });
    canvas.addEventListener("mousedown", this._boundMouseDown);
    canvas.addEventListener("mousemove", this._boundMouseMove);
    canvas.addEventListener("mouseup", this._boundMouseUp);
    canvas.addEventListener("mouseleave", this._boundMouseUp);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minDistance = this.CUBE_MIN_DIST;
    this.controls.maxDistance = this.CUBE_MAX_DIST;
    this.controls.target.set(0, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _computeFaceFitDist(): number {
    const vHalfRad = (this.camera.fov * Math.PI) / 180 / 2;
    const hHalfRad = Math.atan(Math.tan(vHalfRad) * this.camera.aspect);
    const distFromFaceV = 1 / Math.tan(vHalfRad);
    const distFromFaceH = 1 / Math.tan(hHalfRad);
    return 1 + Math.max(distFromFaceV, distFromFaceH) * 1.08;
  }

  /** Max zoom = 4 chunks (~2×2) filling the screen */
  private _computeFaceMinDist(): number {
    const tileWorldSize = (32 / 707) * 2;
    // 0.75 tiles per half-width → ≈4 total chunks at max zoom in 16:9 landscape
    const tileHalf = 0.75 * tileWorldSize;
    const vHalfRad = (this.camera.fov * Math.PI) / 180 / 2;
    const hHalfRad = Math.atan(Math.tan(vHalfRad) * this.camera.aspect);
    const distV = tileHalf / Math.tan(vHalfRad);
    const distH = tileHalf / Math.tan(hHalfRad);
    return Math.max(distV, distH);
  }

  /** Build orthonormal tangent basis vectors for the current face normal */
  private _computeFaceTangents(): void {
    const n = this._faceNormal;
    const worldUp =
      Math.abs(n.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    this._faceTangentX.crossVectors(worldUp, n).normalize();
    this._faceTangentY.crossVectors(n, this._faceTangentX).normalize();
  }

  /** Current perpendicular distance from camera to face surface */
  private _distToFace(): number {
    return Math.max(0.001, this.camera.position.dot(this._faceNormal) - 1);
  }

  // ---------------------------------------------------------------------------
  // Face-mode event handlers
  // ---------------------------------------------------------------------------

  private _onWheel(e: WheelEvent): void {
    if (this._mode !== "face" || this._isAnimating) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const dist = this._distToFace();
    const maxDist = this._faceFitDist - 1;
    const zoomOut = e.deltaY > 0;

    // At full-face distance, zoom out → back to cube
    if (zoomOut && dist >= maxDist * 0.95) {
      this.onBackToCubeRequested?.();
      return;
    }

    const factor = zoomOut ? this.FACE_ZOOM_FACTOR : 1 / this.FACE_ZOOM_FACTOR;
    const newDist = Math.min(
      maxDist,
      Math.max(this._faceMinDist, dist * factor)
    );
    if (Math.abs(newDist - dist) < 1e-6) return;

    // Move camera along face normal, target stays fixed
    this.camera.position.copy(
      this.controls.target.clone().addScaledVector(this._faceNormal, newDist)
    );
    this.camera.lookAt(this.controls.target);
  }

  private _onMouseDown(e: MouseEvent): void {
    if (this._mode !== "face" || this._isAnimating) return;
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    this._isPanning = true;
    this._panLastX = e.clientX;
    this._panLastY = e.clientY;
  }

  private _onMouseMove(e: MouseEvent): void {
    if (!this._isPanning) return;
    if (this._mode !== "face" || this._isAnimating) {
      this._isPanning = false;
      return;
    }
    e.stopImmediatePropagation();

    const dx = e.clientX - this._panLastX;
    const dy = e.clientY - this._panLastY;
    this._panLastX = e.clientX;
    this._panLastY = e.clientY;

    // Pixels → world units at current zoom distance
    const dist = this._distToFace();
    const vHalfRad = (this.camera.fov * Math.PI) / 180 / 2;
    const worldHeight = 2 * dist * Math.tan(vHalfRad);
    const scale = worldHeight / this._canvas.clientHeight;

    // Pan in face-plane tangent space (screen X → tangentX, screen Y → -tangentY)
    const delta = this._faceTangentX
      .clone()
      .multiplyScalar(-dx * scale)
      .addScaledVector(this._faceTangentY, dy * scale);

    const newTarget = this.controls.target.clone().add(delta);

    // Clamp target to face boundary [-1, 1] in tangential directions
    const normalComp = this._faceNormal
      .clone()
      .multiplyScalar(newTarget.dot(this._faceNormal));
    const tangential = newTarget.clone().sub(normalComp);
    tangential.x = Math.max(-1, Math.min(1, tangential.x));
    tangential.y = Math.max(-1, Math.min(1, tangential.y));
    tangential.z = Math.max(-1, Math.min(1, tangential.z));
    newTarget.copy(tangential).add(normalComp);

    this.controls.target.copy(newTarget);
    this.camera.position.copy(
      newTarget.clone().addScaledVector(this._faceNormal, dist)
    );
    this.camera.lookAt(newTarget);
  }

  private _onMouseUp(_e: MouseEvent): void {
    this._isPanning = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get mode(): CameraMode {
    return this._mode;
  }

  get isAnimating(): boolean {
    return this._isAnimating;
  }

  get faceNormal(): THREE.Vector3 {
    return this._faceNormal;
  }

  get faceFitDist(): number {
    return this._faceFitDist;
  }

  animateToFace(faceNormal: THREE.Vector3, onComplete?: () => void): void {
    this._faceNormal = faceNormal.clone().normalize();
    this._faceFitDist = this._computeFaceFitDist();
    this._computeFaceTangents();

    this.animFromPos.copy(this.camera.position);
    this.animFromTarget.copy(this.controls.target);
    this.animToPos.copy(faceNormal).multiplyScalar(this._faceFitDist);
    // Target must land ON the face surface (faceNormal * 1), not at origin.
    // If target stays at (0,0,0), zoom formula "target + faceNormal * dist" places
    // the camera inside the cube (e.g., z=0.16 instead of z=1.16 for +Z face).
    this.animToTarget.copy(faceNormal).normalize();
    this.animProgress = 0;
    this._isAnimating = true;
    this.controls.enabled = false;

    this.animCallback = () => {
      this._mode = "face";
      this._faceMinDist = this._computeFaceMinDist();
      // Snap camera up to the face tangent Y so the face is axis-aligned
      // before chunks are rendered. This corrects any tilt inherited from
      // OrbitControls rotation in cube mode.
      this.camera.up.copy(this._faceTangentY);
      this.camera.lookAt(this.controls.target);
      // controls remain disabled — all camera movement in face mode is manual
      onComplete?.();
    };
  }

  animateToCube(onComplete?: () => void): void {
    this._isPanning = false;
    this.animFromPos.copy(this.camera.position);
    this.animFromTarget.copy(this.controls.target);
    this.animToPos.set(2.8, 2.0, 2.8);
    this.animToTarget.set(0, 0, 0);
    this.animProgress = 0;
    this._isAnimating = true;
    this.controls.enabled = false;

    this.animCallback = () => {
      this._mode = "cube";
      // Restore world-up so OrbitControls behaves normally
      this.camera.up.set(0, 1, 0);
      this.controls.enabled = true;
      this.controls.enableRotate = true;
      this.controls.enableZoom = false;
      this.controls.minDistance = this.CUBE_MIN_DIST;
      this.controls.maxDistance = this.CUBE_MAX_DIST;
      this.controls.target.set(0, 0, 0);
      onComplete?.();
    };
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this._mode === "face" && !this._isAnimating) {
      this._faceFitDist = this._computeFaceFitDist();
      this._faceMinDist = this._computeFaceMinDist();
    }
  }

  update(deltaSeconds: number): void {
    if (this._isAnimating) {
      this.animProgress += deltaSeconds / this.animDuration;
      const t = easeInOutCubic(Math.min(1, this.animProgress));
      this.camera.position.lerpVectors(this.animFromPos, this.animToPos, t);
      this.controls.target.lerpVectors(
        this.animFromTarget,
        this.animToTarget,
        t
      );
      this.camera.lookAt(this.controls.target);

      if (this.animProgress >= 1) {
        this._isAnimating = false;
        const cb = this.animCallback;
        this.animCallback = null;
        cb?.();
      }
    } else if (this._mode === "cube") {
      this.controls.update();
    }
  }

  getState(): CameraState {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return {
      mode: this._mode,
      distance: this.controls.getDistance(),
      isAnimating: this._isAnimating,
      direction: dir,
    };
  }

  dispose(): void {
    this._canvas.removeEventListener("wheel", this._boundWheel);
    this._canvas.removeEventListener("mousedown", this._boundMouseDown);
    this._canvas.removeEventListener("mousemove", this._boundMouseMove);
    this._canvas.removeEventListener("mouseup", this._boundMouseUp);
    this._canvas.removeEventListener("mouseleave", this._boundMouseUp);
    this.controls.dispose();
  }
}
