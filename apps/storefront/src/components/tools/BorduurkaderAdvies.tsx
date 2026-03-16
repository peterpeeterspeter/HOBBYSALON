"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function BorduurkaderAdvies() {
  const [patternW, setPatternW] = useState("");
  const [patternH, setPatternH] = useState("");
  const [count, setCount] = useState("14");
  const [margin, setMargin] = useState("5");

  const pw = parseFloat(patternW.replace(",", ".")) || 0;
  const ph = parseFloat(patternH.replace(",", ".")) || 0;
  const ct = parseFloat(count.replace(",", ".")) || 14;
  const m = parseFloat(margin.replace(",", ".")) || 5;

  const sizeW = ct > 0 && pw > 0 ? pw / ct * 2.54 + 2 * m : null; // steken / count = inches, *2.54 = cm
  const sizeH = ct > 0 && ph > 0 ? ph / ct * 2.54 + 2 * m : null;

  return (
    <CalculatorCard title="Borduurkader maat advisor">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Advies over kadergrootte op basis van patroondimensies.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Patroonbreedte (steken)"
            placeholder="bijv. 100"
            value={patternW}
            onChange={(e) => setPatternW(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Patroonhoogte (steken)"
            placeholder="bijv. 80"
            value={patternH}
            onChange={(e) => setPatternH(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Stof count"
            placeholder="14"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Marge rondom (cm)"
            placeholder="5"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
          />
        </div>

        {sizeW !== null && sizeH !== null && sizeW > 0 && sizeH > 0 && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            Kies een kader van minimaal{" "}
            <strong>{Math.ceil(sizeW)} × {Math.ceil(sizeH)} cm</strong> (incl.{" "}
            {m}cm marge).
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
