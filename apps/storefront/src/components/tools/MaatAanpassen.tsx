"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const SIZES = [
  { id: "xs", label: "XS", factor: 0.85 },
  { id: "s", label: "S", factor: 0.9 },
  { id: "m", label: "M", factor: 1 },
  { id: "l", label: "L", factor: 1.1 },
  { id: "xl", label: "XL", factor: 1.2 },
  { id: "xxl", label: "XXL", factor: 1.3 },
];

export function MaatAanpassen() {
  const [fromSize, setFromSize] = useState("m");
  const [toSize, setToSize] = useState("l");
  const [stitches, setStitches] = useState("");
  const [rows, setRows] = useState("");
  const [stPerCm, setStPerCm] = useState("");
  const [rowsPerCm, setRowsPerCm] = useState("");

  const st = parseFloat(stitches.replace(",", ".")) || 0;
  const r = parseFloat(rows.replace(",", ".")) || 0;

  const from = SIZES.find((s) => s.id === fromSize);
  const to = SIZES.find((s) => s.id === toSize);
  const scaleFactor = from && to ? to.factor / from.factor : 1;

  const newSt = st > 0 ? Math.round(st * scaleFactor) : null;
  const newRows = r > 0 ? Math.round(r * scaleFactor) : null;

  return (
    <CalculatorCard title="Kledingstuk maat aanpassen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Patroon is voor maat S, jij wilt maat XL. Herbereken steken en rijen
          op basis van een schaalfactor.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Maat in patroon"
            options={SIZES.map((s) => ({ value: s.id, label: s.label }))}
            value={fromSize}
            onChange={(e) => setFromSize(e.target.value)}
          />
          <Select
            label="Gewenste maat"
            options={SIZES.map((s) => ({ value: s.id, label: s.label }))}
            value={toSize}
            onChange={(e) => setToSize(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken (uit patroon)"
            placeholder="bijv. 88"
            value={stitches}
            onChange={(e) => setStitches(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Rijen (uit patroon)"
            placeholder="bijv. 100"
            value={rows}
            onChange={(e) => setRows(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Steken per cm (jouw gauge)"
            placeholder="bijv. 2"
            value={stPerCm}
            onChange={(e) => setStPerCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Rijen per cm"
            placeholder="bijv. 2.8"
            value={rowsPerCm}
            onChange={(e) => setRowsPerCm(e.target.value)}
          />
        </div>

        {newSt !== null && newRows !== null && (newSt > 0 || newRows > 0) && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            <p className="text-[var(--foreground)]">
              <strong>Steken voor maat {to?.label}:</strong> {newSt}
            </p>
            <p className="text-[var(--foreground)]">
              <strong>Rijen voor maat {to?.label}:</strong> {newRows}
            </p>
            <p className="text-sm text-[var(--muted)]">
              Schaalfactor: {scaleFactor.toFixed(2)}×
            </p>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
