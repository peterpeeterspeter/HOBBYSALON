import type { CalcDefinition } from "../types";

export const resinCalculatorDefinition: CalcDefinition = {
  formulaId: "resin",
  assumptions:
    "Reken iets extra voor resten in de beker. Houd rekening met krimp en de mengverhouding op jouw fles.",
  fields: [
    {
      id: "shape",
      label: "Vorm",
      kind: "select",
      defaultValue: "rect",
      options: [
        { value: "rect", label: "Rechthoek / vierkant" },
        { value: "cylinder", label: "Cilinder / pot" },
      ],
    },
    {
      id: "length_cm",
      label: "Lengte",
      kind: "number",
      unit: "cm",
      defaultValue: 10,
      min: 0.5,
      max: 100,
      hint: "Alleen voor rechthoek.",
    },
    {
      id: "width_cm",
      label: "Breedte",
      kind: "number",
      unit: "cm",
      defaultValue: 10,
      min: 0.5,
      max: 100,
      hint: "Alleen voor rechthoek.",
    },
    {
      id: "diameter_cm",
      label: "Diameter",
      kind: "number",
      unit: "cm",
      defaultValue: 8,
      min: 0.5,
      max: 100,
      hint: "Alleen voor cilinder.",
    },
    {
      id: "height_cm",
      label: "Hoogte / dikte",
      kind: "number",
      unit: "cm",
      defaultValue: 1,
      min: 0.1,
      max: 50,
    },
    {
      id: "ratio_a",
      label: "Deel A (hars)",
      kind: "number",
      defaultValue: 1,
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    {
      id: "ratio_b",
      label: "Deel B (harder)",
      kind: "number",
      defaultValue: 1,
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    {
      id: "output_mode",
      label: "Resultaat in",
      kind: "select",
      defaultValue: "volume",
      options: [
        { value: "volume", label: "Volume (ml)" },
        { value: "weight", label: "Gewicht (g)" },
      ],
    },
    {
      id: "density_g_ml",
      label: "Dichtheid mengsel",
      kind: "number",
      unit: "g/ml",
      defaultValue: 1.1,
      min: 0.8,
      max: 1.5,
      step: 0.01,
      hint: "Alleen nodig bij gewicht.",
    },
  ],
  presets: [
    {
      id: "ratio-1-1",
      label: "1:1",
      values: { ratio_a: 1, ratio_b: 1 },
    },
    {
      id: "ratio-2-1",
      label: "2:1",
      values: { ratio_a: 2, ratio_b: 1 },
    },
    {
      id: "coaster",
      label: "Onderzetter 10×10×0,5",
      values: {
        shape: "rect",
        length_cm: 10,
        width_cm: 10,
        height_cm: 0.5,
      },
    },
  ],
  faqs: [
    {
      question: "Hoe bereken ik hoeveel resin ik nodig heb?",
      answer:
        "Bereken eerst het volume van de mal (lengte × breedte × hoogte in cm = ml). Verdeel daarna over A en B volgens de mengverhouding.",
    },
    {
      question: "Wanneer reken ik in gram?",
      answer:
        "Als je op een weegschaal mengt: vermenigvuldig het volume met de dichtheid van het mengsel en splits daarna A en B.",
    },
  ],
};
