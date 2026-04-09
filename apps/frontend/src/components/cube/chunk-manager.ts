import * as THREE from "three";
import {
  type FaceId,
  type TileDescriptor,
  getAllTilesForFace,
  tileKey,
  TILE_SIZE,
  SQUARES_PER_SIDE,
} from "./cube-data-model";

const CUBE_HALF = 1;

// ─── World-space dimensions (exported so scene-controller can reuse) ──────────
export const TILE_WORLD_SIZE = (TILE_SIZE / SQUARES_PER_SIDE) * CUBE_HALF * 2;
export const SQUARE_STEP     = TILE_WORLD_SIZE / TILE_SIZE;
export const SQUARE_SIZE     = SQUARE_STEP * 0.82;   // 18 % gap between cubes
export const CUBE_DEPTH      = SQUARE_SIZE * 0.5;    // depth = half of face width

const FACE_NORMALS: Record<FaceId, THREE.Vector3> = {
  "+X": new THREE.Vector3(1, 0, 0),
  "-X": new THREE.Vector3(-1, 0, 0),
  "+Y": new THREE.Vector3(0, 1, 0),
  "-Y": new THREE.Vector3(0, -1, 0),
  "+Z": new THREE.Vector3(0, 0, 1),
  "-Z": new THREE.Vector3(0, 0, -1),
};

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
      return { position: new THREE.Vector3(CUBE_HALF, ny * CUBE_HALF, -nx * CUBE_HALF), rotation: new THREE.Euler(0, Math.PI / 2, 0) };
    case "-X":
      return { position: new THREE.Vector3(-CUBE_HALF, ny * CUBE_HALF, nx * CUBE_HALF), rotation: new THREE.Euler(0, -Math.PI / 2, 0) };
    case "+Y":
      return { position: new THREE.Vector3(nx * CUBE_HALF, CUBE_HALF, ny * CUBE_HALF), rotation: new THREE.Euler(-Math.PI / 2, 0, 0) };
    case "-Y":
      return { position: new THREE.Vector3(nx * CUBE_HALF, -CUBE_HALF, -ny * CUBE_HALF), rotation: new THREE.Euler(Math.PI / 2, 0, 0) };
    case "+Z":
      return { position: new THREE.Vector3(nx * CUBE_HALF, ny * CUBE_HALF, CUBE_HALF), rotation: new THREE.Euler(0, 0, 0) };
    case "-Z":
    default:
      return { position: new THREE.Vector3(-nx * CUBE_HALF, ny * CUBE_HALF, -CUBE_HALF), rotation: new THREE.Euler(0, Math.PI, 0) };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TileCacheEntry {
  group: THREE.Group;
  instanced: THREE.InstancedMesh;
}

interface HideAnimation {
  instanced: THREE.InstancedMesh;
  idx: number;
  progress: number; // 0 → 1 over HIDE_DURATION seconds
  startMatrix: THREE.Matrix4;
}

export interface RemovedSquare {
  tileKey: string;
  tileX: number;
  tileY: number;
  face: FaceId;
  col: number;
  row: number;
}

const HIDE_DURATION = 0.3; // seconds
const COLOR_A = new THREE.Color(0xa0aab8);
const COLOR_B = new THREE.Color(0x8a94a0);

// ─── ChunkManager ─────────────────────────────────────────────────────────────

export class ChunkManager {
  private readonly group: THREE.Group;
  private readonly cache = new Map<string, TileCacheEntry>();
  private currentFace: FaceId | null = null;

  /** Removed squares: tileKey → Set<col * TILE_SIZE + row> */
  private readonly _removed = new Map<string, Set<number>>();
  /** Active hide animations */
  private readonly _hiding = new Map<string, HideAnimation>();

  private readonly _sharedGeo: THREE.BoxGeometry;
  private readonly _sharedMat: THREE.MeshPhongMaterial;

