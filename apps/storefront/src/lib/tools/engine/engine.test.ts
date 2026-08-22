import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { parseNlNumber } from "./parse.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { runCalc, defaultInputs } from "./run.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { FORMULAS } from "./formulas/index.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { stofcalculatorDefinition } from "./definitions/stofcalculator.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { quiltcalculatorDefinition } from "./definitions/quiltcalculator.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { papierSnijcalculatorDefinition } from "./definitions/papier-snijcalculator.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { workshopBreakEvenDefinition } from "./definitions/workshop-break-even.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { kaarsenWascalculatorDefinition } from "./definitions/kaarsen-wascalculator.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resinCalculatorDefinition } from "./definitions/resin-calculator.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { kralenarmbandCalculatorDefinition } from "./definitions/kralenarmband-calculator.ts";

test("parseNlNumber accepts comma and dot decimals", () => {
  assert.equal(parseNlNumber("1,5"), 1.5);
  assert.equal(parseNlNumber("1.5"), 1.5);
  assert.equal(parseNlNumber(" 12 "), 12);
  assert.equal(parseNlNumber(""), null);
  assert.equal(parseNlNumber("abc"), null);
});

test("fabric formula uses ceil for strips and waste factor", () => {
  const result = FORMULAS.fabric({
    piece_width_cm: 100,
    piece_length_cm: 50,
    fabric_width_cm: 140,
    seam_allowance_cm: 0,
    quantity: 1,
    waste_pct: 10,
    pattern_repeat_cm: 0,
  });
  // strips = ceil(100/140) = 1; length = 1 × 50 × 1 × 1.1 = 55 cm = 0.55 m
  assert.match(result.headline, /0[,.]55 m/);
  assert.equal(result.materials[0]?.quantity, 0.55);
});

test("fabric pattern repeat rounds usable length up", () => {
  const result = FORMULAS.fabric({
    piece_width_cm: 50,
    piece_length_cm: 45,
    fabric_width_cm: 140,
    seam_allowance_cm: 0,
    quantity: 1,
    waste_pct: 0,
    pattern_repeat_cm: 20,
  });
  // usable = ceil(45/20)*20 = 60 cm → 0.60 m
  assert.match(result.headline, /0[,.]6 m/);
});

test("quilt block count ceils both axes", () => {
  const result = FORMULAS.quilt({
    quilt_width_cm: 100,
    quilt_height_cm: 100,
    block_width_cm: 30,
    block_height_cm: 30,
    fabric_width_cm: 110,
    waste_pct: 0,
    backing_extra_cm: 0,
    binding_strip_cm: 6,
    binding_seam_cm: 1,
  });
  // 4 × 4 = 16 blocks
  assert.match(result.headline, /16 blokken/);
});

test("candle uses adjustable density not a fixed 0.8", () => {
  const soy = FORMULAS.candle({
    volume_ml: 100,
    fill_factor: 1,
    density_g_ml: 0.9,
    scent_pct: 6,
  });
  assert.match(soy.headline, /90 g was/);
  assert.match(soy.headline, /5[,.]4 g geurolie/);

  const dense = FORMULAS.candle({
    volume_ml: 100,
    fill_factor: 1,
    density_g_ml: 0.95,
    scent_pct: 0,
  });
  assert.match(dense.headline, /95 g was/);
});

test("resin splits A/B by ratio for rectangle volume", () => {
  const result = FORMULAS.resin({
    shape: "rect",
    length_cm: 10,
    width_cm: 10,
    height_cm: 1,
    diameter_cm: 0,
    ratio_a: 2,
    ratio_b: 1,
    density_g_ml: 1.1,
    output_mode: "volume",
  });
  // 100 ml → A 66.7, B 33.3
  assert.match(result.headline, /100/);
  assert.match(result.headline, /66[,.]7/);
  assert.match(result.headline, /33[,.]3/);
});

test("beads floors usable length over diameter", () => {
  const result = FORMULAS.beads({
    wrist_cm: 16,
    ease_cm: 2,
    clasp_cm: 2,
    spacer_total_cm: 0,
    bead_diameter_mm: 8,
  });
  // usable = 16+2-2 = 16 cm; bead = 0.8 cm; floor(16/0.8) = 20
  assert.match(result.headline, /20 kralen/);
});

test("paper compares both orientations and picks the max", () => {
  const result = FORMULAS.paper({
    sheet_width_cm: 21,
    sheet_height_cm: 29.7,
    piece_width_cm: 10,
    piece_height_cm: 14,
    sheet_count: 1,
  });
  // A: floor(21/10)*floor(29.7/14) = 2*2 = 4
  // B: floor(21/14)*floor(29.7/10) = 1*2 = 2
  assert.match(result.headline, /4 stuks per vel/);
  const orientA = result.breakdown.find((r) => r.label.includes("Oriëntatie A"));
  const orientB = result.breakdown.find((r) => r.label.includes("Oriëntatie B"));
  assert.ok(orientA?.value.startsWith("4"));
  assert.ok(orientB?.value.startsWith("2"));
});

test("workshop break-even ceils and refuses non-positive contribution", () => {
  const ok = FORMULAS.workshop_breakeven({
    fixed_costs: 100,
    price_pp: 40,
    variable_pp: 10,
    attendees: 0,
  });
  // ceil(100/30) = 4
  assert.match(ok.headline, /4 deelnemer/);

  const bad = FORMULAS.workshop_breakeven({
    fixed_costs: 100,
    price_pp: 10,
    variable_pp: 12,
    attendees: 0,
  });
  assert.match(bad.headline, /dekt de variabele kosten niet/i);
});

test("runCalc validates NL decimals and min bounds", () => {
  const ok = runCalc(stofcalculatorDefinition, {
    ...Object.fromEntries(
      stofcalculatorDefinition.fields.map((f) => [f.id, f.defaultValue])
    ),
    piece_width_cm: "50,5",
    fabric_width_cm: "140",
  });
  assert.equal(ok.ok, true);

  const fail = runCalc(stofcalculatorDefinition, {
    ...defaultInputs(stofcalculatorDefinition),
    piece_width_cm: 0,
  });
  assert.equal(fail.ok, false);
});

test("all seven definitions run with defaults", () => {
  const defs = [
    stofcalculatorDefinition,
    quiltcalculatorDefinition,
    kaarsenWascalculatorDefinition,
    resinCalculatorDefinition,
    kralenarmbandCalculatorDefinition,
    papierSnijcalculatorDefinition,
    workshopBreakEvenDefinition,
  ];
  for (const def of defs) {
    const outcome = runCalc(def, defaultInputs(def));
    assert.equal(outcome.ok, true, def.formulaId);
    if (outcome.ok) {
      assert.ok(outcome.result.headline.length > 0);
    }
  }
});
