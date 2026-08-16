import type { CalcInputs, CalcResult, FormulaFn } from "../types";
import { asNumber } from "../parse";
import { formatNl } from "../units";

/**
 * Workshop break-even:
 * n = ceil(fixed / (price - variable)) when contribution > 0
 * profit at chosen attendees = n × contribution − fixed
 */
export const workshopBreakevenFormula: FormulaFn = (
  inputs: CalcInputs
): CalcResult => {
  const fixed = asNumber(inputs, "fixed_costs");
  const price = asNumber(inputs, "price_pp");
  const variable = asNumber(inputs, "variable_pp");
  const attendees = Math.max(0, Math.floor(asNumber(inputs, "attendees", 0)));

  if (fixed < 0 || price <= 0) {
    return {
      headline: "Vul vaste kosten en prijs per deelnemer in.",
      breakdown: [],
      materials: [],
    };
  }

  const contribution = price - variable;
  if (contribution <= 0) {
    return {
      headline:
        "De prijs per deelnemer dekt de variabele kosten niet. Verhoog de prijs of verlaag de kosten per persoon.",
      breakdown: [
        { label: "Prijs pp", value: `€ ${formatNl(price, 2)}` },
        { label: "Variabele kosten pp", value: `€ ${formatNl(variable, 2)}` },
        {
          label: "Contributiemarge",
          value: `€ ${formatNl(contribution, 2)}`,
        },
      ],
      materials: [],
      secondaryCta: {
        label: "Bekijk tips voor workshopgevers",
        href: "/voor-workshopgevers",
      },
    };
  }

  const breakEven = Math.ceil(fixed / contribution);
  const n = attendees > 0 ? attendees : breakEven;
  const profit = n * contribution - fixed;

  return {
    headline: `Break-even bij ${breakEven} deelnemer${breakEven === 1 ? "" : "s"}.`,
    breakdown: [
      { label: "Vaste kosten", value: `€ ${formatNl(fixed, 2)}` },
      { label: "Prijs pp", value: `€ ${formatNl(price, 2)}` },
      { label: "Variabele kosten pp", value: `€ ${formatNl(variable, 2)}` },
      {
        label: "Contributiemarge pp",
        value: `€ ${formatNl(contribution, 2)}`,
      },
      {
        label:
          attendees > 0
            ? `Winst bij ${attendees} deelnemers`
            : `Winst bij break-even (${breakEven})`,
        value: `€ ${formatNl(profit, 2)}`,
      },
    ],
    explanation:
      "Break-even = ceil(vaste kosten ÷ (prijs − variabele kosten per persoon)). Vul optioneel een deelnemersaantal in om de winst te zien.",
    materials: [],
    secondaryCta: {
      label: "Plaats je workshop op Hobbysalon",
      href: "/voor-workshopgevers",
    },
  };
};
