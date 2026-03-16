"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { stitchesForWidth, rowsForHeight } from "@/lib/tools/gauge-formulas";

export function StekenproefCalculator() {
  const [stitchesPerCm, setStitchesPerCm] = useState("");
  const [rowsPerCm, setRowsPerCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");

  const spc = parseFloat(stitchesPerCm.replace(",", ".")) || 0;
  const rpc = parseFloat(rowsPerCm.replace(",", ".")) || 0;
  const w = parseFloat(widthCm.replace(",", ".")) || 0;
  const h = parseFloat(heightCm.replace(",", ".")) || 0;

  const stitches = spc > 0 && w > 0 ? stitchesForWidth(w, spc) : null;
  const rows = rpc > 0 && h > 0 ? rowsForHeight(h, rpc) : null;

  return (
    <CalculatorCard title="Bereken steken en rijen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Vul je stekenproef in (uit je proeflapje) en de gewenste afmetingen.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken per cm"
            placeholder="bijv. 2.5"
            value={stitchesPerCm}
            onChange={(e) => setStitchesPerCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Rijen per cm"
            placeholder="bijv. 3.2"
            value={rowsPerCm}
            onChange={(e) => setRowsPerCm(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Gewenste breedte (cm)"
            placeholder="bijv. 40"
            value={widthCm}
            onChange={(e) => setWidthCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Gewenste hoogte (cm)"
            placeholder="bijv. 60"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>

        {(stitches !== null || rows !== null) && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            {stitches !== null && (
              <p className="text-[var(--foreground)]">
                <strong>Steken om aan te slaan:</strong> {stitches}
              </p>
            )}
            {rows !== null && (
              <p className="text-[var(--foreground)]">
                <strong>Rijen te breien/haken:</strong> {rows}
              </p>
            )}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
