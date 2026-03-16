"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const SIZES = [
  { id: "xs", chest: 80, length: 52 },
  { id: "s", chest: 88, length: 54 },
  { id: "m", chest: 96, length: 56 },
  { id: "l", chest: 104, length: 58 },
  { id: "xl", chest: 112, length: 60 },
];

export function TruiconstructieWizard() {
  const [sizeId, setSizeId] = useState("m");
  const [stPerCm, setStPerCm] = useState("");
  const [ease, setEase] = useState("4");

  const spc = parseFloat(stPerCm.replace(",", ".")) || 0;
  const easeCm = parseFloat(ease.replace(",", ".")) || 4;
  const size = SIZES.find((s) => s.id === sizeId);

  let result = "";
  if (size && spc > 0) {
    const chestTotal = size.chest + easeCm;
    const bodyStitches = Math.round(chestTotal * spc);
    const backStitches = Math.round(bodyStitches / 2);
    const frontStitches = Math.round(bodyStitches / 2);
    result = `Lichaam: ${bodyStitches} steken totaal. Achterpand: ${backStitches} st. Voorpand: ${frontStitches} st. Borstomvang + ${easeCm}cm ruimte.`;
  }

  return (
    <CalculatorCard title="Truiconstructie wizard">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Kies maat en gauge voor een eenvoudige trui-berekening. Step-by-step.
        </p>

        <Select
          label="Maat"
          options={SIZES.map((s) => ({
            value: s.id,
            label: `${s.id.toUpperCase()} (borst ${s.chest}cm, lengte ${s.length}cm)`,
          }))}
          value={sizeId}
          onChange={(e) => setSizeId(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken per cm"
            placeholder="bijv. 2"
            value={stPerCm}
            onChange={(e) => setStPerCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Ruimte (cm)"
            placeholder="4"
            value={ease}
            onChange={(e) => setEase(e.target.value)}
          />
        </div>

        {result && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            {result}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
