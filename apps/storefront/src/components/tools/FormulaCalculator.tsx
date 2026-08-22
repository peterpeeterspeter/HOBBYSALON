"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalculatorCard } from "./CalculatorCard";
import { ToolMaterialsSlot } from "./ToolMaterialsSlot";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics/track";
import {
  applyPreset,
  defaultInputs,
  runCalc,
  type CalcDefinition,
  type CalcInputs,
  type CalcResult,
} from "@/lib/tools/engine";

type FormulaCalculatorProps = {
  toolSlug: string;
  title: string;
  definition: CalcDefinition;
};

function inputsToFormValues(inputs: CalcInputs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === "boolean") {
      out[key] = value ? "1" : "0";
    } else {
      out[key] = String(value).replace(".", ",");
    }
  }
  return out;
}

export function FormulaCalculator({
  toolSlug,
  title,
  definition,
}: FormulaCalculatorProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    inputsToFormValues(defaultInputs(definition))
  );
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);

  const outcome = useMemo(() => {
    const raw: Record<string, string | number | boolean> = {};
    for (const field of definition.fields) {
      const v = values[field.id];
      if (field.kind === "toggle") {
        raw[field.id] = v === "1" || v === "true";
      } else {
        raw[field.id] = v ?? "";
      }
    }
    return runCalc(definition, raw);
  }, [definition, values]);

  useEffect(() => {
    if (!outcome.ok) {
      setError(outcome.error);
      setResult(null);
      return;
    }
    setError(null);
    setResult(outcome.result);
  }, [outcome]);

  useEffect(() => {
    if (!result?.headline) return;
    const timer = window.setTimeout(() => {
      trackEvent("tool_calculated", {
        tool_slug: toolSlug,
        formula_id: definition.formulaId,
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [result?.headline, toolSlug, definition.formulaId]);

  function updateField(id: string, next: string) {
    setActivePreset(null);
    setValues((prev) => ({ ...prev, [id]: next }));
  }

  function onPreset(presetId: string) {
    const merged: CalcInputs = { ...defaultInputs(definition) };
    for (const [key, value] of Object.entries(values)) {
      const field = definition.fields.find((f) => f.id === key);
      if (!field) continue;
      if (field.kind === "number") {
        const normalized = value.replace(",", ".");
        const n = Number(normalized);
        if (Number.isFinite(n)) merged[key] = n;
      } else if (field.kind === "toggle") {
        merged[key] = value === "1" || value === "true";
      } else {
        merged[key] = value;
      }
    }
    const applied = applyPreset(definition, merged, presetId);
    setActivePreset(presetId);
    setValues(inputsToFormValues(applied));
  }

  return (
    <CalculatorCard title={title}>
      <div className="space-y-7">
        {definition.presets && definition.presets.length > 0 ? (
          <div>
            <p className="mb-2 text-base font-semibold text-[var(--foreground)]">
              Snelle voorbeelden
            </p>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Tik op een voorbeeld om de velden in te vullen. Je kunt alles daarna
              nog aanpassen.
            </p>
            <div className="flex flex-wrap gap-2">
              {definition.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onPreset(preset.id)}
                  className={`min-h-11 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    activePreset === preset.id
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-[var(--border)] bg-[var(--section-highlight)] text-[var(--foreground)] hover:border-[var(--accent)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-3 text-base font-semibold text-[var(--foreground)]">
            Jouw gegevens
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {definition.fields.map((field) => {
              if (field.kind === "select") {
                return (
                  <label key={field.id} className="flex flex-col gap-1.5">
                    <span className="text-base font-medium text-[var(--foreground)]">
                      {field.label}
                      {field.unit ? (
                        <span className="font-normal text-[var(--muted)]">
                          {" "}
                          ({field.unit})
                        </span>
                      ) : null}
                    </span>
                    <select
                      value={values[field.id] ?? String(field.defaultValue)}
                      onChange={(e) => updateField(field.id, e.target.value)}
                      className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-base text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {field.hint ? (
                      <span className="text-sm text-[var(--muted)]">{field.hint}</span>
                    ) : null}
                  </label>
                );
              }

              if (field.kind === "toggle") {
                return (
                  <label
                    key={field.id}
                    className="inline-flex min-h-12 items-center gap-3 sm:col-span-2"
                  >
                    <input
                      type="checkbox"
                      checked={
                        values[field.id] === "1" || values[field.id] === "true"
                      }
                      onChange={(e) =>
                        updateField(field.id, e.target.checked ? "1" : "0")
                      }
                      className="h-5 w-5 accent-[var(--accent)]"
                    />
                    <span className="text-base font-medium text-[var(--foreground)]">
                      {field.label}
                    </span>
                  </label>
                );
              }

              return (
                <div key={field.id}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    label={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}
                    value={values[field.id] ?? ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                  />
                  {field.hint ? (
                    <p className="mt-1.5 text-sm text-[var(--muted)]">{field.hint}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {result && !error ? (
          <div
            className="rounded-[1rem] border border-[var(--accent)]/25 bg-[var(--section-alt)] p-5 sm:p-6"
            role="status"
          >
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
              Resultaat
            </p>
            <p className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug text-[var(--foreground)] sm:text-3xl">
              {result.headline}
            </p>
            {result.breakdown.length > 0 ? (
              <dl className="mt-5 space-y-2.5 border-t border-[var(--border)]/70 pt-4 text-base">
                {result.breakdown.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                  >
                    <dt className="text-[var(--muted)]">{row.label}</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {result.explanation ? (
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
                {result.explanation}
              </p>
            ) : null}
            {definition.assumptions ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {definition.assumptions}
              </p>
            ) : null}
            {result.secondaryCta ? (
              <p className="mt-4">
                <Link
                  href={result.secondaryCta.href}
                  className="inline-flex min-h-12 items-center rounded-lg bg-[var(--accent)] px-5 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                >
                  {result.secondaryCta.label}
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {result && result.materials.length > 0 ? (
          <ToolMaterialsSlot
            toolSlug={toolSlug}
            formulaId={definition.formulaId}
            materials={result.materials}
          />
        ) : null}
      </div>
    </CalculatorCard>
  );
}
