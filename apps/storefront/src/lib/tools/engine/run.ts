import type {
  CalcDefinition,
  CalcField,
  CalcInputs,
  RunCalcOutcome,
} from "./types";
import { FORMULAS } from "./formulas/index";
import { parseNlNumber } from "./parse";

function validateAndNormalize(
  definition: CalcDefinition,
  raw: Record<string, string | number | boolean>
): { ok: true; inputs: CalcInputs } | { ok: false; error: string } {
  const inputs: CalcInputs = {};

  for (const field of definition.fields) {
    const rawValue = raw[field.id];
    const value =
      rawValue === undefined || rawValue === null || rawValue === ""
        ? field.defaultValue
        : rawValue;

    if (field.kind === "number") {
      const n =
        typeof value === "number"
          ? value
          : parseNlNumber(typeof value === "string" ? value : String(value));
      if (n === null) {
        return { ok: false, error: `Vul een geldig getal in bij “${field.label}”.` };
      }
      if (field.min !== undefined && n < field.min) {
        return {
          ok: false,
          error: `“${field.label}” moet minstens ${field.min} zijn.`,
        };
      }
      if (field.max !== undefined && n > field.max) {
        return {
          ok: false,
          error: `“${field.label}” mag hoogstens ${field.max} zijn.`,
        };
      }
      inputs[field.id] = n;
      continue;
    }

    if (field.kind === "toggle") {
      if (typeof value === "boolean") {
        inputs[field.id] = value;
      } else if (typeof value === "string") {
        inputs[field.id] = ["1", "true", "ja", "yes", "on"].includes(
          value.toLowerCase()
        );
      } else {
        inputs[field.id] = Boolean(value);
      }
      continue;
    }

    // select
    const str = String(value);
    const allowed = field.options?.map((o) => o.value) ?? [];
    if (allowed.length > 0 && !allowed.includes(str)) {
      return {
        ok: false,
        error: `Ongeldige keuze bij “${field.label}”.`,
      };
    }
    inputs[field.id] = str;
  }

  return { ok: true, inputs };
}

export function defaultInputs(definition: CalcDefinition): CalcInputs {
  const inputs: CalcInputs = {};
  for (const field of definition.fields) {
    inputs[field.id] = field.defaultValue;
  }
  return inputs;
}

export function applyPreset(
  definition: CalcDefinition,
  current: CalcInputs,
  presetId: string
): CalcInputs {
  const preset = definition.presets?.find((p) => p.id === presetId);
  if (!preset) return current;
  return { ...current, ...preset.values };
}

export function runCalc(
  definition: CalcDefinition,
  raw: Record<string, string | number | boolean>
): RunCalcOutcome {
  const validated = validateAndNormalize(definition, raw);
  if (!validated.ok) {
    return validated;
  }

  const formula = FORMULAS[definition.formulaId];
  if (!formula) {
    return { ok: false, error: "Onbekende formule." };
  }

  try {
    const result = formula(validated.inputs);
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Berekening mislukt. Controleer je invoer." };
  }
}

export function fieldById(
  definition: CalcDefinition,
  id: string
): CalcField | undefined {
  return definition.fields.find((f) => f.id === id);
}
