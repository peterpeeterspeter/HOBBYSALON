"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function GrannySquarePlanner() {
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [squareCm, setSquareCm] = useState("");
  const [borderRounds, setBorderRounds] = useState("2");

  const w = parseFloat(widthCm.replace(",", ".")) || 0;
  const h = parseFloat(heightCm.replace(",", ".")) || 0;
  const sq = parseFloat(squareCm.replace(",", ".")) || 0;
  const border = parseInt(borderRounds, 10) || 2;

  const squaresX = sq > 0 && w > 0 ? Math.ceil(w / sq) : null;
  const squaresY = sq > 0 && h > 0 ? Math.ceil(h / sq) : null;
  const totalSquares =
    squaresX !== null && squaresY !== null ? squaresX * squaresY : null;

  let result = "";
  if (totalSquares !== null && totalSquares > 0) {
    result = `Je hebt ${squaresX} × ${squaresY} = ${totalSquares} granny squares nodig.`;
    if (border > 0) {
      result += ` Daarna ${border} rondes border haken.`;
    }
  }

  return (
    <CalculatorCard title="Granny square planner">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hoeveel squares en border voor een deken van X bij Y cm?
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
            label="Grootte 1 square (cm)"
            placeholder="bijv. 12"
            value={squareCm}
            onChange={(e) => setSquareCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Rondes border"
            placeholder="2"
            value={borderRounds}
            onChange={(e) => setBorderRounds(e.target.value)}
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
