"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

// DMC floss: ~8m per skein, cross stitch uses ~1.5x for full coverage (thread passes through fabric)
const METERS_PER_SKEIN = 8;
const LENGTH_PER_STITCH_14 = 0.036; // ~3.6cm per kruissteek op 14 count

export function DraadlengteCalculator() {
  const [stitches, setStitches] = useState("");
  const [count, setCount] = useState("14");

  const st = parseInt(stitches, 10) || 0;
  const ct = parseInt(count, 10) || 14;

  const metersPerStitch = LENGTH_PER_STITCH_14 * (14 / ct);
  const totalMeters = st > 0 ? st * metersPerStitch : 0;
  const skeins = totalMeters > 0 ? totalMeters / METERS_PER_SKEIN : 0;

  return (
    <CalculatorCard title="Draadlengte calculator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hoeveel skeins DMC floss nodig per kleur? Gebaseerd op aantal
          kruissteken.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="numeric"
            label="Aantal kruissteken (per kleur)"
            placeholder="bijv. 500"
            value={stitches}
            onChange={(e) => setStitches(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Stof count (aida)"
            placeholder="14"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>

        {skeins > 0 && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            <p className="text-[var(--foreground)]">
              <strong>Draad nodig:</strong> ca. {totalMeters.toFixed(0)} meter
            </p>
            <p className="text-[var(--foreground)]">
              <strong>Skeins DMC:</strong> {Math.ceil(skeins * 1.2)} (neem 20%
              extra)
            </p>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
