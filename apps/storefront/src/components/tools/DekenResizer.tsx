"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { stitchesForWidth, rowsForHeight } from "@/lib/tools/gauge-formulas";

export function DekenResizer() {
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [stPerCm, setStPerCm] = useState("");
  const [rowsPerCm, setRowsPerCm] = useState("");

  const w = parseFloat(widthCm.replace(",", ".")) || 0;
  const h = parseFloat(heightCm.replace(",", ".")) || 0;
  const spc = parseFloat(stPerCm.replace(",", ".")) || 0;
  const rpc = parseFloat(rowsPerCm.replace(",", ".")) || 0;

  const stitches = w > 0 && spc > 0 ? stitchesForWidth(w, spc) : null;
  const rows = h > 0 && rpc > 0 ? rowsForHeight(h, rpc) : null;

  return (
    <CalculatorCard title="Deken afmeting berekenen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Gegeven de gewenste afmeting van je deken en je stekenproef:
          hoeveel steken en rijen heb je nodig?
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Gewenste breedte (cm)"
            placeholder="bijv. 120"
            value={widthCm}
            onChange={(e) => setWidthCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Gewenste hoogte (cm)"
            placeholder="bijv. 150"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken per cm"
            placeholder="bijv. 1.5"
            value={stPerCm}
            onChange={(e) => setStPerCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Rijen per cm"
            placeholder="bijv. 1.2"
            value={rowsPerCm}
            onChange={(e) => setRowsPerCm(e.target.value)}
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
