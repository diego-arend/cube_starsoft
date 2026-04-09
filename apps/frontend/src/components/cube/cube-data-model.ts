/**
 * CubeDataModel – 3D Volumetric Grid
 *
 * The volume is a cube occupying world-space [-1, 1] on each axis.
 * It is divided into a 64×64×64 grid of Chunks (262,144 total).
 * Each Chunk contains 11×11×11 Mini-cubes (1,331 per chunk).
 *
 * Total mini-cubes: 348,913,664
 */

/** Number of chunks per axis */
export const GRID_SIZE = 64;
/** Number of mini-cubes per axis within a single chunk */
export const CHUNK_SIZE = 11;
/** Total chunks in the volume: 64³ */
export const TOTAL_CHUNKS = GRID_SIZE ** 3; // 262,144
/** Mini-cubes per chunk: 11³ */
export const CUBES_PER_CHUNK = CHUNK_SIZE ** 3; // 1,331

/** The cube occupies [-1, 1]³, so world size is 2 per axis */
export const WORLD_SIZE = 2;
/** World-space edge length of one chunk: 2 / 64 ≈ 0.03125 */
export const CHUNK_WORLD_SIZE = WORLD_SIZE / GRID_SIZE;
/** World-space step between mini-cube centers within a chunk */
export const MINI_CUBE_STEP = CHUNK_WORLD_SIZE / CHUNK_SIZE;
/** Visual size of each mini-cube (18% gap between cubes) */
export const MINI_CUBE_SIZE = MINI_CUBE_STEP * 0.82;
/** Mini-cubes are cubic */
export const MINI_CUBE_DEPTH = MINI_CUBE_SIZE;
/** Visual size of the nav-LOD box that represents one whole chunk */
export const CHUNK_NAV_SIZE = CHUNK_WORLD_SIZE * 0.85;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Integer chunk coordinate in the 64×64×64 grid */
export interface ChunkCoord {
  cx: number;
  cy: number;
  cz: number;
}

// ─── Chunk Helpers ────────────────────────────────────────────────────────────

/** Unique string key for a chunk, suitable for use as a Map key */
export function chunkKey(c: ChunkCoord): string {
  return `${c.cx}:${c.cy}:${c.cz}`;
}

/** Flat index of a chunk in row-major order (cz × GRID² + cy × GRID + cx) */
export function chunkIndex(c: ChunkCoord): number {
  return c.cz * GRID_SIZE * GRID_SIZE + c.cy * GRID_SIZE + c.cx;
}

/** Inverse of chunkIndex */
export function chunkFromIndex(idx: number): ChunkCoord {
  const cx = idx % GRID_SIZE;
  const cy = Math.floor(idx / GRID_SIZE) % GRID_SIZE;
  const cz = Math.floor(idx / (GRID_SIZE * GRID_SIZE));
  return { cx, cy, cz };
}

/** World-space center of a chunk [x, y, z] */
export function chunkWorldCenter(c: ChunkCoord): [number, number, number] {
  return [
    (c.cx + 0.5) * CHUNK_WORLD_SIZE - 1,
    (c.cy + 0.5) * CHUNK_WORLD_SIZE - 1,
    (c.cz + 0.5) * CHUNK_WORLD_SIZE - 1,
  ];
}

// ─── Mini-cube Helpers ────────────────────────────────────────────────────────

/**
 * Flat index of a mini-cube within its chunk from local coords (lx, ly, lz).
 * Local coords are in range [0, CHUNK_SIZE).
 */
export function cubeIndex(lx: number, ly: number, lz: number): number {
  return lz * CHUNK_SIZE * CHUNK_SIZE + ly * CHUNK_SIZE + lx;
}

/** Inverse of cubeIndex */
export function cubeFromIndex(idx: number): { lx: number; ly: number; lz: number } {
  const lx = idx % CHUNK_SIZE;
  const ly = Math.floor(idx / CHUNK_SIZE) % CHUNK_SIZE;
  const lz = Math.floor(idx / (CHUNK_SIZE * CHUNK_SIZE));
  return { lx, ly, lz };
}
