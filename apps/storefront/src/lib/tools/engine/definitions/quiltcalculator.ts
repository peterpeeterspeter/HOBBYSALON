import type { CalcDefinition } from "../types";

export const quiltcalculatorDefinition: CalcDefinition = {
  formulaId: "quilt",
  assumptions:
    "Blokstof is een oppervlakteschatting. Voor strippiecing of scrap quilts kan je minder of meer nodig hebben.",
  fields: [
    {
      id: "quilt_width_cm",
      label: "Quiltbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 150,
      min: 20,
      max: 400,
    },
    {
      id: "quilt_height_cm",
      label: "Quilthoogte",
      kind: "number",
      unit: "cm",
      defaultValue: 200,
      min: 20,
      max: 400,
    },
    {
      id: "block_width_cm",
      label: "Blokbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 30,
      min: 5,
      max: 100,
    },
    {
      id: "block_height_cm",
      label: "Blokhoogte",
      kind: "number",
      unit: "cm",
      defaultValue: 30,
      min: 5,
      max: 100,
    },
    {
      id: "fabric_width_cm",
      label: "Stofbreedte",
      kind: "number",
      unit: "cm",
      defaultValue: 110,
      min: 50,
      max: 320,
    },
    {
      id: "waste_pct",
      label: "Snijverlies blokstof",
      kind: "number",
      unit: "%",
      defaultValue: 10,
      min: 0,
      max: 40,
    },
    {
      id: "backing_extra_cm",
      label: "Extra backing (per kant)",
      kind: "number",
      unit: "cm",
      defaultValue: 20,
      min: 0,
      max: 50,
    },
    {
      id: "binding_strip_cm",
      label: "Bindingstrook breedte",
      kind: "number",
      unit: "cm",
      defaultValue: 6,
      min: 2,
      max: 15,
    },
    {
      id: "binding_seam_cm",
      label: "Naadtoeslag binding",
      kind: "number",
      unit: "cm",
      defaultValue: 1,
      min: 0,
      max: 3,
    },
  ],
  presets: [
    {
      id: "baby",
      label: "Babyquilt 80×100",
      values: { quilt_width_cm: 80, quilt_height_cm: 100, block_width_cm: 20, block_height_cm: 20 },
    },
    {
      id: "throw",
      label: "Throw 150×200",
      values: { quilt_width_cm: 150, quilt_height_cm: 200, block_width_cm: 30, block_height_cm: 30 },
    },
    {
      id: "bed",
      label: "Tweepersoons 220×240",
      values: { quilt_width_cm: 220, quilt_height_cm: 240, block_width_cm: 30, block_height_cm: 30 },
    },
  ],
  faqs: [
    {
      question: "Hoeveel blokken heb ik nodig voor mijn quilt?",
      answer:
        "Deel de quiltbreedte en -hoogte door de blokafmeting en rond naar boven af. Vermenigvuldig beide resultaten.",
    },
    {
      question: "Hoeveel backing heb ik nodig?",
      answer:
        "Neem de quiltmaten plus extra aan elke kant (vaak 15–20 cm) zodat je comfortabel kunt quilten.",
    },
  ],
};
