"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type YarnInput = { metersPer100g: string; ratio: string };

function parseNum(s: string): number {
  return parseFloat(s.replace(",", ".")) || 0;
}

export function Garencombinator() {
  const [yarns, setYarns] = useState<YarnInput[]>([
    { metersPer100g: "", ratio: "1" },
    { metersPer100g: "", ratio: "1" },
  ]);

  const addYarn = () => {
    setYarns([...yarns, { metersPer100g: "", ratio: "1" }]);
  };

  const updateYarn = (i: number, field: keyof YarnInput, value: string) => {
    const next = [...yarns];
    next[i] = { ...next[i]!, [field]: value };
    setYarns(next);
  };

  const removeYarn = (i: number) => {
    if (yarns.length <= 2) return;
    setYarns(yarns.filter((_, j) => j !== i));
  };

  // Gecombineerd gewicht per meter: als je 1 draad A (mpg_A) en 1 draad B (mpg_B) combineert
  // dan heb je per meter: 100/mpg_A + 100/mpg_B gram totaal
  // Gegeneraliseerd: sum(ratio_i / mpg_i) * 100 = gram per 100m gecombineerd
  let result = "";
  const valid = yarns.every(
    (y) => parseNum(y.metersPer100g) > 0 && parseNum(y.ratio) >= 0
  );
  if (valid) {
    let gramPer100m = 0;
    for (const y of yarns) {
      const mpg = parseNum(y.metersPer100g);
      const r = parseNum(y.ratio) || 1;
      gramPer100m += (r * 100) / mpg;
    }
    const metersPer100gCombined = gramPer100m > 0 ? 10000 / gramPer100m : 0;
    result = `Gecombineerd garen: ca. ${metersPer100gCombined.toFixed(0)} meter per 100g (of ${(100 / metersPer100gCombined).toFixed(1)}g per 100m).`;
  }

  return (
    <CalculatorCard title="Combineer garens">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Combineer 2 of meer garens en bereken het gecombineerde gewicht per
          meter.
        </p>

        {yarns.map((y, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--border)] p-4"
          >
            <Input
              type="text"
              inputMode="decimal"
              label={`Garen ${i + 1}: meter per 100g`}
              placeholder="bijv. 200"
              value={y.metersPer100g}
              onChange={(e) => updateYarn(i, "metersPer100g", e.target.value)}
              className="flex-1 min-w-[120px]"
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Aantal draden"
              placeholder="1"
              value={y.ratio}
              onChange={(e) => updateYarn(i, "ratio", e.target.value)}
              className="w-24"
            />
            {yarns.length > 2 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => removeYarn(i)}
              >
                Verwijder
              </Button>
            )}
          </div>
        ))}

        <Button type="button" variant="secondary" onClick={addYarn}>
          + Garen toevoegen
        </Button>

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
