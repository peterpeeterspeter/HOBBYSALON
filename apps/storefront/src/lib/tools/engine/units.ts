/** Metric-first unit helpers for calculator inputs/outputs. */

export function cmToM(cm: number): number {
  return cm / 100;
}

export function mToCm(m: number): number {
  return m * 100;
}

export function mlToL(ml: number): number {
  return ml / 1000;
}

export function gToKg(g: number): number {
  return g / 1000;
}

export function inchToCm(inch: number): number {
  return inch * 2.54;
}

export function cmToInch(cm: number): number {
  return cm / 2.54;
}

/** Round to `digits` decimal places without floating noise. */
export function roundTo(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Format a number for Dutch UI (comma decimal). */
export function formatNl(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return roundTo(value, digits).toLocaleString("nl-BE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
