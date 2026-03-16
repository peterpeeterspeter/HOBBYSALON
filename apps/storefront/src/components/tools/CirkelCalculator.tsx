"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function CirkelCalculator() {
  const [startStitches, setStartStitches] = useState("6");
  const [rounds, setRounds] = useState("10");
  const [increasePerRound, setIncreasePerRound] = useState("6");

  const start = parseInt(startStitches, 10) || 6;
  const r = parseInt(rounds, 10) || 10;
  const inc = parseInt(increasePerRound, 10) || 6;

  const stitchesPerRound: number[] = [];
  let s = start;
  for (let i = 0; i < r; i++) {
    stitchesPerRound.push(s);
    s += inc;
  }

  return (
    <CalculatorCard title="Cirkel/ovaal calculator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Aangroei-schema voor een platte haakcirkel. Standaard: 6 steken start,
          6 meerderingen per ronde.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            type="text"
            inputMode="numeric"
            label="Startsteken"
            placeholder="6"
            value={startStitches}
            onChange={(e) => setStartStitches(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Meerderingen per ronde"
            placeholder="6"
            value={increasePerRound}
            onChange={(e) => setIncreasePerRound(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Aantal rondes"
            placeholder="10"
            value={rounds}
            onChange={(e) => setRounds(e.target.value)}
          />
        </div>

        {stitchesPerRound.length > 0 && (
          <div className="rounded-lg bg-[var(--section-alt)] p-4">
            <p className="font-medium text-[var(--foreground)] mb-2">
              Steken per ronde
            </p>
            <div className="flex flex-wrap gap-2">
              {stitchesPerRound.map((n, i) => (
                <span
                  key={i}
                  className="rounded bg-[var(--card)] border border-[var(--border)] px-2 py-1 text-sm"
                >
                  R{i + 1}: {n} st
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
