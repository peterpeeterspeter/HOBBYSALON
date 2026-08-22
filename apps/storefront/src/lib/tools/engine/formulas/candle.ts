import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber } from "../parse";
import { formatNl, roundTo } from "../units";

/**
 * Candle wax:
 * wax_g = volume_ml × fill_factor × density_g_per_ml
 * scent_g = wax_g × scent_pct / 100
 */
export const candleFormula: FormulaFn = (inputs: CalcInputs): CalcResult => {
  const volumeMl = asNumber(inputs, "volume_ml");
  const fillFactor = asNumber(inputs, "fill_factor", 1);
  const density = asNumber(inputs, "density_g_ml", 0.9);
  const scentPct = Math.max(0, asNumber(inputs, "scent_pct", 6));

  if (volumeMl <= 0 || density <= 0) {
    return {
      headline: "Vul volume (ml) en dichtheid in.",
      breakdown: [],
      materials: [],
    };
  }

  const fill = fillFactor > 0 ? fillFactor : 1;
  const waxG = volumeMl * fill * density;
  const scentG = waxG * (scentPct / 100);

  return {
    headline: `Ca. ${formatNl(waxG, 0)} g was en ${formatNl(scentG, 1)} g geurolie.`,
    breakdown: [
      { label: "Volume", value: `${formatNl(volumeMl, 0)} ml` },
      { label: "Vulfactor", value: formatNl(fill, 2) },
      { label: "Dichtheid", value: `${formatNl(density, 2)} g/ml` },
      { label: "Was", value: `${formatNl(waxG, 0)} g` },
      {
        label: `Geurolie (${formatNl(scentPct, 0)}%)`,
        value: `${formatNl(scentG, 1)} g`,
      },
    ],
    explanation:
      "Wasgewicht = volume × vulfactor × dichtheid. Gebruik de dichtheid van jouw was (soja, paraffine, bijenwas) in plaats van een vaste factor.",
    materials: [
      {
        label: "Kaarsenwas",
        quantity: roundTo(Math.max(waxG, 1), 0),
        unit: "g",
        query: "kaarsenwas",
      },
      {
        label: "Geurolie",
        quantity: roundTo(Math.max(scentG, 0.1), 1),
        unit: "g",
        query: "geurolie kaars",
      },
      {
        label: "Lont",
        quantity: null,
        unit: null,
        query: "kaarsenlont",
      },
    ],
  };
};
