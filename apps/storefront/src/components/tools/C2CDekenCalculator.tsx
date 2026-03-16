"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { c2cTotalBlocks } from "@/lib/tools/gauge-formulas";

export function C2CDekenCalculator() {
  const [mode, setMode] = useState<"blocks" | "size">("blocks");
  const [blockWidthCm, setBlockWidthCm] = useState("");
  const [blockHeightCm, setBlockHeightCm] = useState("");
  const [widthBlocks, setWidthBlocks] = useState("");
  const [heightBlocks, setHeightBlocks] = useState("");
  const [targetWidthCm, setTargetWidthCm] = useState("");
  const [targetHeightCm, setTargetHeightCm] = useState("");

  const bw = parseFloat(blockWidthCm.replace(",", ".")) || 0;
  const bh = parseFloat(blockHeightCm.replace(",", ".")) || 0;
  const wb = parseInt(widthBlocks, 10) || 0;
  const hb = parseInt(heightBlocks, 10) || 0;
  const tw = parseFloat(targetWidthCm.replace(",", ".")) || 0;
  const th = parseFloat(targetHeightCm.replace(",", ".")) || 0;

  let result = "";
  if (mode === "blocks" && bw > 0 && bh > 0 && wb > 0 && hb > 0) {
    const totalBlocks = c2cTotalBlocks(wb, hb);
    const finishW = bw * wb;
    const finishH = bh * hb;
    result = `Je deken wordt ca. ${finishW.toFixed(1)} × ${finishH.toFixed(1)} cm. Totaal ${totalBlocks} C2C-blokken.`;
  } else if (mode === "size" && bw > 0 && bh > 0 && tw > 0 && th > 0) {
    const wBlocks = Math.ceil(tw / bw);
    const hBlocks = Math.ceil(th / bh);
    const totalBlocks = c2cTotalBlocks(wBlocks, hBlocks);
    result = `Je hebt ${wBlocks} × ${hBlocks} = ${totalBlocks} blokken nodig. De deken wordt ca. ${(bw * wBlocks).toFixed(1)} × ${(bh * hBlocks).toFixed(1)} cm.`;
  }

  return (
    <CalculatorCard title="C2C-deken berekenen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Corner-to-corner haken: bereken blokken of afmetingen op basis van je
          proeflapje.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Lengte 1 blok (cm)"
            placeholder="bijv. 2"
            value={blockWidthCm}
            onChange={(e) => setBlockWidthCm(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            label="Breedte 1 blok (cm)"
            placeholder="bijv. 2"
            value={blockHeightCm}
            onChange={(e) => setBlockHeightCm(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode("blocks")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "blocks"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Ik weet het aantal blokken
          </button>
          <button
            type="button"
            onClick={() => setMode("size")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "size"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Ik wil een bepaalde maat
          </button>
        </div>

        {mode === "blocks" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="text"
              inputMode="numeric"
              label="Blokken in de breedte"
              placeholder="bijv. 80"
              value={widthBlocks}
              onChange={(e) => setWidthBlocks(e.target.value)}
            />
            <Input
              type="text"
              inputMode="numeric"
              label="Blokken in de hoogte"
              placeholder="bijv. 100"
              value={heightBlocks}
              onChange={(e) => setHeightBlocks(e.target.value)}
            />
          </div>
        )}

        {mode === "size" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="text"
              inputMode="decimal"
              label="Gewenste breedte (cm)"
              placeholder="bijv. 120"
              value={targetWidthCm}
              onChange={(e) => setTargetWidthCm(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Gewenste hoogte (cm)"
              placeholder="bijv. 150"
              value={targetHeightCm}
              onChange={(e) => setTargetHeightCm(e.target.value)}
            />
          </div>
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
