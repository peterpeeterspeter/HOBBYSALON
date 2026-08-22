import type { CalcDefinition } from "../types";

export const papierSnijcalculatorDefinition: CalcDefinition = {
  formulaId: "paper",
  assumptions:
    "Eenvoudig snijraster: we vergelijken beide oriëntaties. Geen optimale 2D-nesting voor onregelmatige vormen.",
  fields: [
    {
      id: "sheet_width_cm",
      label: "Velbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 21,
      min: 1,
      max: 100,
    },
    {
      id: "sheet_height_cm",
      label: "Velhoogte",
      kind: "number",
      unit: "cm",
      defaultValue: 29.7,
      min: 1,
      max: 100,
    },
    {
      id: "piece_width_cm",
      label: "Stukbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 10,
      min: 0.5,
      max: 50,
    },
    {
      id: "piece_height_cm",
      label: "Stukhoogte",
      kind: "number",
      unit: "cm",
      defaultValue: 14,
      min: 0.5,
      max: 50,
    },
    {
      id: "sheet_count",
      label: "Aantal vellen",
      kind: "number",
      defaultValue: 1,
      min: 1,
      max: 100,
    },
  ],
  presets: [
    {
      id: "a4",
      label: "A4 (21×29,7)",
      values: { sheet_width_cm: 21, sheet_height_cm: 29.7 },
    },
    {
      id: "a5",
      label: "A5 (14,8×21)",
      values: { sheet_width_cm: 14.8, sheet_height_cm: 21 },
    },
    {
      id: "12x12",
      label: "12×12 inch scrap",
      values: { sheet_width_cm: 30.5, sheet_height_cm: 30.5 },
    },
    {
      id: "card-a6",
      label: "Kaart A6 (10,5×14,8)",
      values: { piece_width_cm: 10.5, piece_height_cm: 14.8 },
    },
  ],
  faqs: [
    {
      question: "Hoeveel kaarten krijg ik uit één vel?",
      answer:
        "We leggen het stuk zowel recht als 90° gedraaid op het vel en kiezen de oriëntatie met het meeste stuks.",
    },
    {
      question: "Waarom blijft er restpapier over?",
      answer:
        "Een eenvoudig raster past rechthoeken in rijen en kolommen. Voor maximale nesting van onregelmatige vormen is een geavanceerde snijplanner nodig.",
    },
  ],
};
