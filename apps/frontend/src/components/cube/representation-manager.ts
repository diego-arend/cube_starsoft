import * as THREE from "three";

export type RepresentationMode = "macro" | "nav" | "micro";

/**
 * Manages scene-group visibility based on the active LOD mode.
 *   macro  – solid cube only
 *   nav    – chunk low-detail grid (262k instances)
 *   micro  – chunk low-detail + high-detail (up to 4 chunks × 1,331 instances)
 */
export class RepresentationManager {
  private _mode: RepresentationMode = "macro";

  constructor(
    private readonly solidGroup: THREE.Group,
    private readonly chunkLowGroup: THREE.Group,
    private readonly chunkHighGroup: THREE.Group,
  ) {}

  get mode(): RepresentationMode {
    return this._mode;
  }

  forceMode(mode: RepresentationMode): void {
    this._mode = mode;
    // Solid group is always visible in macro.
    this.solidGroup.visible = mode === "macro";
    // Low group (chunk grid) is now visible in ALL modes to show the shadow simulation
    // through the semi-transparent solid cube in macro mode.
    this.chunkLowGroup.visible = true;
    this.chunkHighGroup.visible = mode === "micro";
  }
}
