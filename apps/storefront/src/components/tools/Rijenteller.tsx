"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Rijenteller() {
  const [rows, setRows] = useState(0);
  const [stitches, setStitches] = useState(0);
  const [goal, setGoal] = useState("");

  const goalNum = parseInt(goal, 10) || 0;
  const progress =
    goalNum > 0 ? Math.min(100, Math.round((rows / goalNum) * 100)) : null;

  return (
    <CalculatorCard title="Rijenteller">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Klik om je rijen en steken te tellen tijdens het breien of haken.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">
              Rijen
            </p>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRows((r) => Math.max(0, r - 1))}
              >
                −
              </Button>
              <span className="text-2xl font-bold min-w-[4rem] text-center">
                {rows}
              </span>
              <Button
                type="button"
                onClick={() => setRows((r) => r + 1)}
              >
                +
              </Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">
              Steken (optioneel)
            </p>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStitches((s) => Math.max(0, s - 1))}
              >
                −
              </Button>
              <span className="text-2xl font-bold min-w-[4rem] text-center">
                {stitches}
              </span>
              <Button
                type="button"
                onClick={() => setStitches((s) => s + 1)}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <Input
          type="text"
          inputMode="numeric"
          label="Doel aantal rijen (optioneel)"
          placeholder="bijv. 100"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />

        {progress !== null && (
          <div className="rounded-lg bg-[var(--section-alt)] p-4">
            <p className="text-[var(--foreground)]">
              Voortgang: <strong>{progress}%</strong>
            </p>
            <div
              className="mt-2 h-2 rounded-full bg-[var(--border)] overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setRows(0);
            setStitches(0);
          }}
        >
          Reset
        </Button>
      </div>
    </CalculatorCard>
  );
}
