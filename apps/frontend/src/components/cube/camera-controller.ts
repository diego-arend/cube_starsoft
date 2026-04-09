import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * LOD levels driven by camera distance from the scene origin:
 *   macro  – dist > 4.0   → solid cube overview
 *   nav    – 1.2 < dist ≤ 4.0 → chunk-grid navigation (262k low-res instances)
 *   micro  – dist ≤ 1.2   → up to 4 high-detail chunks, interaction enabled
 */
export type CameraMode = "macro" | "nav" | "micro";

export interface CameraState {
  mode: CameraMode;
  distance: number;
  isAnimating: boolean;
}

const LOD_MACRO_THRESHOLD = 4.0;
// Entry threshold: camera crosses into micro LOD when closer than this.
const LOD_MICRO_THRESHOLD = 1.4;
// Hard stop: OrbitControls never lets the camera go below this distance.
// Further reduced for two more zoom levels as requested.
const LOD_MICRO_MIN_DIST = 0.15;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private _mode: CameraMode = "macro";
  private _isAnimating = false;

  private animProgress = 0;
  private readonly animDuration = 0.85;
  private animFromPos = new THREE.Vector3();
  private animToPos = new THREE.Vector3();
  private animCallback: (() => void) | null = null;

  /** Emitted whenever the LOD level changes */
  onLodChanged?: (mode: CameraMode) => void;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.01, 500);
    this.camera.position.set(3.5, 2.5, 3.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    // By default, in macro mode, lock zoom so user cannot enter nav/micro freely.
    // Transition to closer LODs must be triggered via animateToFace().
    this.controls.minDistance = LOD_MACRO_THRESHOLD + 0.5;
    this.controls.maxDistance = 18;
    this.controls.target.set(0, 0, 0);
  }

  /** Temporarily unlock zoom constraints (called during/after intentional transition) */
  unlockZoom(minDist: number = LOD_MICRO_MIN_DIST): void {
    this.controls.minDistance = minDist;
  }

  /** Relock zoom to macro level */
  lockZoomToMacro(): void {
    this.controls.minDistance = LOD_MACRO_THRESHOLD + 0.5;
  }

  get mode(): CameraMode {
    return this._mode;
  }

  get isAnimating(): boolean {
    return this._isAnimating;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Smoothed programmatic fly-to with specific face alignment if requested */
  animateTo(
    targetPos: THREE.Vector3,
    onComplete?: () => void,
    alignFace: boolean = false,
  ): void {
    this.animFromPos.copy(this.camera.position);
    this.animToPos.copy(targetPos);
    this.animProgress = 0;
    this._isAnimating = true;
    this.controls.enabled = false;

    // If alignFace is true, we force ORBIT controls to disable rotation
    // and enable X/Y panning (mouse movements) to maintain frontal view.
    const setupMicroControls = () => {
      if (alignFace) {
        this.controls.enableRotate = false;
        // Map right mouse button (and touch pan) to PAN, and left mouse button to PAN as well
        // when rotation is locked to ensure intuitive X/Y movement.
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.enablePan = true;
        this.controls.screenSpacePanning = true;
      } else {
        this.controls.enableRotate = true;
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.enablePan = true;
      }
      this.controls.enabled = true;
      onComplete?.();
    };

    this.animCallback = setupMicroControls;
  }

  /** Reset controls to default macro/nav behavior */
  resetControls(): void {
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true; // Forcing screen space panning (XY axis relative to camera view)
    this.lockZoomToMacro();
  }

  update(deltaSeconds: number): void {
    if (this._isAnimating) {
      this.animProgress += deltaSeconds / this.animDuration;
      const t = easeInOutCubic(Math.min(1, this.animProgress));
      this.camera.position.lerpVectors(this.animFromPos, this.animToPos, t);
      // Ensure the camera always looks at where we are going (the chunk center)
      this.camera.lookAt(this.controls.target);

      if (this.animProgress >= 1) {
        this._isAnimating = false;
        const cb = this.animCallback;
        this.animCallback = null;
        cb?.();
      }
    } else {
      this.controls.update();
    }

    // LOD detection based on distance from the scene center.
    // Hysteresis: once in micro, the camera must travel back to LOD_MICRO_THRESHOLD
    // before switching to nav, preventing rapid oscillation at the boundary.
    const distFromTarget = this.camera.position.distanceTo(this.controls.target);
    const distFromOrigin = this.camera.position.length();

    let newMode: CameraMode;
    // We use distance from target (the face we are looking at) for micro entry
    // but distance from origin for macro overview.
    if (distFromOrigin > LOD_MACRO_THRESHOLD) {
      newMode = "macro";
    } else if (this._mode === "micro") {
      newMode = distFromTarget > LOD_MICRO_THRESHOLD ? "nav" : "micro";
    } else {
      newMode = distFromTarget < LOD_MICRO_THRESHOLD ? "micro" : "nav";
    }

    if (newMode !== this._mode) {
      this._mode = newMode;
      // If we exit micro, re-enable rotation and zoom lock
      if (newMode !== "micro") {
        this.controls.enableRotate = true;
        // Restore default mouse/touch behaviors
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };

        if (newMode === "macro") {
          this.lockZoomToMacro();
          // Reset target to origin when in macro
          this.controls.target.set(0, 0, 0); 
        }
      } else {
        // If we entered micro but not via animateTo (e.g. scroll), force PAN buttons
        this.controls.enableRotate = false;
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.touches = {
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
      }
      this.onLodChanged?.(newMode);
    }
  }

  getState(): CameraState {
    return {
      mode: this._mode,
      distance: this.controls.getDistance(),
      isAnimating: this._isAnimating,
    };
  }

  dispose(): void {
    this.controls.dispose();
  }
}
