"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function RaglanBerekening() {
  const [bodyStitches, setBodyStitches] = useState("");
  const [sleeveStitches, setSleeveStitches] = useState("");
  const [raglanLines, setRaglanLines] = useState("4");

  const body = parseInt(bodyStitches, 10) || 0;
  const sleeve = parseInt(sleeveStitches, 10) || 0;
  const lines = parseInt(raglanLines, 10) || 4;

  const totalAtYoke = body + 2 * sleeve;
  const increasesPerRound = lines * 2;
  const roundsToNeck = totalAtYoke / increasesPerRound;

  let result = "";
  if (body > 0 && sleeve > 0 && lines >= 2) {
    result = `Vermeerder ${increasesPerRound} steken per ronde (${lines} raglanlijnen × 2). Bij ${totalAtYoke} steken start je de hals. Ca. ${Math.round(roundsToNeck)} meerderronden tot aan de hals.`;
  }

  return (
    <CalculatorCard title="Raglan/yoke berekening">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hoeveel steken vermeerderen per ronde voor raglan? Op basis van
          lichaams- en mouwsteken.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="numeric"
            label="Lichaamssteken (voor + achter)"
            placeholder="bijv. 120"
            value={bodyStitches}
            onChange={(e) => setBodyStitches(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Mouwsteken (per mouw)"
            placeholder="bijv. 44"
            value={sleeveStitches}
            onChange={(e) => setSleeveStitches(e.target.value)}
          />
        </div>

        <Input
          type="text"
          inputMode="numeric"
          label="Aantal raglanlijnen"
          placeholder="4"
          value={raglanLines}
          onChange={(e) => setRaglanLines(e.target.value)}
        />

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
