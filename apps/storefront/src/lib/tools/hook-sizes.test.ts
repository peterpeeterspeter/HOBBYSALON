import assert from "node:assert/strict";
import test from "node:test";
import {
  HOOK_SIZES,
  findHookByMm,
  findHookByUsLetter,
  // @ts-expect-error Node's TypeScript test runner requires the extension.
} from "./hook-sizes.ts";

type HookSizeEntry = { mm: number; usLetter: string | null };
const sizes = HOOK_SIZES as HookSizeEntry[];

test("the size table stays sorted by mm", () => {
  // HaaknaaldmaatConverter estimates an in-between size with
  // `HOOK_SIZES.filter(e => e.mm < num).pop()` for the size below and
  // `.find(e => e.mm > num)` for the one above. Both silently return the
  // wrong neighbour if a row is ever inserted out of order.
  for (let i = 1; i < sizes.length; i += 1) {
    assert.ok(
      sizes[i].mm > sizes[i - 1].mm,
      `entry ${i} (${sizes[i].mm}mm) must be larger than the previous (${sizes[i - 1].mm}mm)`
    );
  }
});

test("every mm size appears once", () => {
  const seen = new Set<number>();
  for (const entry of sizes) {
    assert.ok(!seen.has(entry.mm), `duplicate size: ${entry.mm}mm`);
    seen.add(entry.mm);
  }
});

test("looking up by mm tolerates float representation", () => {
  assert.equal(findHookByMm(4)?.usLetter, "G");
  assert.equal(findHookByMm(2.25)?.usLetter, "B");
  // 0.1 + 0.2 style drift must still resolve.
  assert.equal(findHookByMm(3.5000001)?.usLetter, "E");
  assert.equal(findHookByMm(4.2), undefined);
});

test("looking up by US letter is case and whitespace insensitive", () => {
  assert.equal(findHookByUsLetter("g")?.mm, 4);
  assert.equal(findHookByUsLetter("  H  ")?.mm, 5);
});

test("an empty US letter finds nothing", () => {
  // `"MN".includes("")` is true, so an unguarded lookup would hand back
  // the first lettered hook for empty input.
  assert.equal(findHookByUsLetter(""), undefined);
  assert.equal(findHookByUsLetter("   "), undefined);
});

test("an unknown US letter finds nothing", () => {
  assert.equal(findHookByUsLetter("Z"), undefined);
});
