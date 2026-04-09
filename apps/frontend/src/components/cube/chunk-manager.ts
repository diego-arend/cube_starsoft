import * as THREE from "three";
import {
  type ChunkCoord,
  GRID_SIZE,
  TOTAL_CHUNKS,
  CUBES_PER_CHUNK,
  CHUNK_SIZE,
  CHUNK_WORLD_SIZE,
  CHUNK_NAV_SIZE,
  MINI_CUBE_STEP,
  MINI_CUBE_SIZE,
  MINI_CUBE_DEPTH,
  chunkFromIndex,
  chunkWorldCenter,
  chunkKey,
  chunkIndex,
} from "./cube-data-model";
import { type CameraMode } from "./camera-controller";

const HIDE_DURATION = 0.3; // seconds
const MAX_HIGH_CHUNKS = 4;
const HIGH_EVICTION_FRAMES = 60;

const COLOR_NAV    = new THREE.Color(0xa0aab8);
const COLOR_HIGH_A = new THREE.Color(0xa0aab8);
const COLOR_HIGH_B = new THREE.Color(0x8a94a0);
const COLOR_REMOVED = new THREE.Color(0x4b5563);

// ─── Internal types ───────────────────────────────────────────────────────────

interface HideAnimation {
  instanced: THREE.InstancedMesh;
  idx: number;
  progress: number; // 0 → 1 over HIDE_DURATION
  startMatrix: THREE.Matrix4;
}

// ─── ChunkManager ─────────────────────────────────────────────────────────────

export class ChunkManager {
  /** Low-detail group: 1 InstancedMesh with 262k instances (one per chunk) */
  readonly lowGroup = new THREE.Group();
  /** High-detail group: up to MAX_HIGH_CHUNKS InstancedMeshes × 1,331 instances */
  readonly highGroup = new THREE.Group();

  private _lowMesh: THREE.InstancedMesh | null = null;
  private readonly _lowGeo: THREE.BoxGeometry;
  private readonly _lowMat: THREE.MeshPhongMaterial;

  private readonly _highGeo: THREE.BoxGeometry;
  private readonly _highMat: THREE.MeshPhongMaterial;

  /** Per-chunk high-detail InstancedMesh cache */
  private readonly _highCache = new Map<string, THREE.InstancedMesh>();
  /** Frames-since-last-visible for eviction */
  private readonly _highTtl = new Map<string, number>();

  /** Removed mini-cube indices: chunkKey → Set<cubeIdx> (persists across LOD) */
  private readonly _removed = new Map<string, Set<number>>();
  /** Active sink/shrink animations */
  private readonly _hiding = new Map<string, HideAnimation>();

  /** 
   * Ratio of removed cubes required to mark a chunk as "shadowed" in macro view.
   * If > 20% of a chunk's surface area (roughly) is gone, we darken the macro overview.
   */
  private readonly SHADOW_THRESHOLD = CUBES_PER_CHUNK * 0.05;

