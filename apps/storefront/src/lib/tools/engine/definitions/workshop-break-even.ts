import type { CalcDefinition } from "../types";

export const workshopBreakEvenDefinition: CalcDefinition = {
  formulaId: "workshop_breakeven",
  assumptions:
    "Vaste kosten zijn huur, materiaal voorbereiding, marketing, enz. Variabele kosten stijgen per deelnemer (kit, catering).",
  fields: [
    {
      id: "fixed_costs",
      label: "Vaste kosten",
      kind: "number",
      unit: "€",
      defaultValue: 120,
      min: 0,
      max: 10000,
      hint: "Zaal, voorbereiding, advertenties…",
    },
    {
      id: "price_pp",
      label: "Prijs per deelnemer",
      kind: "number",
      unit: "€",
      defaultValue: 45,
      min: 1,
      max: 500,
    },
    {
      id: "variable_pp",
      label: "Variabele kosten per deelnemer",
      kind: "number",
      unit: "€",
      defaultValue: 12,
      min: 0,
      max: 400,
      hint: "Materiaalpakket, drankje, printwerk…",
    },
    {
      id: "attendees",
      label: "Verwacht aantal deelnemers (optioneel)",
      kind: "number",
      defaultValue: 0,
      min: 0,
      max: 200,
      hint: "0 = toon winst bij break-even.",
    },
  ],
  presets: [
    {
      id: "atelier",
      label: "Atelieravond",
      values: { fixed_costs: 80, price_pp: 35, variable_pp: 8 },
    },
    {
      id: "day",
      label: "Dagworkshop",
      values: { fixed_costs: 200, price_pp: 75, variable_pp: 20 },
    },
  ],
  faqs: [
    {
      question: "Hoe bereken ik het break-even aantal deelnemers?",
      answer:
        "Deel de vaste kosten door de contributiemarge (prijs minus variabele kosten per persoon) en rond naar boven af.",
    },
    {
      question: "Wat als mijn prijs de kosten per persoon niet dekt?",
      answer:
        "Dan is er geen break-even: elke deelnemer vergroot het verlies. Verhoog de prijs of verlaag de variabele kosten.",
    },
  ],
};
