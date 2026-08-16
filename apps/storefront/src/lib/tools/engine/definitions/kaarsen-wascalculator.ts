import type { CalcDefinition } from "../types";

export const kaarsenWascalculatorDefinition: CalcDefinition = {
  formulaId: "candle",
  assumptions:
    "Dichtheden zijn richtwaarden. Volg altijd de verhoudingen van je was- en geurolieleverancier.",
  fields: [
    {
      id: "volume_ml",
      label: "Volume van de mal / pot",
      kind: "number",
      unit: "ml",
      defaultValue: 200,
      min: 10,
      max: 5000,
    },
    {
      id: "fill_factor",
      label: "Vulfactor",
      kind: "number",
      defaultValue: 0.95,
      min: 0.5,
      max: 1.1,
      step: 0.01,
      hint: "Laat iets ruimte onder de rand (bijv. 0,95).",
    },
    {
      id: "density_g_ml",
      label: "Dichtheid was",
      kind: "number",
      unit: "g/ml",
      defaultValue: 0.9,
      min: 0.5,
      max: 1.2,
      step: 0.01,
    },
    {
      id: "scent_pct",
      label: "Geurolie",
      kind: "number",
      unit: "%",
      defaultValue: 6,
      min: 0,
      max: 12,
    },
  ],
  presets: [
    {
      id: "soy",
      label: "Soja 0,90",
      values: { density_g_ml: 0.9, scent_pct: 6 },
    },
    {
      id: "paraffin",
      label: "Paraffine 0,90",
      values: { density_g_ml: 0.9, scent_pct: 5 },
    },
    {
      id: "beeswax",
      label: "Bijenwas 0,95",
      values: { density_g_ml: 0.95, scent_pct: 4 },
    },
  ],
  faqs: [
    {
      question: "Hoeveel was heb ik nodig voor een kaars?",
      answer:
        "Vermenigvuldig het volume in ml met de vulfactor en de dichtheid van je was in g/ml. Zo krijg je het wasgewicht in gram.",
    },
    {
      question: "Hoeveel geurolie moet ik toevoegen?",
      answer:
        "Meestal 4–8% van het wasgewicht. Check de maximale dosering van je leverancier.",
    },
  ],
};
