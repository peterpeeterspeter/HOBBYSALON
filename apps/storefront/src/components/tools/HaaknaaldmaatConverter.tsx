"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { HOOK_SIZES } from "@/lib/tools/hook-sizes";

type InputUnit = "mm" | "us";

export function HaaknaaldmaatConverter() {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<InputUnit>("mm");

  const num = parseFloat(value.replace(",", "."));
  const letter = value.trim().toUpperCase();

  let results: Array<{ label: string; value: string }> = [];

  if (value) {
    if (unit === "mm" && !Number.isNaN(num)) {
      const found = HOOK_SIZES.find((e) => Math.abs(e.mm - num) < 0.01);
      if (found) {
        results.push({ label: "mm", value: found.mm.toString() });
        if (found.usLetter) results.push({ label: "US", value: found.usLetter });
        else results.push({ label: "US", value: "–" });
      } else {
        const prev = HOOK_SIZES.filter((e) => e.mm < num).pop();
        const next = HOOK_SIZES.find((e) => e.mm > num);
        results.push({ label: "mm", value: num.toFixed(1) });
        if (prev?.usLetter || next?.usLetter)
          results.push({ label: "US (geschat)", value: prev?.usLetter ?? next?.usLetter ?? "–" });
      }
    } else if (unit === "us" && letter) {
      const found = HOOK_SIZES.find(
        (e) =>
          e.usLetter &&
          e.usLetter.toUpperCase().replace("/", "").includes(letter)
      );
      if (found) {
        results.push({ label: "mm", value: found.mm.toString() });
        results.push({ label: "US", value: found.usLetter ?? "–" });
      }
    }
  }

  return (
    <CalculatorCard title="Omrekenen haaknaald">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode={unit === "mm" ? "decimal" : "text"}
            label="Waarde"
            placeholder={unit === "mm" ? "bijv. 4" : "bijv. H of G"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Select
            label="Eenheid"
            options={[
              { value: "mm", label: "mm (metrisch)" },
              { value: "us", label: "US (letter)" },
            ]}
            value={unit}
            onChange={(e) => setUnit(e.target.value as InputUnit)}
          />
        </div>

        {results.length > 0 && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4"
            role="status"
          >
            <p className="text-sm font-medium text-[var(--muted)] mb-2">
              Gelijkwaardige haaknaaldmaat:
            </p>
            <div className="flex flex-wrap gap-3">
              {results.map((r) => (
                <span
                  key={r.label}
                  className="rounded-full bg-[var(--card)] border border-[var(--border)] px-4 py-2 text-[var(--foreground)]"
                >
                  <strong>{r.label}:</strong> {r.value}
                </span>
              ))}
            </div>
          </div>
        )}

        <details className="rounded-lg border border-[var(--border)] p-4">
          <summary className="cursor-pointer font-medium text-[var(--foreground)]">
            Haaknaaldmaattabel
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 text-left">mm</th>
                  <th className="py-2 text-left">US</th>
                </tr>
              </thead>
              <tbody>
                {HOOK_SIZES.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="py-1.5">{row.mm}</td>
                    <td className="py-1.5">{row.usLetter ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </CalculatorCard>
  );
}
