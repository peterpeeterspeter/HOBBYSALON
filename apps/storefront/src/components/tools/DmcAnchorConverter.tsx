"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { dmcToAnchor, anchorToDmc } from "@/lib/tools/dmc-anchor";
import { DMC_COLORS } from "@/lib/tools/dmc-colors";

export function DmcAnchorConverter() {
  const [direction, setDirection] = useState<"dmc" | "anchor">("dmc");
  const [inputValue, setInputValue] = useState("");

  const trimmed = inputValue.trim();

  let result = "";
  let resultColor = "";

  if (direction === "dmc" && trimmed) {
    const anchor = dmcToAnchor(trimmed);
    if (anchor) {
      result = `Anchor equivalent: ${anchor}`;
      const dmc = DMC_COLORS.find(
        (c) => c.code.toUpperCase() === trimmed.toUpperCase()
      );
      resultColor = dmc?.hex ?? "";
    } else {
      result = "Geen Anchor-equivalent gevonden. Probeer een andere DMC-code.";
    }
  } else if (direction === "anchor" && trimmed) {
    const dmc = anchorToDmc(trimmed);
    if (dmc) {
      result = `DMC equivalent: ${dmc}`;
      const c = DMC_COLORS.find(
        (x) => x.code.toUpperCase() === dmc.toUpperCase()
      );
      resultColor = c?.hex ?? "";
    } else {
      result = "Geen DMC-equivalent gevonden. Probeer een andere Anchor-code.";
    }
  }

  return (
    <CalculatorCard title="DMC ↔ Anchor converter">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Zoek het dichtstbijzijnde equivalent in het andere merksysteem.
        </p>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setDirection("dmc")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              direction === "dmc"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            DMC → Anchor
          </button>
          <button
            type="button"
            onClick={() => setDirection("anchor")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              direction === "anchor"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Anchor → DMC
          </button>
        </div>

        <Input
          type="text"
          label={direction === "dmc" ? "DMC-code (bijv. 310)" : "Anchor-code (bijv. 13)"}
          placeholder={direction === "dmc" ? "310" : "13"}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />

        {result && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 flex items-center gap-4"
            role="status"
          >
            {resultColor && (
              <div
                className="h-10 w-10 rounded border border-[var(--border)] shrink-0"
                style={{ backgroundColor: resultColor }}
              />
            )}
            <p className="text-[var(--foreground)]">{result}</p>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
