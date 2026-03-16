/**
 * Yarn weight categories: meter per 100g ranges
 * Craft Yarn Council standards, craftyintentions.com
 */

export type YarnWeightEntry = {
  id: string;
  name: string;
  nameNl: string;
  minMetersPer100g: number;
  maxMetersPer100g: number;
  recommendedNeedleMm: string;
  recommendedHookMm: string;
};

export const YARN_WEIGHTS: YarnWeightEntry[] = [
  {
    id: "lace",
    name: "Lace",
    nameNl: "Lace",
    minMetersPer100g: 800,
    maxMetersPer100g: 2000,
    recommendedNeedleMm: "1.5–2.25 mm",
    recommendedHookMm: "1.25–2 mm",
  },
  {
    id: "fingering",
    name: "Fingering / 4-ply",
    nameNl: "Fingering / 4-draads",
    minMetersPer100g: 500,
    maxMetersPer100g: 800,
    recommendedNeedleMm: "2.25–3.25 mm",
    recommendedHookMm: "2–3.5 mm",
  },
  {
    id: "sport",
    name: "Sport / 5-ply",
    nameNl: "Sport",
    minMetersPer100g: 350,
    maxMetersPer100g: 500,
    recommendedNeedleMm: "3.25–3.75 mm",
    recommendedHookMm: "3.5–4.5 mm",
  },
  {
    id: "dk",
    name: "DK / 8-ply",
    nameNl: "DK / 8-draads",
    minMetersPer100g: 240,
    maxMetersPer100g: 350,
    recommendedNeedleMm: "3.75–4.5 mm",
    recommendedHookMm: "4–5.5 mm",
  },
  {
    id: "worsted",
    name: "Worsted / Aran",
    nameNl: "Worsted / Aran",
    minMetersPer100g: 180,
    maxMetersPer100g: 240,
    recommendedNeedleMm: "4.5–5.5 mm",
    recommendedHookMm: "5.5–6.5 mm",
  },
  {
    id: "bulky",
    name: "Bulky / Chunky",
    nameNl: "Bulky / Chunky",
    minMetersPer100g: 100,
    maxMetersPer100g: 180,
    recommendedNeedleMm: "5.5–8 mm",
    recommendedHookMm: "6.5–9 mm",
  },
  {
    id: "super-bulky",
    name: "Super Bulky",
    nameNl: "Super Bulky",
    minMetersPer100g: 50,
    maxMetersPer100g: 100,
    recommendedNeedleMm: "8–12.75 mm",
    recommendedHookMm: "9–15 mm",
  },
  {
    id: "jumbo",
    name: "Jumbo",
    nameNl: "Jumbo",
    minMetersPer100g: 25,
    maxMetersPer100g: 50,
    recommendedNeedleMm: "12.75+ mm",
    recommendedHookMm: "15+ mm",
  },
];

export function metersToGrams(
  meters: number,
  metersPer100g: number
): number {
  if (metersPer100g <= 0) return 0;
  return (meters / metersPer100g) * 100;
}

export function gramsToMeters(
  grams: number,
  metersPer100g: number
): number {
  if (metersPer100g <= 0) return 0;
  return (grams / 100) * metersPer100g;
}
