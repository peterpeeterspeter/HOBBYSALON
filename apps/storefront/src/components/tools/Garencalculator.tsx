"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function Garencalculator() {
  const [mode, setMode] = useState<"meters" | "weight">("meters");
  const [projectNeed, setProjectNeed] = useState("");
  const [metersPer100g, setMetersPer100g] = useState("");
  const [gramsPerBall, setGramsPerBall] = useState("");

  const projectNum = parseFloat(projectNeed.replace(",", ".")) || 0;
  const mpg = parseFloat(metersPer100g.replace(",", ".")) || 0;
  const gpb = parseFloat(gramsPerBall.replace(",", ".")) || 0;

  let result = "";
  if (mode === "meters" && projectNum > 0 && mpg > 0 && gpb > 0) {
    const metersPerBall = (mpg / 100) * gpb;
    const balls = projectNum / metersPerBall;
    result = `Je hebt ${balls.toFixed(1)} bolletje(s) nodig (ca. ${Math.ceil(balls)} om zeker te zijn).`;
  } else if (mode === "weight" && projectNum > 0 && mpg > 0 && gpb > 0) {
    const totalMeters = (projectNum / 100) * mpg;
    const balls = (projectNum / gpb);
    result = `Dat komt overeen met ca. ${totalMeters.toFixed(0)} meter garen, of ${balls.toFixed(1)} bolletje(s) van ${gpb}g.`;
  }

  return (
    <CalculatorCard title="Bereken benodigde garen">
      <div className="space-y-6">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode("meters")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "meters"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Ik weet de meter
          </button>
          <button
            type="button"
            onClick={() => setMode("weight")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "weight"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Ik weet het gewicht
          </button>
        </div>

        {mode === "meters" && (
          <>
            <Input
              type="text"
              inputMode="decimal"
              label="Meter garen nodig voor je project"
              placeholder="bijv. 450"
              value={projectNeed}
              onChange={(e) => setProjectNeed(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Meter per 100g (staat op het etiket)"
              placeholder="bijv. 200"
              value={metersPer100g}
              onChange={(e) => setMetersPer100g(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Gewicht per bol (gram)"
              placeholder="bijv. 50"
              value={gramsPerBall}
              onChange={(e) => setGramsPerBall(e.target.value)}
            />
          </>
        )}

        {mode === "weight" && (
          <>
            <Input
              type="text"
              inputMode="decimal"
              label="Gewicht garen nodig (gram)"
              placeholder="bijv. 300"
              value={projectNeed}
              onChange={(e) => setProjectNeed(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Meter per 100g"
              placeholder="bijv. 200"
              value={metersPer100g}
              onChange={(e) => setMetersPer100g(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Gewicht per bol (gram)"
              placeholder="bijv. 50"
              value={gramsPerBall}
              onChange={(e) => setGramsPerBall(e.target.value)}
            />
          </>
        )}

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
