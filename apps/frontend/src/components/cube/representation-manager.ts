import * as THREE from "three";

export type RepresentationMode = "solid" | "face";

/**
 * Manages which representation is active.
 * - "solid": full cube visible, face/chunk groups hidden
 * - "face": solid cube hidden, face planes + ALL chunk tiles visible
 *
 * There is no longer a separate "detail" mode — chunks are always shown
 * when in face mode. Zoom level controls how many chunks are visible on screen,
 * but all tiles are built and present in the scene graph.
 */
export class RepresentationManager {
  private _mode: RepresentationMode = "solid";

  constructor(
    private readonly solidGroup: THREE.Group,
    private readonly faceGroup: THREE.Group,
    private readonly chunkGroup: THREE.Group
  ) {}

  get mode(): RepresentationMode {
    return this._mode;
  }

  forceMode(mode: RepresentationMode): void {
    this._mode = mode;
    this._applyVisibility();
  }

  private _applyVisibility(): void {
    this.solidGroup.visible = this._mode === "solid";
    // faceGroup background planes are hidden in face mode — chunks cover the entire face,
    // so showing both simultaneously causes z-fighting (interlace artifact).
    this.faceGroup.visible = false;
    this.chunkGroup.visible = this._mode === "face";
  }
}
