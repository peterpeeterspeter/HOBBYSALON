import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber, asString } from "../parse";
import { formatNl, roundTo } from "../units";

/**
 * Resin calculator:
 * volume_ml = L × W × H (cm³ = ml) or π r² h for cylinder
 * A/B split by ratio; optional density for grams
 */
export const resinFormula: FormulaFn = (inputs: CalcInputs): CalcResult => {
  const shape = asString(inputs, "shape", "rect");
  const length = asNumber(inputs, "length_cm");
  const width = asNumber(inputs, "width_cm");
  const height = asNumber(inputs, "height_cm");
  const diameter = asNumber(inputs, "diameter_cm");
  const ratioA = Math.max(0.1, asNumber(inputs, "ratio_a", 1));
  const ratioB = Math.max(0.1, asNumber(inputs, "ratio_b", 1));
  const density = Math.max(0, asNumber(inputs, "density_g_ml", 1.1));
  const useWeight = asString(inputs, "output_mode", "volume") === "weight";

  let volumeMl = 0;
  if (shape === "cylinder") {
    if (diameter <= 0 || height <= 0) {
      return {
        headline: "Vul diameter en hoogte in voor een cilinder.",
        breakdown: [],
        materials: [],
      };
    }
    const r = diameter / 2;
    volumeMl = Math.PI * r * r * height;
  } else {
    if (length <= 0 || width <= 0 || height <= 0) {
      return {
        headline: "Vul lengte, breedte en hoogte in.",
        breakdown: [],
        materials: [],
      };
    }
    volumeMl = length * width * height;
  }

  const parts = ratioA + ratioB;
  const partAVol = (volumeMl * ratioA) / parts;
  const partBVol = (volumeMl * ratioB) / parts;

  if (useWeight && density > 0) {
    const totalG = volumeMl * density;
    const partAG = (totalG * ratioA) / parts;
    const partBG = (totalG * ratioB) / parts;
    return {
      headline: `Ca. ${formatNl(totalG, 0)} g harsmengsel (A ${formatNl(partAG, 0)} g + B ${formatNl(partBG, 0)} g).`,
      breakdown: [
        { label: "Volume", value: `${formatNl(volumeMl, 1)} ml` },
        { label: "Mengverhouding A:B", value: `${formatNl(ratioA, 1)}:${formatNl(ratioB, 1)}` },
        { label: "Dichtheid", value: `${formatNl(density, 2)} g/ml` },
        { label: "Component A", value: `${formatNl(partAG, 0)} g` },
        { label: "Component B", value: `${formatNl(partBG, 0)} g` },
      ],
      explanation:
        "Volume eerst uit de malafmetingen; daarna A/B volgens de mengverhouding. Bij gewicht: volume × dichtheid.",
      materials: [
        {
          label: "Epoxyhars (A)",
          quantity: roundTo(Math.max(partAG, 1), 0),
          unit: "g",
          query: "epoxyhars",
        },
        {
          label: "Harder (B)",
          quantity: roundTo(Math.max(partBG, 1), 0),
          unit: "g",
          query: "epoxy harder",
        },
        {
          label: "Pigment / kleurstof",
          quantity: null,
          unit: null,
          query: "resin pigment",
        },
      ],
    };
  }

  return {
    headline: `Ca. ${formatNl(volumeMl, 1)} ml (A ${formatNl(partAVol, 1)} ml + B ${formatNl(partBVol, 1)} ml).`,
    breakdown: [
      { label: "Volume", value: `${formatNl(volumeMl, 1)} ml` },
      { label: "Mengverhouding A:B", value: `${formatNl(ratioA, 1)}:${formatNl(ratioB, 1)}` },
      { label: "Component A", value: `${formatNl(partAVol, 1)} ml` },
      { label: "Component B", value: `${formatNl(partBVol, 1)} ml` },
    ],
    explanation:
      "Volume = lengte × breedte × hoogte (cm³ = ml), of πr²h voor een cilinder. Verdeel A en B volgens de verhouding op je fles.",
    materials: [
      {
        label: "Epoxyhars (A)",
        quantity: roundTo(Math.max(partAVol, 1), 1),
        unit: "ml",
        query: "epoxyhars",
      },
      {
        label: "Harder (B)",
        quantity: roundTo(Math.max(partBVol, 1), 1),
        unit: "ml",
        query: "epoxy harder",
      },
      {
        label: "Mal",
        quantity: null,
        unit: null,
        query: "resin mal",
      },
    ],
  };
};
