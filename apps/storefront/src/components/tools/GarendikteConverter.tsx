"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Nm = meter per gram (length/weight)
// Tex = gram per 1000m (weight/length * 1000)
// Denier = gram per 9000m
// Td = tex met decimaal
// Nm = 1000/Tex, Tex = 1000/Nm
// Denier = Tex * 9, Tex = Denier/9
function convertYarnSize(
  value: number,
  from: "Nm" | "Tex" | "Denier"
): { Nm: number; Tex: number; Denier: number } {
  let tex = 0;
  if (from === "Nm") tex = value > 0 ? 1000 / value : 0;
  else if (from === "Tex") tex = value;
  else if (from === "Denier") tex = value / 9;
  const nm = tex > 0 ? 1000 / tex : 0;
  const denier = tex * 9;
  return { Nm: nm, Tex: tex, Denier: denier };
}

export function GarendikteConverter() {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"Nm" | "Tex" | "Denier">("Nm");

  const num = parseFloat(value.replace(",", ".")) || 0;
  const converted = num > 0 ? convertYarnSize(num, unit) : null;

  return (
    <CalculatorCard title="Garendikte omrekenen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Omrekenen tussen Nm (nummer metrisch), Tex en Denier. Handig voor
          naaigaren en industrieel garen.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Waarde"
            placeholder={unit === "Nm" ? "bijv. 40" : unit === "Tex" ? "bijv. 25" : "bijv. 225"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Select
            label="Eenheid"
            options={[
              { value: "Nm", label: "Nm (meter per gram)" },
              { value: "Tex", label: "Tex (g per 1000m)" },
              { value: "Denier", label: "Denier (g per 9000m)" },
            ]}
            value={unit}
            onChange={(e) => setUnit(e.target.value as "Nm" | "Tex" | "Denier")}
          />
        </div>

        {converted && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            <p className="text-[var(--foreground)]">
              <strong>Nm:</strong> {converted.Nm.toFixed(1)} (meter per gram)
            </p>
            <p className="text-[var(--foreground)]">
              <strong>Tex:</strong> {converted.Tex.toFixed(1)} (g per 1000m)
            </p>
            <p className="text-[var(--foreground)]">
              <strong>Denier:</strong> {converted.Denier.toFixed(0)} (g per 9000m)
            </p>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
