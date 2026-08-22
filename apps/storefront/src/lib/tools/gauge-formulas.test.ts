import assert from "node:assert/strict";
import test from "node:test";
import {
  c2cBlocksInDiagonal,
  c2cTotalBlocks,
  convertGauge,
  rowsForHeight,
  stitchesForWidth,
  // @ts-expect-error Node's TypeScript test runner requires the extension.
} from "./gauge-formulas.ts";

test("stitch and row counts round to whole stitches", () => {
  assert.equal(stitchesForWidth(50, 2.2), 110);
  assert.equal(rowsForHeight(30, 2.8), 84);
  // You cannot crochet a fraction of a stitch.
  assert.ok(Number.isInteger(stitchesForWidth(33.3, 1.7)));
  assert.ok(Number.isInteger(rowsForHeight(33.3, 1.7)));
});

test("gauge conversion keeps the finished size", () => {
  // 100 stitches at 2 st/cm is 50cm wide; at 2.5 st/cm the same 50cm
  // needs 125 stitches.
  assert.equal(convertGauge(100, 2, 2.5), 125);
  // Same gauge in and out must be a no-op.
  assert.equal(convertGauge(87, 2.4, 2.4), 87);
});

test("gauge conversion refuses to divide by zero", () => {
  assert.equal(convertGauge(100, 0, 2.5), 0);
  assert.equal(convertGauge(100, -1, 2.5), 0);
});

test("c2c total blocks is the grid area", () => {
  assert.equal(c2cTotalBlocks(10, 8), 80);
  assert.equal(c2cTotalBlocks(1, 1), 1);
});

test("c2c diagonals sum to the total block count", () => {
  // The defining property: walking every diagonal must account for every
  // block exactly once. Any off-by-one in the diagonal formula shows up
  // here as a total that disagrees with width x height.
  for (const width of [1, 2, 3, 5, 8, 13]) {
    for (const height of [1, 2, 3, 5, 8, 13]) {
      let sum = 0;
      for (let diag = 1; diag <= width + height - 1; diag++) {
        sum += c2cBlocksInDiagonal(diag, width, height);
      }
      assert.equal(
        sum,
        c2cTotalBlocks(width, height),
        `${width}x${height}: diagonals summed to ${sum}, expected ${width * height}`
      );
    }
  }
});

test("c2c diagonal counts match a direct count of the grid", () => {
  const countByHand = (diag: number, width: number, height: number) => {
    let cells = 0;
    for (let row = 1; row <= height; row++) {
      for (let col = 1; col <= width; col++) {
        if (row + col - 1 === diag) cells += 1;
      }
    }
    return cells;
  };

  for (const [width, height] of [
    [3, 2],
    [2, 3],
    [4, 4],
    [6, 2],
    [1, 5],
  ] as Array<[number, number]>) {
    for (let diag = 1; diag <= width + height - 1; diag++) {
      assert.equal(
        c2cBlocksInDiagonal(diag, width, height),
        countByHand(diag, width, height),
        `${width}x${height} diagonal ${diag}`
      );
    }
  }
});

test("c2c diagonals outside the blanket are empty, never negative", () => {
  assert.equal(c2cBlocksInDiagonal(0, 5, 5), 0);
  assert.equal(c2cBlocksInDiagonal(-3, 5, 5), 0);
  // One past the last diagonal (width + height - 1).
  assert.equal(c2cBlocksInDiagonal(10, 5, 5), 0);
  assert.equal(c2cBlocksInDiagonal(999, 5, 5), 0);
});
