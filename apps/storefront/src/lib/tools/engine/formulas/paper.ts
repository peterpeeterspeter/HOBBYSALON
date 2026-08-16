import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber } from "../parse";
import { formatNl } from "../units";

/**
 * Paper cutting plan:
 * Compare both orientations of piece (w×h) on sheet (W×H).
 * No 2D bin-packing — just grid fit + leftover strip note.
 */
export const paperFormula: FormulaFn = (inputs: CalcInputs): CalcResult => {
  const sheetW = asNumber(inputs, "sheet_width_cm");
  const sheetH = asNumber(inputs, "sheet_height_cm");
  const pieceW = asNumber(inputs, "piece_width_cm");
  const pieceH = asNumber(inputs, "piece_height_cm");
  const sheets = Math.max(1, Math.floor(asNumber(inputs, "sheet_count", 1)));

  if (sheetW <= 0 || sheetH <= 0 || pieceW <= 0 || pieceH <= 0) {
    return {
      headline: "Vul vel- en stukafmetingen in.",
      breakdown: [],
      materials: [],
    };
  }

  const orientA = {
    across: Math.floor(sheetW / pieceW),
    down: Math.floor(sheetH / pieceH),
  };
  const countA = orientA.across * orientA.down;

  const orientB = {
    across: Math.floor(sheetW / pieceH),
    down: Math.floor(sheetH / pieceW),
  };
  const countB = orientB.across * orientB.down;

  const best = countA >= countB ? "A" : "B";
  const bestCount = Math.max(countA, countB);
  const bestOrient = best === "A" ? orientA : orientB;
  const usedW = best === "A" ? bestOrient.across * pieceW : bestOrient.across * pieceH;
  const usedH = best === "A" ? bestOrient.down * pieceH : bestOrient.down * pieceW;
  const leftoverW = roundLeftover(sheetW - usedW);
  const leftoverH = roundLeftover(sheetH - usedH);
  const total = bestCount * sheets;

  if (bestCount === 0) {
    return {
      headline: "Dit stuk past niet op het gekozen vel.",
      breakdown: [
        {
          label: "Vel",
          value: `${formatNl(sheetW, 1)} × ${formatNl(sheetH, 1)} cm`,
        },
        {
          label: "Stuk",
          value: `${formatNl(pieceW, 1)} × ${formatNl(pieceH, 1)} cm`,
        },
      ],
      materials: [],
    };
  }

  return {
    headline: `${bestCount} stuks per vel · ${total} in totaal (${sheets} vel${sheets === 1 ? "" : "len"}).`,
    breakdown: [
      {
        label: "Oriëntatie A (stuk recht)",
        value: `${countA} (${orientA.across} × ${orientA.down})`,
      },
      {
        label: "Oriëntatie B (stuk gedraaid)",
        value: `${countB} (${orientB.across} × ${orientB.down})`,
      },
      {
        label: "Beste keuze",
        value: best === "A" ? "recht op het vel" : "90° gedraaid",
      },
      {
        label: "Reststrook",
        value:
          leftoverW > 0 || leftoverH > 0
            ? `ca. ${formatNl(leftoverW, 1)} cm breedte · ${formatNl(leftoverH, 1)} cm hoogte over`
            : "geen noemenswaardige rest",
      },
    ],
    explanation:
      "We vergelijken beide oriëntaties (stuk recht of 90° gedraaid) en kiezen het maximum. Dit is een eenvoudig snijraster, geen optimale 2D-nesting.",
    materials: [
      {
        label: "Papier / karton",
        quantity: sheets,
        unit: sheets === 1 ? "vel" : "vellen",
        query: "kaartkarton",
        domainSlug: "card-making",
      },
    ],
  };
};

function roundLeftover(cm: number): number {
  if (cm < 0.05) return 0;
  return Math.round(cm * 10) / 10;
}
