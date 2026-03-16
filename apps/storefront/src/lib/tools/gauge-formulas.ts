/**
 * Reusable gauge and pattern calculation formulas
 */

export function stitchesForWidth(
  widthCm: number,
  stitchesPerCm: number
): number {
  return Math.round(widthCm * stitchesPerCm);
}

export function rowsForHeight(
  heightCm: number,
  rowsPerCm: number
): number {
  return Math.round(heightCm * rowsPerCm);
}

export function convertGauge(
  originalStitches: number,
  originalGauge: number,
  newGauge: number
): number {
  if (originalGauge <= 0) return 0;
  return Math.round((originalStitches / originalGauge) * newGauge);
}

/**
 * C2C (corner-to-corner) blanket calculations
 * Blocks grow diagonally: row 1 = 1 block, row 2 = 2 blocks, ...
 * Total blocks = 1+2+3+...+n + (height-1)*(width) pattern for rectangle
 * Simplified: for rectangle width x height in blocks,
 * total = width * height (each cell is one block)
 * Diagonal count: min(w,h) diagonals, each diagonal has varying blocks
 */
export function c2cTotalBlocks(widthBlocks: number, heightBlocks: number): number {
  return widthBlocks * heightBlocks;
}

/**
 * C2C: blocks in a diagonal row
 * Diagonal d (1-based): has min(d, width, height, width+height-d+1) blocks
 */
export function c2cBlocksInDiagonal(
  diag: number,
  width: number,
  height: number
): number {
  const maxBlocks = Math.min(diag, width, height, width + height - diag + 1);
  return Math.max(0, maxBlocks);
}
