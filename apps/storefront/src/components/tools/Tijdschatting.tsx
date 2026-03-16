"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function Tijdschatting() {
  const [stitchesPerHour, setStitchesPerHour] = useState("");
  const [totalStitches, setTotalStitches] = useState("");

  const sph = parseFloat(stitchesPerHour.replace(",", ".")) || 0;
  const total = parseFloat(totalStitches.replace(",", ".")) || 0;

  const hours = sph > 0 && total > 0 ? total / sph : null;
  const formatted =
    hours !== null && hours > 0
      ? hours < 1
        ? `${Math.round(hours * 60)} minuten`
        : hours < 24
          ? `${hours.toFixed(1)} uur`
          : `${(hours / 24).toFixed(1)} dagen (bij ${sph} st/uur)`
      : "";

  return (
    <CalculatorCard title="Tijdschatting">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Steken per uur × totaal steken → geschatte projectduur.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken per uur (jouw tempo)"
            placeholder="bijv. 200"
            value={stitchesPerHour}
            onChange={(e) => setStitchesPerHour(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Totaal aantal steken"
            placeholder="bijv. 50000"
            value={totalStitches}
            onChange={(e) => setTotalStitches(e.target.value)}
          />
        </div>

        {formatted && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            Geschatte duur: <strong>{formatted}</strong>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