  constructor(group: THREE.Group) {
    this.group = group;
    this._sharedGeo = new THREE.BoxGeometry(SQUARE_SIZE, SQUARE_SIZE, CUBE_DEPTH);
    this._sharedMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 30,
      specular: new THREE.Color(0x444444),
    });
  }

  get currentFaceId(): FaceId | null {
    return this.currentFace;
  }

  updateFace(face: FaceId): void {
    if (this.currentFace === face) return;
    this._clearGroup();
    this.currentFace = face;
    this._buildFace(face);
  }

  /** Called every render frame to advance hide animations. */
  update(dt: number): void {
    if (this._hiding.size === 0) return;

    const dummy = new THREE.Object3D();
    for (const [key, anim] of this._hiding) {
      anim.progress = Math.min(1, anim.progress + dt / HIDE_DURATION);
      const t = 1 - anim.progress; // 1 → 0
      const eased = t * t;

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      anim.startMatrix.decompose(pos, quat, scale);

      // Sink into face surface (-z) while shrinking
      pos.z -= (1 - eased) * CUBE_DEPTH * 4;
      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.set(eased, eased, eased);
      dummy.updateMatrix();

      anim.instanced.setMatrixAt(anim.idx, dummy.matrix);
      anim.instanced.instanceMatrix.needsUpdate = true;

      if (anim.progress >= 1) {
        this._hiding.delete(key);
      }
    }
  }

  /** Hide (animate out and remove) a single square inside a tile. */
  hideSquare(tileName: string, col: number, row: number): void {
    const entry = this.cache.get(tileName);
    if (!entry) return;
    const idx = row * TILE_SIZE + col;
    const animKey = `${tileName}:${col}:${row}`;
    if (this._hiding.has(animKey)) return;

    if (!this._removed.has(tileName)) this._removed.set(tileName, new Set());
    this._removed.get(tileName)!.add(idx);

    const startM = new THREE.Matrix4();
    entry.instanced.getMatrixAt(idx, startM);
    this._hiding.set(animKey, {
      instanced: entry.instanced,
      idx,
      progress: 0,
      startMatrix: startM.clone(),
    });
  }

  /** All removed squares for a given face (for building dark spots on solid cube). */
  getRemovedSquares(face: FaceId): RemovedSquare[] {
    const result: RemovedSquare[] = [];
    for (const tile of getAllTilesForFace(face)) {
      const key = tileKey(tile);
      const removedSet = this._removed.get(key);
      if (!removedSet) continue;
      for (const idx of removedSet) {
        const col = idx % TILE_SIZE;
        const row = Math.floor(idx / TILE_SIZE);
        result.push({ tileKey: key, tileX: tile.tileX, tileY: tile.tileY, face, col, row });
      }
    }
    return result;
  }

  /** Access cached tile group for world-space transforms (dark spots). */
  getTileGroup(key: string): TileCacheEntry | undefined {
    return this.cache.get(key);
  }

  private _buildFace(face: FaceId): void {
    const tiles = getAllTilesForFace(face);

    for (const tile of tiles) {
      const key = tileKey(tile);

      if (this.cache.has(key)) {
        const entry = this.cache.get(key)!;
        this.group.add(entry.group);
        // Re-apply removed squares as invisible (scale 0)
        const removedSet = this._removed.get(key);
        if (removedSet) {
          const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
          for (const idx of removedSet) {
            const col = idx % TILE_SIZE;
            const row = Math.floor(idx / TILE_SIZE);
            if (!this._hiding.has(`${key}:${col}:${row}`)) {
              entry.instanced.setMatrixAt(idx, zeroMatrix);
            }
          }
          entry.instanced.instanceMatrix.needsUpdate = true;
        }
        continue;
      }

      // Build new InstancedMesh for this tile
      const instanced = new THREE.InstancedMesh(
        this._sharedGeo,
        this._sharedMat,
        TILE_SIZE * TILE_SIZE
      );
      instanced.castShadow = false;
      instanced.receiveShadow = false;

      const dummy = new THREE.Object3D();
      const half = TILE_WORLD_SIZE / 2;

      for (let row = 0; row < TILE_SIZE; row++) {
        for (let col = 0; col < TILE_SIZE; col++) {
          const idx = row * TILE_SIZE + col;
          dummy.position.set(
            -half + (col + 0.5) * SQUARE_STEP,
            -half + (row + 0.5) * SQUARE_STEP,
            CUBE_DEPTH / 2   // float above face surface
          );
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          instanced.setMatrixAt(idx, dummy.matrix);
          instanced.setColorAt(idx, COLOR_A);
        }
      }

      instanced.instanceMatrix.needsUpdate = true;
      instanced.instanceColor!.needsUpdate = true;
      instanced.userData.tileKey = key;

      const tileGroup = new THREE.Group();
      tileGroup.name = key;
      tileGroup.add(instanced);

      const { position, rotation } = tileToTransform(tile);
      tileGroup.position.copy(position);
      tileGroup.rotation.copy(rotation);
      tileGroup.position.addScaledVector(FACE_NORMALS[tile.face], 0.002);

      this.cache.set(key, { group: tileGroup, instanced });
      this.group.add(tileGroup);
    }
  }

  private _clearGroup(): void {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]!);
    }
  }

  dispose(): void {
    this._clearGroup();
    this._sharedGeo.dispose();
    this._sharedMat.dispose();
    this.cache.clear();
  }
}
