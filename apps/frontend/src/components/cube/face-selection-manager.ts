import * as THREE from "three";
import type { FaceId } from "./cube-data-model";

const FACE_NORMALS: Array<{ id: FaceId; normal: THREE.Vector3 }> = [
  { id: "+X", normal: new THREE.Vector3(1, 0, 0) },
  { id: "-X", normal: new THREE.Vector3(-1, 0, 0) },
  { id: "+Y", normal: new THREE.Vector3(0, 1, 0) },
  { id: "-Y", normal: new THREE.Vector3(0, -1, 0) },
  { id: "+Z", normal: new THREE.Vector3(0, 0, 1) },
  { id: "-Z", normal: new THREE.Vector3(0, 0, -1) },
];

/**
 * Determines which cube face is most aligned with the camera view direction.
 * The "active face" is the one whose normal is most opposite to the camera direction
 * (i.e., most facing the viewer).
 */
export class FaceSelectionManager {
  private _activeFace: FaceId = "+Z";

  get activeFace(): FaceId {
    return this._activeFace;
  }

  update(cameraDirection: THREE.Vector3): FaceId {
    // We want the face whose normal is most opposite to the camera direction
    // (camera looks -Z locally, so we find the face normal with highest dot against -direction)
    const invDir = cameraDirection.clone().negate();

    let bestDot = -Infinity;
    let bestFace: FaceId = "+Z";

    for (const { id, normal } of FACE_NORMALS) {
      const dot = invDir.dot(normal);
      if (dot > bestDot) {
        bestDot = dot;
        bestFace = id;
      }
    }

    this._activeFace = bestFace;
    return this._activeFace;
  }
}
