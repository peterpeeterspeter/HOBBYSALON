import type { CalcDefinition } from "../types";

export const stofcalculatorDefinition: CalcDefinition = {
  formulaId: "fabric",
  assumptions:
    "Dit is een schatting. Houd rekening met de nerf, elastische stoffen en patronen met eenrichtingsprint.",
  fields: [
    {
      id: "piece_width_cm",
      label: "Stukbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 50,
      min: 1,
      max: 500,
      hint: "Breedte van één patroonstuk of panel.",
    },
    {
      id: "piece_length_cm",
      label: "Stuklengte",
      kind: "number",
      unit: "cm",
      defaultValue: 60,
      min: 1,
      max: 500,
    },
    {
      id: "fabric_width_cm",
      label: "Stofbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 140,
      min: 10,
      max: 320,
      hint: "Breedte van de stofrol (vaak 140 of 150 cm).",
    },
    {
      id: "seam_allowance_cm",
      label: "Naadtoeslag (per kant)",
      kind: "number",
      unit: "cm",
      defaultValue: 1.5,
      min: 0,
      max: 10,
    },
    {
      id: "quantity",
      label: "Aantal stukken",
      kind: "number",
      defaultValue: 1,
      min: 1,
      max: 50,
    },
    {
      id: "waste_pct",
      label: "Snijverlies",
      kind: "number",
      unit: "%",
      defaultValue: 10,
      min: 0,
      max: 50,
    },
    {
      id: "pattern_repeat_cm",
      label: "Patroonherhaling",
      kind: "number",
      unit: "cm",
      defaultValue: 0,
      min: 0,
      max: 200,
      hint: "0 = geen herhaling. Anders wordt de lengte opgerond naar de herhaling.",
    },
  ],
  presets: [
    {
      id: "cotton-140",
      label: "Katoen 140 cm",
      values: { fabric_width_cm: 140, waste_pct: 10 },
    },
    {
      id: "cotton-150",
      label: "Katoen 150 cm",
      values: { fabric_width_cm: 150, waste_pct: 10 },
    },
    {
      id: "jersey-160",
      label: "Jersey 160 cm",
      values: { fabric_width_cm: 160, waste_pct: 15, seam_allowance_cm: 1 },
    },
  ],
  faqs: [
    {
      question: "Hoe bereken ik hoeveel stof ik nodig heb?",
      answer:
        "Deel de benodigde breedte (stuk + naadtoeslag) door de stofbreedte om het aantal stroken te krijgen. Vermenigvuldig met de lengte per strook, het aantal stukken en snijverlies.",
    },
    {
      question: "Wat is snijverlies?",
      answer:
        "Extra percentage voor rechte snedes, foutjes en het uitlijnen van een dessin. 10% is een veilige start voor effen stof; bij print of strepen reken je meer.",
    },
  ],
};
