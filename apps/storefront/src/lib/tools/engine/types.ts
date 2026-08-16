/**
 * Shared types for the formula-driven calculator engine.
 * Definitions are config; formulas are named pure functions (no eval).
 */

export type CalcFieldKind = "number" | "select" | "toggle";

export type CalcField = {
  id: string;
  label: string;
  kind: CalcFieldKind;
  /** Short helper under the field. */
  hint?: string;
  /** Unit shown next to the label (e.g. "cm", "%", "€"). */
  unit?: string;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  /** Required for kind === "select". */
  options?: Array<{ value: string; label: string }>;
};

export type CalcPreset = {
  id: string;
  label: string;
  /** Partial field overrides applied when the preset is clicked. */
  values: Record<string, number | string | boolean>;
};

export type CalcBreakdownRow = {
  label: string;
  value: string;
};

export type MaterialNeed = {
  label: string;
  quantity: number | null;
  unit: string | null;
  /** Search query for /materials and listMaterialsCatalog. */
  query: string;
  domainSlug?: string;
  categoryHint?: string;
};

export type CalcResult = {
  headline: string;
  breakdown: CalcBreakdownRow[];
  explanation?: string;
  materials: MaterialNeed[];
  /** Optional secondary CTA (e.g. workshop break-even → voor-workshopgevers). */
  secondaryCta?: { label: string; href: string };
};

export type FormulaId =
  | "fabric"
  | "quilt"
  | "candle"
  | "resin"
  | "beads"
  | "paper"
  | "workshop_breakeven";

export type CalcInputs = Record<string, number | string | boolean>;

export type FormulaFn = (inputs: CalcInputs) => CalcResult;

export type CalcFaq = {
  question: string;
  answer: string;
};

export type CalcDefinition = {
  formulaId: FormulaId;
  fields: CalcField[];
  presets?: CalcPreset[];
  /** Shown under the result when present. */
  assumptions?: string;
  faqs?: CalcFaq[];
};

export type RunCalcSuccess = {
  ok: true;
  result: CalcResult;
};

export type RunCalcFailure = {
  ok: false;
  error: string;
};

export type RunCalcOutcome = RunCalcSuccess | RunCalcFailure;
