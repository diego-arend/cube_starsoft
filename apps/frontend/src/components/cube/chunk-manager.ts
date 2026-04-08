import * as THREE from "three";
import {
  type FaceId,
  type TileDescriptor,
  getAllTilesForFace,
  tileKey,
  TILE_SIZE,
  SQUARES_PER_SIDE,
} from "./cube-data-model";

const CUBE_HALF = 1; // cube goes from -1 to +1

const FACE_NORMALS: Record<FaceId, THREE.Vector3> = {
  "+X": new THREE.Vector3(1, 0, 0),
  "-X": new THREE.Vector3(-1, 0, 0),
  "+Y": new THREE.Vector3(0, 1, 0),
  "-Y": new THREE.Vector3(0, -1, 0),
  "+Z": new THREE.Vector3(0, 0, 1),
  "-Z": new THREE.Vector3(0, 0, -1),
};

/** Maps FaceId to the axis/sign used when placing tiles in 3D */
function tileToTransform(tile: TileDescriptor): {
  position: THREE.Vector3;
  rotation: THREE.Euler;
} {
  const uvX = (tile.tileX + 0.5) / (SQUARES_PER_SIDE / TILE_SIZE);
  const uvY = (tile.tileY + 0.5) / (SQUARES_PER_SIDE / TILE_SIZE);
  const nx = uvX * 2 - 1;
  const ny = uvY * 2 - 1;

  switch (tile.face) {
    case "+X":
      return {
        position: new THREE.Vector3(CUBE_HALF, ny * CUBE_HALF, -nx * CUBE_HALF),
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
      };
    case "-X":
      return {
        position: new THREE.Vector3(-CUBE_HALF, ny * CUBE_HALF, nx * CUBE_HALF),
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      };
    case "+Y":
      return {
        position: new THREE.Vector3(nx * CUBE_HALF, CUBE_HALF, ny * CUBE_HALF),
        rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      };
    case "-Y":
      return {
        position: new THREE.Vector3(nx * CUBE_HALF, -CUBE_HALF, -ny * CUBE_HALF),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      };
    case "+Z":
      return {
        position: new THREE.Vector3(nx * CUBE_HALF, ny * CUBE_HALF, CUBE_HALF),
        rotation: new THREE.Euler(0, 0, 0),
      };
    case "-Z":
    default:
      return {
        position: new THREE.Vector3(-nx * CUBE_HALF, ny * CUBE_HALF, -CUBE_HALF),
        rotation: new THREE.Euler(0, Math.PI, 0),
      };
  }
}

/**
 * Builds a lightweight grid LineSegments for a tile.
 * Draws TILE_SIZE+1 horizontal and TILE_SIZE+1 vertical lines,
 * representing the borders of each individual square.
 * Total: (TILE_SIZE+1)*2 line segments = 66 lines for TILE_SIZE=32.
 */
function buildGridLines(scaleXY: number): THREE.LineSegments {
  const half = scaleXY / 2;
  const step = scaleXY / TILE_SIZE;
  const positions: number[] = [];

  // Horizontal lines
  for (let i = 0; i <= TILE_SIZE; i++) {
    const y = -half + i * step;
    positions.push(-half, y, 0, half, y, 0);
  }
  // Vertical lines
  for (let i = 0; i <= TILE_SIZE; i++) {
    const x = -half + i * step;
    positions.push(x, -half, 0, x, half, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: 0.25,
    transparent: true,
  });
  return new THREE.LineSegments(geo, mat);
}

/**
 * Manages the creation, caching, and disposal of 2D chunk groups
 * for the active cube face.
 * Each group contains: a solid colored Mesh + a grid LineSegments overlay.
 */
export class ChunkManager {
  private readonly group: THREE.Group;
  private readonly cache = new Map<string, THREE.Group>();
  private currentFace: FaceId | null = null;

  constructor(group: THREE.Group) {
    this.group = group;
  }

  updateFace(face: FaceId): void {
    if (this.currentFace === face) return;
    this._clearGroup();
    this.currentFace = face;
    this._buildFace(face);
  }

  private _buildFace(face: FaceId): void {
    const tiles = getAllTilesForFace(face);
    const scaleXY = (TILE_SIZE / SQUARES_PER_SIDE) * CUBE_HALF * 2;

    for (const tile of tiles) {
      const key = tileKey(tile);
      if (this.cache.has(key)) {
        this.group.add(this.cache.get(key)!);
        continue;
      }

      // Solid colored quad for the tile
      const geometry = new THREE.PlaneGeometry(scaleXY * 0.9998, scaleXY * 0.9998);
      const material = new THREE.MeshBasicMaterial({
        color: this._tileColor(tile),
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Grid lines overlay — pushed slightly above the tile mesh to avoid z-fighting
      const gridLines = buildGridLines(scaleXY);
      gridLines.position.z = 0.0005;

      const tileGroup = new THREE.Group();
      tileGroup.add(mesh, gridLines);

      const { position, rotation } = tileToTransform(tile);
      tileGroup.position.copy(position);
      tileGroup.rotation.copy(rotation);

      // Push slightly in front of the face to avoid z-fighting
      tileGroup.position.addScaledVector(FACE_NORMALS[tile.face], 0.002);

      this.cache.set(key, tileGroup);
      this.group.add(tileGroup);
    }
  }

  private _tileColor(tile: TileDescriptor): number {
    const checker = (tile.tileX + tile.tileY) % 2 === 0;
    const faceColors: Record<FaceId, [number, number]> = {
      "+X": [0x4a90d9, 0x2c6fa8],
      "-X": [0x5ba854, 0x3a7a35],
      "+Y": [0xe8a838, 0xc4841a],
      "-Y": [0xe05c5c, 0xb83535],
      "+Z": [0x8e5ce8, 0x6a3cc4],
      "-Z": [0x50bfa0, 0x2d9b80],
    };
    const [a, b] = faceColors[tile.face];
    return checker ? a : b;
  }

  private _clearGroup(): void {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }

  dispose(): void {
    this._clearGroup();
    for (const tileGroup of this.cache.values()) {
      for (const child of tileGroup.children) {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.LineSegments
        ) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }
    }
    this.cache.clear();
  }
}
