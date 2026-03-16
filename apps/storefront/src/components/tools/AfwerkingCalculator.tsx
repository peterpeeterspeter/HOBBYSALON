"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const TYPES = [
  { id: "icord", name: "I-cord", stPerCm: 2.5 },
  { id: "picot", name: "Picotrand", stPerCm: 3 },
  { id: "rib1x1", name: "1×1 ribboord", stPerCm: 2 },
  { id: "rib2x2", name: "2×2 ribboord", stPerCm: 1.8 },
  { id: "garter", name: "Ribbelrand", stPerCm: 2 },
];

export function AfwerkingCalculator() {
  const [typeId, setTypeId] = useState("rib1x1");
  const [widthCm, setWidthCm] = useState("");
  const [stPerCm, setStPerCm] = useState("");

  const w = parseFloat(widthCm.replace(",", ".")) || 0;
  const spc = parseFloat(stPerCm.replace(",", ".")) || 0;
  const type = TYPES.find((t) => t.id === typeId);

  const stitches = type && w > 0
    ? spc > 0
      ? Math.round(w * spc)
      : Math.round(w * type.stPerCm)
    : null;

  return (
    <CalculatorCard title="Afwerking calculator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Hoeveel steken voor een i-cord, picot edge of ribboord?
        </p>

        <Select
          label="Type afwerking"
          options={TYPES.map((t) => ({ value: t.id, label: t.name }))}
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        />

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
            label="Steken per cm (optioneel)"
            placeholder="laat leeg voor schatting"
            value={stPerCm}
            onChange={(e) => setStPerCm(e.target.value)}
          />
        </div>

        {stitches !== null && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            Ca. <strong>{stitches} steken</strong> voor {type?.name} van {w}cm
            breed.
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
