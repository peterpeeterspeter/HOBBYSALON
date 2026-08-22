import type { CalcDefinition } from "../types";

export const kralenarmbandCalculatorDefinition: CalcDefinition = {
  formulaId: "beads",
  assumptions:
    "Tel altijd een paar kralen extra voor foutjes. Bij elastiek kun je iets strakker of losser werken.",
  fields: [
    {
      id: "wrist_cm",
      label: "Polsomtrek",
      kind: "number",
      unit: "cm",
      defaultValue: 17,
      min: 10,
      max: 30,
    },
    {
      id: "ease_cm",
      label: "Gewenste speling",
      kind: "number",
      unit: "cm",
      defaultValue: 1.5,
      min: 0,
      max: 5,
      hint: "Ruimte zodat de armband comfortabel zit.",
    },
    {
      id: "bead_diameter_mm",
      label: "Kraaldiameter",
      kind: "number",
      unit: "mm",
      defaultValue: 8,
      min: 2,
      max: 20,
      step: 0.5,
    },
    {
      id: "clasp_cm",
      label: "Lengte sluiting",
      kind: "number",
      unit: "cm",
      defaultValue: 1,
      min: 0,
      max: 5,
      hint: "0 bij elastiek zonder sluiting.",
    },
    {
      id: "spacer_total_cm",
      label: "Tussenstukken (totaal)",
      kind: "number",
      unit: "cm",
      defaultValue: 0,
      min: 0,
      max: 15,
    },
  ],
  presets: [
    {
      id: "bead-6",
      label: "6 mm kralen",
      values: { bead_diameter_mm: 6 },
    },
    {
      id: "bead-8",
      label: "8 mm kralen",
      values: { bead_diameter_mm: 8 },
    },
    {
      id: "bead-10",
      label: "10 mm kralen",
      values: { bead_diameter_mm: 10 },
    },
    {
      id: "elastic",
      label: "Elastiek (geen sluiting)",
      values: { clasp_cm: 0, ease_cm: 0.5 },
    },
  ],
  faqs: [
    {
      question: "Hoeveel kralen heb ik nodig voor een armband?",
      answer:
        "Neem polsomtrek plus speling, trek sluiting en tussenstukken af, en deel door de kraaldiameter.",
    },
    {
      question: "Hoe meet ik mijn polsomtrek?",
      answer:
        "Meet strak met een meetlint om je pols. Voeg 1–2 cm speling toe voor comfort, tenzij je elastiek gebruikt.",
    },
  ],
};
