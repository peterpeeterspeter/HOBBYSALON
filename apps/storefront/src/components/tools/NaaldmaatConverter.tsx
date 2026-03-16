"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NEEDLE_SIZES } from "@/lib/tools/needle-sizes";

type InputUnit = "mm" | "us" | "uk";

export function NaaldmaatConverter() {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<InputUnit>("mm");

  const num = parseFloat(value.replace(",", "."));
  let results: Array<{ label: string; value: string }> = [];

  if (value && !Number.isNaN(num)) {
    const found =
      unit === "mm"
        ? NEEDLE_SIZES.find((e) => Math.abs(e.mm - num) < 0.01)
        : unit === "us"
          ? NEEDLE_SIZES.find((e) => e.us !== null && Math.abs(e.us - num) < 0.01)
          : NEEDLE_SIZES.find((e) => e.uk !== null && Math.abs(e.uk - num) < 0.01);

    if (found) {
      if (found.mm != null)
        results.push({ label: "mm", value: found.mm.toString() });
      if (found.us != null)
        results.push({ label: "US", value: found.us.toString() });
      if (found.uk != null)
        results.push({ label: "UK", value: found.uk.toString() });
    } else {
      // Interpolate for mm input
      if (unit === "mm") {
        const prev = NEEDLE_SIZES.filter((e) => e.mm < num).pop();
        const next = NEEDLE_SIZES.find((e) => e.mm > num);
        if (prev && next) {
          results.push({ label: "mm", value: num.toFixed(1) });
          if (prev.us != null && next.us != null)
            results.push({ label: "US (geschat)", value: "~" + Math.round((prev.us + next.us) / 2) });
          if (prev.uk != null && next.uk != null)
            results.push({ label: "UK (geschat)", value: "~" + Math.round((prev.uk + next.uk) / 2) });
        }
      }
    }
  }

  return (
    <CalculatorCard title="Omrekenen">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Waarde"
            placeholder={unit === "mm" ? "bijv. 4" : unit === "us" ? "bijv. 6" : "bijv. 8"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Select
            label="Eenheid"
            options={[
              { value: "mm", label: "mm (metrisch)" },
              { value: "us", label: "US" },
              { value: "uk", label: "UK" },
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
              Gelijkwaardige naaldmaten:
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
            Volledige naaldmaattabel
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 text-left">mm</th>
                  <th className="py-2 text-left">US</th>
                  <th className="py-2 text-left">UK</th>
                </tr>
              </thead>
              <tbody>
                {NEEDLE_SIZES.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="py-1.5">{row.mm}</td>
                    <td className="py-1.5">{row.us ?? "–"}</td>
                    <td className="py-1.5">{row.uk ?? "–"}</td>
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
