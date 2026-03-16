"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function Kostencalculator() {
  const [pricePerBall, setPricePerBall] = useState("");
  const [numBalls, setNumBalls] = useState("");
  const [extraCosts, setExtraCosts] = useState("");

  const price = parseFloat(pricePerBall.replace(",", ".")) || 0;
  const balls = parseFloat(numBalls.replace(",", ".")) || 0;
  const extra = parseFloat(extraCosts.replace(",", ".")) || 0;

  const yarnTotal = price * balls;
  const total = yarnTotal + extra;

  return (
    <CalculatorCard title="Kostencalculator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hoeveel kost mijn project in garen? Prijs per bol × aantal bollen.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Prijs per bol (€)"
            placeholder="bijv. 6.50"
            value={pricePerBall}
            onChange={(e) => setPricePerBall(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Aantal bollen"
            placeholder="bijv. 5"
            value={numBalls}
            onChange={(e) => setNumBalls(e.target.value)}
          />
        </div>

        <Input
          type="text"
          inputMode="decimal"
          label="Overige kosten (€, optioneel)"
          placeholder="bijv. 3 voor knopen"
          value={extraCosts}
          onChange={(e) => setExtraCosts(e.target.value)}
        />

        {(yarnTotal > 0 || total > 0) && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            {yarnTotal > 0 && (
              <p className="text-[var(--foreground)]">
                <strong>Garen:</strong> €{yarnTotal.toFixed(2)}
              </p>
            )}
            {total > 0 && (
              <p className="text-[var(--foreground)]">
                <strong>Totaal:</strong> €{total.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
