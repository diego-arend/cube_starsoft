/**
 * CubeDataModel
 *
 * Modelo lógico do cubo. Totalmente independente do Three.js.
 * O cubo possui 6 faces, cada face com ~707×707 quadrados (≈ 500_000 por face = 3_000_000 total).
 */

export type FaceId = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";

export const FACE_IDS: FaceId[] = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];

/** Quadrados por lado de cada face (√500_000 ≈ 707) */
export const SQUARES_PER_SIDE = 707;

/** Quadrados por tile (chunk 2D) */
export const TILE_SIZE = 32;

/** Número de tiles por lado de cada face */
export const TILES_PER_SIDE = Math.ceil(SQUARES_PER_SIDE / TILE_SIZE);

export interface TileDescriptor {
  face: FaceId;
  tileX: number;
  tileY: number;
  /** Square range covered by this tile */
  squareXMin: number;
  squareXMax: number;
  squareYMin: number;
  squareYMax: number;
}

/**
 * Returns all tiles for a given face that overlap with the specified
 * square coordinate range.
 */
export function getTileRange(
  face: FaceId,
  squareXMin: number,
  squareXMax: number,
  squareYMin: number,
  squareYMax: number
): TileDescriptor[] {
  const tileXMin = Math.floor(squareXMin / TILE_SIZE);
  const tileXMax = Math.floor(squareXMax / TILE_SIZE);
  const tileYMin = Math.floor(squareYMin / TILE_SIZE);
  const tileYMax = Math.floor(squareYMax / TILE_SIZE);

  const tiles: TileDescriptor[] = [];

  for (let ty = tileYMin; ty <= tileYMax; ty++) {
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      tiles.push({
        face,
        tileX: tx,
        tileY: ty,
        squareXMin: tx * TILE_SIZE,
        squareXMax: Math.min((tx + 1) * TILE_SIZE - 1, SQUARES_PER_SIDE - 1),
        squareYMin: ty * TILE_SIZE,
        squareYMax: Math.min((ty + 1) * TILE_SIZE - 1, SQUARES_PER_SIDE - 1),
      });
    }
  }

  return tiles;
}

/** Returns a unique string key for a tile, suitable for use as a Map key. */
export function tileKey(tile: TileDescriptor): string {
  return `${tile.face}:${tile.tileX}:${tile.tileY}`;
}

/** Full set of tiles for a given face */
export function getAllTilesForFace(face: FaceId): TileDescriptor[] {
  return getTileRange(face, 0, SQUARES_PER_SIDE - 1, 0, SQUARES_PER_SIDE - 1);
}
