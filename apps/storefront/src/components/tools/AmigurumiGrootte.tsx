"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function AmigurumiGrootte() {
  const [origHeight, setOrigHeight] = useState("");
  const [targetHeight, setTargetHeight] = useState("");

  const orig = parseFloat(origHeight.replace(",", ".")) || 0;
  const target = parseFloat(targetHeight.replace(",", ".")) || 0;

  const scale = orig > 0 && target > 0 ? target / orig : null;

  return (
    <CalculatorCard title="Amigurumi-grootte aanpassen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Het patroon maakt een pop van X cm. Jij wilt Y cm. Bereken de
          schaalfactor.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Hoogte in patroon (cm)"
            placeholder="bijv. 15"
            value={origHeight}
            onChange={(e) => setOrigHeight(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Gewenste hoogte (cm)"
            placeholder="bijv. 30"
            value={targetHeight}
            onChange={(e) => setTargetHeight(e.target.value)}
          />
        </div>

        {scale !== null && scale > 0 && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            <p className="text-[var(--foreground)]">
              <strong>Schaalfactor:</strong> {scale.toFixed(2)}×
            </p>
            <p className="text-sm text-[var(--muted)]">
              Gebruik dikkere garen + grotere haaknaald, of haak met 2 draden
              samen voor ca. 2× groter. Voor {scale.toFixed(1)}×: probeer{" "}
              {scale >= 1.5 ? "dubbel garen of één dikte zwaarder" : "één haaknaaldmaat groter"}.
            </p>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
