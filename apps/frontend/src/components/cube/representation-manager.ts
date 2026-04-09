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
    this.solidGroup.visible = mode === "macro";
    this.chunkLowGroup.visible = mode === "nav" || mode === "micro";
    this.chunkHighGroup.visible = mode === "micro";
  }
}
