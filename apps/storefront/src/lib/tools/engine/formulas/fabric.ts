import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber } from "../parse";
import { cmToM, formatNl, roundTo } from "../units";

/**
 * Fabric yardage:
 * strips = ceil((pieceWidth + 2*seam) / fabricWidth)
 * usableLength = pieceLength + 2*seam; if patternRepeat > 0 → ceil to repeat
 * length_m = strips × usableLength × qty × (1 + waste%)
 */
export const fabricFormula: FormulaFn = (inputs: CalcInputs): CalcResult => {
  const pieceWidth = asNumber(inputs, "piece_width_cm");
  const pieceLength = asNumber(inputs, "piece_length_cm");
  const fabricWidth = asNumber(inputs, "fabric_width_cm");
  const seam = asNumber(inputs, "seam_allowance_cm");
  const qty = Math.max(1, asNumber(inputs, "quantity", 1));
  const wastePct = Math.max(0, asNumber(inputs, "waste_pct"));
  const repeat = Math.max(0, asNumber(inputs, "pattern_repeat_cm"));

  if (pieceWidth <= 0 || pieceLength <= 0 || fabricWidth <= 0) {
    return {
      headline: "Vul stukbreedte, stuklengte en stofbreedte in.",
      breakdown: [],
      materials: [],
    };
  }

  const neededWidth = pieceWidth + 2 * seam;
  const strips = Math.ceil(neededWidth / fabricWidth);
  let usableLength = pieceLength + 2 * seam;
  if (repeat > 0) {
    usableLength = Math.ceil(usableLength / repeat) * repeat;
  }
  const wasteFactor = 1 + wastePct / 100;
  const lengthCm = strips * usableLength * qty * wasteFactor;
  const lengthM = cmToM(lengthCm);

  return {
    headline: `Je hebt ca. ${formatNl(lengthM, 2)} m stof nodig.`,
    breakdown: [
      { label: "Stroken over de breedte", value: String(strips) },
      {
        label: "Lengte per strook",
        value: `${formatNl(usableLength, 1)} cm`,
      },
      { label: "Aantal stukken", value: String(qty) },
      {
        label: "Snijverlies",
        value: wastePct > 0 ? `${formatNl(wastePct, 0)}%` : "geen",
      },
      {
        label: "Berekening",
        value: `${strips} × ${formatNl(cmToM(usableLength), 2)} m × ${qty} × ${formatNl(wasteFactor, 2)}`,
      },
    ],
    explanation:
      "Stroken = ceil((stukbreedte + 2×naadtoeslag) ÷ stofbreedte). Lengte per strook houdt rekening met naadtoeslag en eventuele patroonherhaling.",
    materials: [
      {
        label: "Stof",
        quantity: roundTo(Math.max(lengthM, 0.1), 2),
        unit: "m",
        query: "stof",
        domainSlug: "sewing",
      },
    ],
  };
};
