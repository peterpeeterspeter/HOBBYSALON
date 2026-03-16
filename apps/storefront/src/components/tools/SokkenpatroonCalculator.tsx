"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function SokkenpatroonCalculator() {
  const [footLength, setFootLength] = useState("");
  const [footCircumference, setFootCircumference] = useState("");
  const [stPerCm, setStPerCm] = useState("");
  const [rowsPerCm, setRowsPerCm] = useState("");

  const fl = parseFloat(footLength.replace(",", ".")) || 0;
  const fc = parseFloat(footCircumference.replace(",", ".")) || 0;
  const spc = parseFloat(stPerCm.replace(",", ".")) || 0;
  const rpc = parseFloat(rowsPerCm.replace(",", ".")) || 0;

  let result = "";
  if (fl > 0 && fc > 0 && spc > 0 && rpc > 0) {
    const cuffStitches = Math.round(fc * spc * 0.9);
    const heelFlapRows = Math.round((fc / 2) * rpc);
    const toeDecreaseStart = Math.round(fl * rpc * 0.9);
    result = `Schacht: ${cuffStitches} steken. Hielflap: ca. ${heelFlapRows} rijen. Start teenvorming na ca. ${toeDecreaseStart} rijen.`;
  }

  return (
    <CalculatorCard title="Sokkenpatroon calculator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hielbreedte, neus, schacht berekenen op basis van voetmaat en gauge.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Voetlengte (cm)"
            placeholder="bijv. 24"
            value={footLength}
            onChange={(e) => setFootLength(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Voetomtrek (cm)"
            placeholder="bijv. 22"
            value={footCircumference}
            onChange={(e) => setFootCircumference(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken per cm"
            placeholder="bijv. 2.5"
            value={stPerCm}
            onChange={(e) => setStPerCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Rijen per cm"
            placeholder="bijv. 3.5"
            value={rowsPerCm}
            onChange={(e) => setRowsPerCm(e.target.value)}
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
