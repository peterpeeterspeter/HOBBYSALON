import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber } from "../parse";
import { formatNl } from "../units";

/**
 * Bead bracelet:
 * usable = wrist + ease - clasp - spacer_total
 * beads = floor(usable / bead_diameter)
 */
export const beadsFormula: FormulaFn = (inputs: CalcInputs): CalcResult => {
  const wrist = asNumber(inputs, "wrist_cm");
  const ease = asNumber(inputs, "ease_cm", 1.5);
  const clasp = Math.max(0, asNumber(inputs, "clasp_cm", 1));
  const spacerTotal = Math.max(0, asNumber(inputs, "spacer_total_cm", 0));
  const beadD = asNumber(inputs, "bead_diameter_mm");

  if (wrist <= 0 || beadD <= 0) {
    return {
      headline: "Vul polsomtrek en kraaldiameter in.",
      breakdown: [],
      materials: [],
    };
  }

  const usableCm = wrist + ease - clasp - spacerTotal;
  const beadCm = beadD / 10;
  const count = usableCm > 0 ? Math.floor(usableCm / beadCm) : 0;

  if (count <= 0) {
    return {
      headline:
        "Bruikbare lengte is te kort voor deze kraalmaat. Verminder sluiting of tussenstukken.",
      breakdown: [
        { label: "Bruikbare lengte", value: `${formatNl(usableCm, 1)} cm` },
      ],
      materials: [],
    };
  }

  return {
    headline: `Ca. ${count} kralen van ${formatNl(beadD, 1)} mm.`,
    breakdown: [
      { label: "Pols + speling", value: `${formatNl(wrist + ease, 1)} cm` },
      { label: "Sluiting", value: `${formatNl(clasp, 1)} cm` },
      {
        label: "Tussenstukken",
        value: spacerTotal > 0 ? `${formatNl(spacerTotal, 1)} cm` : "geen",
      },
      { label: "Bruikbaar voor kralen", value: `${formatNl(usableCm, 1)} cm` },
      { label: "Kraaldiameter", value: `${formatNl(beadD, 1)} mm` },
    ],
    explanation:
      "Bruikbare lengte = polsomtrek + speling − sluiting − tussenstukken. Aantal kralen = floor(bruikbaar ÷ kraaldiameter).",
    materials: [
      {
        label: "Kralen",
        quantity: count,
        unit: "stuks",
        query: "kralen",
        domainSlug: "jewelry",
      },
      {
        label: "Elastiek of rijgdraad",
        quantity: null,
        unit: null,
        query: "rijgdraad",
        domainSlug: "jewelry",
      },
      {
        label: "Sluiting",
        quantity: clasp > 0 ? 1 : null,
        unit: clasp > 0 ? "stuk" : null,
        query: "armbandsluiting",
        domainSlug: "jewelry",
      },
    ],
  };
};