  constructor() {
    this._lowGeo = new THREE.BoxGeometry(CHUNK_NAV_SIZE, CHUNK_NAV_SIZE, CHUNK_NAV_SIZE);
    this._lowMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 30,
      specular: new THREE.Color(0x333333),
    });

    this._highGeo = new THREE.BoxGeometry(MINI_CUBE_SIZE, MINI_CUBE_SIZE, MINI_CUBE_DEPTH);
    this._highMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 30,
      specular: new THREE.Color(0x444444),
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Builds (once, lazily) the 262k-instance low-detail InstancedMesh.
   * Called automatically when entering nav/micro LOD.
   */
  buildLowMesh(): void {
    if (this._lowMesh) return;

    const mesh = new THREE.InstancedMesh(this._lowGeo, this._lowMat, TOTAL_CHUNKS);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.isLowLod = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < TOTAL_CHUNKS; i++) {
      const coord = chunkFromIndex(i);
      const [wx, wy, wz] = chunkWorldCenter(coord);
      dummy.position.set(wx, wy, wz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, COLOR_NAV);
    }
    // Re-apply removed-chunk darkening from persisted state
    for (const [key] of this._removed) {
      const coord = this._coordFromKey(key);
      if (coord) {
        const idx = chunkIndex(coord);
        mesh.setColorAt(idx, COLOR_REMOVED);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    this._lowMesh = mesh;
    this.lowGroup.add(mesh);
  }

  /** Returns active high-detail InstancedMeshes for raycasting */
  getHighMeshes(): THREE.InstancedMesh[] {
    return [...this._highCache.values()];
  }

  /**
   * Called each frame to maintain correct LOD state.
   * - nav:   ensures low mesh exists; clears high meshes
   * - micro: builds/evicts high-detail chunks near the camera
   * - macro: clears everything (solid cube takes over)
   */
  updateLod(mode: CameraMode, camera: THREE.PerspectiveCamera): void {
    // buildLowMesh is now required for ALL modes to maintain shadow state
    this.buildLowMesh();

    if (mode === "micro") {
      const visible = this._getNearestChunks(camera, MAX_HIGH_CHUNKS);
      const visibleKeys = new Set(visible.map(chunkKey));

      for (const coord of visible) {
        const key = chunkKey(coord);
        this._highTtl.set(key, 0);
        if (!this._highCache.has(key)) {
          this._buildHighMesh(coord);
        }
      }

      for (const [key, frames] of this._highTtl) {
        if (visibleKeys.has(key)) {
          this._highTtl.set(key, 0);
        } else {
          const next = frames + 1;
          this._highTtl.set(key, next);
          if (next > HIGH_EVICTION_FRAMES) {
            this._evictHighMesh(key);
          }
        }
      }
    } else {
      for (const key of [...this._highCache.keys()]) {
        this._evictHighMesh(key);
      }
    }
  }

  /** Start the sink-and-shrink animation for a mini-cube inside a chunk */
  hideCube(cKey: string, cubeIdx: number): void {
    const mesh = this._highCache.get(cKey);
    if (!mesh) return;

    const animKey = `${cKey}:${cubeIdx}`;
    if (this._hiding.has(animKey)) return;

    const removedSet = this._removed.get(cKey) || new Set();
    if (!this._removed.has(cKey)) this._removed.set(cKey, removedSet);
    removedSet.add(cubeIdx);

    // If chunk passes the shadow threshold, mark it for the solid cube "simulation"
    if (this._lowMesh && removedSet.size > this.SHADOW_THRESHOLD) {
      const coord = this._coordFromKey(cKey);
      if (coord) {
        const idx = chunkIndex(coord);
        this._lowMesh.setColorAt(idx, COLOR_REMOVED);
        this._lowMesh.instanceColor!.needsUpdate = true;
      }
    }

    const startM = new THREE.Matrix4();
    mesh.getMatrixAt(cubeIdx, startM);
    this._hiding.set(animKey, {
      instanced: mesh,
      idx: cubeIdx,
      progress: 0,
      startMatrix: startM.clone(),
    });

    // Mark the chunk darker on the low-detail mesh for macro/nav feedback
    if (this._lowMesh) {
      const coord = this._coordFromKey(cKey);
      if (coord) {
        const lowIdx = chunkIndex(coord);
        this._lowMesh.setColorAt(lowIdx, COLOR_REMOVED);
        this._lowMesh.instanceColor!.needsUpdate = true;
      }
    }
  }

  /** Advance all hide animations. Must be called every frame. */
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

      pos.z -= (1 - eased) * MINI_CUBE_SIZE * 2;
      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.setScalar(eased);
      dummy.updateMatrix();

      anim.instanced.setMatrixAt(anim.idx, dummy.matrix);
      anim.instanced.instanceMatrix.needsUpdate = true;

      if (anim.progress >= 1) {
        // When animation finishes, set scale to exactly 0 to ensure it's not raycasted
        const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
        anim.instanced.setMatrixAt(anim.idx, zeroM);
        anim.instanced.instanceMatrix.needsUpdate = true;
        this._hiding.delete(key);
      }
    }
  }

  dispose(): void {
    for (const key of [...this._highCache.keys()]) this._evictHighMesh(key);
    while (this.lowGroup.children.length > 0) {
      this.lowGroup.remove(this.lowGroup.children[0]!);
    }
    this._lowMesh = null;
    this._lowGeo.dispose();
    this._lowMat.dispose();
    this._highGeo.dispose();
    this._highMat.dispose();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _buildHighMesh(coord: ChunkCoord): void {
    const key = chunkKey(coord);
    const mesh = new THREE.InstancedMesh(this._highGeo, this._highMat, CUBES_PER_CHUNK);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.chunkKey = key;
    mesh.userData.isHighLod = true;

    const dummy = new THREE.Object3D();
    const half = (CHUNK_SIZE * MINI_CUBE_STEP) / 2;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const idx = lz * CHUNK_SIZE * CHUNK_SIZE + ly * CHUNK_SIZE + lx;
          dummy.position.set(
            -half + (lx + 0.5) * MINI_CUBE_STEP,
            -half + (ly + 0.5) * MINI_CUBE_STEP,
            -half + (lz + 0.5) * MINI_CUBE_STEP,
          );
          dummy.scale.setScalar(1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx, dummy.matrix);
          const color = (lx + ly + lz) % 2 === 0 ? COLOR_HIGH_A : COLOR_HIGH_B;
          mesh.setColorAt(idx, color);
        }
      }
    }

    // Re-apply removed cubes as invisible (scale 0)
    const removedSet = this._removed.get(key);
    if (removedSet) {
      const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
      for (const idx of removedSet) {
        if (!this._hiding.has(`${key}:${idx}`)) {
          mesh.setMatrixAt(idx, zeroM);
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    const [wx, wy, wz] = chunkWorldCenter(coord);
    mesh.position.set(wx, wy, wz);

    this._highCache.set(key, mesh);
    this._highTtl.set(key, 0);
    this.highGroup.add(mesh);
  }

  private _evictHighMesh(key: string): void {
    const mesh = this._highCache.get(key);
    if (!mesh) return;
    // Cancel active animations referencing this mesh
    for (const animKey of [...this._hiding.keys()]) {
      if (animKey.startsWith(`${key}:`)) this._hiding.delete(animKey);
    }
    this.highGroup.remove(mesh);
    this._highCache.delete(key);
    this._highTtl.delete(key);
  }

  /**
   * Returns the `count` chunks closest to the camera.
   * Searches a 5×5×5 neighborhood in chunk grid space around the camera position.
   */
  private _getNearestChunks(camera: THREE.PerspectiveCamera, count: number): ChunkCoord[] {
    const pos = camera.position;
    const toCi = (v: number) => Math.floor((v + 1) / CHUNK_WORLD_SIZE);
    const clamp = (v: number) => Math.max(0, Math.min(GRID_SIZE - 1, v));

    const centerCx = clamp(toCi(pos.x));
    const centerCy = clamp(toCi(pos.y));
    const centerCz = clamp(toCi(pos.z));

    const candidates: Array<{ coord: ChunkCoord; dist2: number }> = [];
    const R = 2;
    for (let dz = -R; dz <= R; dz++) {
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const cx = centerCx + dx;
          const cy = centerCy + dy;
          const cz = centerCz + dz;
          if (
            cx < 0 || cy < 0 || cz < 0 ||
            cx >= GRID_SIZE || cy >= GRID_SIZE || cz >= GRID_SIZE
          ) continue;
          const coord = { cx, cy, cz };
          const [wx, wy, wz] = chunkWorldCenter(coord);
          const dist2 = (wx - pos.x) ** 2 + (wy - pos.y) ** 2 + (wz - pos.z) ** 2;
          candidates.push({ coord, dist2 });
        }
      }
    }

    candidates.sort((a, b) => a.dist2 - b.dist2);
    return candidates.slice(0, count).map((c) => c.coord);
  }

  private _coordFromKey(key: string): ChunkCoord | null {
    const parts = key.split(":");
    if (parts.length !== 3) return null;
    return { cx: Number(parts[0]), cy: Number(parts[1]), cz: Number(parts[2]) };
  }
}
