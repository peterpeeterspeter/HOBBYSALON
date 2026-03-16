"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function FoundationChain() {
  const [widthCm, setWidthCm] = useState("");
  const [stPerCm, setStPerCm] = useState("");

  const w = parseFloat(widthCm.replace(",", ".")) || 0;
  const spc = parseFloat(stPerCm.replace(",", ".")) || 0;

  const stitches = w > 0 && spc > 0 ? Math.round(w * spc) : null;

  return (
    <CalculatorCard title="Foundation chain calculator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hoeveel steken aanslaan voor een gewenste breedte? Gebaseerd op je
          stekenproef.
        </p>

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
            label="Steken per cm"
            placeholder="bijv. 2"
            value={stPerCm}
            onChange={(e) => setStPerCm(e.target.value)}
          />
        </div>

        {stitches !== null && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            Sla <strong>{stitches} steken</strong> aan voor een breedte van {w}cm.
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
