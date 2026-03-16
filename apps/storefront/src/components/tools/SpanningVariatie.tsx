"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { NEEDLE_SIZES } from "@/lib/tools/needle-sizes";

export function SpanningVariatie() {
  const [targetStPer10cm, setTargetStPer10cm] = useState("");
  const [currentStPer10cm, setCurrentStPer10cm] = useState("");
  const [currentNeedleMm, setCurrentNeedleMm] = useState("");

  const target = parseFloat(targetStPer10cm.replace(",", ".")) || 0;
  const current = parseFloat(currentStPer10cm.replace(",", ".")) || 0;
  const needle = parseFloat(currentNeedleMm.replace(",", ".")) || 0;

  let suggestion = "";
  if (target > 0 && current > 0 && needle > 0) {
    const ratio = target / current;
    const idx = NEEDLE_SIZES.findIndex((e) => Math.abs(e.mm - needle) < 0.01);
    if (ratio > 1.05) {
      const smaller = idx > 0 ? NEEDLE_SIZES[idx - 1] : null;
      suggestion = `Je haalt te weinig steken per cm. Probeer een dunnere naald: ${smaller ? smaller.mm + " mm" : "1 maat kleiner"}.`;
    } else if (ratio < 0.95) {
      const larger = idx >= 0 && idx < NEEDLE_SIZES.length - 1 ? NEEDLE_SIZES[idx + 1] : null;
      suggestion = `Je haalt te veel steken per cm. Probeer een dikkere naald: ${larger ? larger.mm + " mm" : "1 maat groter"}.`;
    } else {
      suggestion = "Je gauge zit in de buurt van het doel. Maak een proeflapje om te bevestigen.";
    }
  }

  return (
    <CalculatorCard title="Spanning variatie">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Je gauge wijkt af van het patroon. Welke naaldmaat kun je proberen om
          dichter bij de gewenste gauge te komen?
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Gewenste steken per 10 cm (patroon)"
            placeholder="bijv. 22"
            value={targetStPer10cm}
            onChange={(e) => setTargetStPer10cm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Jouw steken per 10 cm"
            placeholder="bijv. 20"
            value={currentStPer10cm}
            onChange={(e) => setCurrentStPer10cm(e.target.value)}
          />
        </div>

        <Input
          type="text"
          inputMode="decimal"
          label="Naaldmaat die je nu gebruikt (mm)"
          placeholder="bijv. 4"
          value={currentNeedleMm}
          onChange={(e) => setCurrentNeedleMm(e.target.value)}
        />

        {suggestion && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            {suggestion}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
