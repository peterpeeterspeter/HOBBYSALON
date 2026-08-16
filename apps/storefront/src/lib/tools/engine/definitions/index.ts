import type { CalcDefinition } from "../types";
import { stofcalculatorDefinition } from "./stofcalculator";
import { quiltcalculatorDefinition } from "./quiltcalculator";
import { kaarsenWascalculatorDefinition } from "./kaarsen-wascalculator";
import { resinCalculatorDefinition } from "./resin-calculator";
import { kralenarmbandCalculatorDefinition } from "./kralenarmband-calculator";
import { papierSnijcalculatorDefinition } from "./papier-snijcalculator";
import { workshopBreakEvenDefinition } from "./workshop-break-even";

export const CALC_DEFINITIONS: Record<string, CalcDefinition> = {
  stofcalculator: stofcalculatorDefinition,
  quiltcalculator: quiltcalculatorDefinition,
  "kaarsen-wascalculator": kaarsenWascalculatorDefinition,
  "resin-calculator": resinCalculatorDefinition,
  "kralenarmband-calculator": kralenarmbandCalculatorDefinition,
  "papier-snijcalculator": papierSnijcalculatorDefinition,
  "workshop-break-even": workshopBreakEvenDefinition,
};

export function getCalcDefinition(slug: string): CalcDefinition | undefined {
  return CALC_DEFINITIONS[slug];
}

export {
  stofcalculatorDefinition,
  quiltcalculatorDefinition,
  kaarsenWascalculatorDefinition,
  resinCalculatorDefinition,
  kralenarmbandCalculatorDefinition,
  papierSnijcalculatorDefinition,
  workshopBreakEvenDefinition,
};
