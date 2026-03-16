"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function RestgarenCalculator() {
  const [weight, setWeight] = useState("");
  const [metersPer100g, setMetersPer100g] = useState("");

  const w = parseFloat(weight.replace(",", ".")) || 0;
  const mpg = parseFloat(metersPer100g.replace(",", ".")) || 0;

  const meters = w > 0 && mpg > 0 ? (w / 100) * mpg : null;

  return (
    <CalculatorCard title="Hoeveel meter in mijn restbolletje?">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Weeg je restbolletje en bereken hoeveel meter er nog in zit (gewicht ×
          meter per gram).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Gewicht restbol (gram)"
            placeholder="bijv. 35"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Meter per 100g (van etiket)"
            placeholder="bijv. 200"
            value={metersPer100g}
            onChange={(e) => setMetersPer100g(e.target.value)}
          />
        </div>

        {meters !== null && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            Er zit nog ca. <strong>{Math.round(meters)} meter</strong> in je
            restbolletje.
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
