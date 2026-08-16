import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber } from "../parse";
import { cmToM, formatNl, roundTo } from "../units";

/**
 * Quilt calculator:
 * blocksX = ceil(quiltW / blockW), blocksY = ceil(quiltH / blockH)
 * fabric for blocks ≈ blocks × block area / fabric width (+ waste)
 * backing = (quilt + extra) in both directions
 * binding strips ≈ perimeter / (stripWidth - seam)
 */
export const quiltFormula: FormulaFn = (inputs: CalcInputs): CalcResult => {
  const quiltW = asNumber(inputs, "quilt_width_cm");
  const quiltH = asNumber(inputs, "quilt_height_cm");
  const blockW = asNumber(inputs, "block_width_cm");
  const blockH = asNumber(inputs, "block_height_cm");
  const fabricWidth = asNumber(inputs, "fabric_width_cm", 110);
  const wastePct = Math.max(0, asNumber(inputs, "waste_pct", 10));
  const backingExtra = Math.max(0, asNumber(inputs, "backing_extra_cm", 20));
  const bindingStrip = Math.max(1, asNumber(inputs, "binding_strip_cm", 6));
  const bindingSeam = Math.max(0, asNumber(inputs, "binding_seam_cm", 1));

  if (quiltW <= 0 || quiltH <= 0 || blockW <= 0 || blockH <= 0) {
    return {
      headline: "Vul quilt- en blokafmetingen in.",
      breakdown: [],
      materials: [],
    };
  }

  const blocksX = Math.ceil(quiltW / blockW);
  const blocksY = Math.ceil(quiltH / blockH);
  const totalBlocks = blocksX * blocksY;

  const wasteFactor = 1 + wastePct / 100;
  const blockFabricAreaCm2 = totalBlocks * blockW * blockH * wasteFactor;
  const blockFabricCm =
    fabricWidth > 0 ? blockFabricAreaCm2 / fabricWidth : 0;
  const blockFabricM = cmToM(blockFabricCm);

  const backingW = quiltW + 2 * backingExtra;
  const backingH = quiltH + 2 * backingExtra;
  const backingCm =
    fabricWidth > 0
      ? Math.ceil(backingW / fabricWidth) * backingH
      : backingH;
  const backingM = cmToM(backingCm);

  const perimeter = 2 * (quiltW + quiltH);
  const usableStrip = Math.max(0.5, bindingStrip - bindingSeam);
  const bindingStrips = Math.ceil(perimeter / usableStrip);
  const bindingM = cmToM(bindingStrips * fabricWidth);

  return {
    headline: `${totalBlocks} blokken · ca. ${formatNl(blockFabricM, 2)} m blokstof.`,
    breakdown: [
      {
        label: "Blokken",
        value: `${blocksX} × ${blocksY} = ${totalBlocks}`,
      },
      {
        label: "Blokstof (incl. snijverlies)",
        value: `${formatNl(blockFabricM, 2)} m`,
      },
      {
        label: "Backing",
        value: `${formatNl(backingM, 2)} m (${formatNl(backingW, 0)} × ${formatNl(backingH, 0)} cm)`,
      },
      {
        label: "Binding",
        value: `${bindingStrips} stroken · ca. ${formatNl(bindingM, 2)} m`,
      },
    ],
    explanation:
      "Blokken = ceil(quilt ÷ blok) in beide richtingen. Backing krijgt extra rondom. Binding volgt uit de omtrek gedeeld door de bruikbare strookbreedte.",
    materials: [
      {
        label: "Blokstof",
        quantity: roundTo(Math.max(blockFabricM, 0.1), 2),
        unit: "m",
        query: "stof quilt",
        domainSlug: "sewing",
      },
      {
        label: "Backing",
        quantity: roundTo(Math.max(backingM, 0.1), 2),
        unit: "m",
        query: "backing stof",
        domainSlug: "sewing",
      },
      {
        label: "Binding / bias",
        quantity: roundTo(Math.max(bindingM, 0.1), 2),
        unit: "m",
        query: "biasband",
        domainSlug: "sewing",
      },
    ],
  };
};
