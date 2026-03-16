"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function AlternatiefGaren() {
  const [metersA, setMetersA] = useState("");
  const [gramsA, setGramsA] = useState("");
  const [metersB, setMetersB] = useState("");
  const [gramsB, setGramsB] = useState("");
  const [projectMeters, setProjectMeters] = useState("");

  const mA = parseFloat(metersA.replace(",", ".")) || 0;
  const gA = parseFloat(gramsA.replace(",", ".")) || 0;
  const mB = parseFloat(metersB.replace(",", ".")) || 0;
  const gB = parseFloat(gramsB.replace(",", ".")) || 0;
  const project = parseFloat(projectMeters.replace(",", ".")) || 0;

  let result = "";
  if (mA > 0 && gA > 0 && mB > 0 && gB > 0 && project > 0) {
    const metersPerBallA = (mA / 100) * gA;
    const ballsNeededFromA = project / metersPerBallA;
    const totalGramsA = ballsNeededFromA * gA;
    const metersPerBallB = (mB / 100) * gB;
    const ballsNeededFromB = project / metersPerBallB;
    result = `Voor ${project} m heb je ${ballsNeededFromB.toFixed(1)} bolletje(s) van garen B nodig.`;
  }

  return (
    <CalculatorCard title="Alternatief garen berekenen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Het patroon vraagt garen A, maar je wilt garen B gebruiken. Hoeveel
          bolletjes van B heb je nodig?
        </p>

        <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-medium text-[var(--foreground)]">
            Patroongaren (merk A)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="text"
              inputMode="decimal"
              label="Meter per 100g"
              placeholder="bijv. 200"
              value={metersA}
              onChange={(e) => setMetersA(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Gram per bol"
              placeholder="bijv. 50"
              value={gramsA}
              onChange={(e) => setGramsA(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-medium text-[var(--foreground)]">
            Jouw garen (merk B)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="text"
              inputMode="decimal"
              label="Meter per 100g"
              placeholder="bijv. 180"
              value={metersB}
              onChange={(e) => setMetersB(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Gram per bol"
              placeholder="bijv. 100"
              value={gramsB}
              onChange={(e) => setGramsB(e.target.value)}
            />
          </div>
        </div>

        <Input
          type="text"
          inputMode="decimal"
          label="Meter garen nodig voor het project"
          placeholder="bijv. 450"
          value={projectMeters}
          onChange={(e) => setProjectMeters(e.target.value)}
        />

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
