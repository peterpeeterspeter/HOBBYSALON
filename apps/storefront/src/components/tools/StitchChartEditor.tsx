"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CELL_SYMBOLS = [" ", "▬", "V", "·", "×", "○", "▭"];
const CELL_LABELS = ["leeg", "rechtdoor", "omgekeerd", "patroon", "haak", "lus", "blok"];

export function StitchChartEditor() {
  const [cols, setCols] = useState(10);
  const [rows, setRows] = useState(10);
  const [grid, setGrid] = useState<string[][]>([]);
  const [selectedSym, setSelectedSym] = useState(0);
  const [initDone, setInitDone] = useState(false);

  if (!initDone) {
    const newGrid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(CELL_SYMBOLS[0]));
    setGrid(newGrid);
    setInitDone(true);
  }

  const handleResize = () => {
    const newGrid = Array(rows)
      .fill(null)
      .map((_, i) =>
        Array(cols)
          .fill(null)
          .map((_, j) => grid[i]?.[j] ?? CELL_SYMBOLS[0])
      );
    setGrid(newGrid);
  };

  const toggleCell = (r: number, c: number) => {
    const sym = CELL_SYMBOLS[selectedSym];
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r]![c] = sym;
      return next;
    });
  };

  return (
    <CalculatorCard title="Stekenpatroon tekenen">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Teken je eigen stekenpatroon in een rooster. Klik op een vakje om een
          symbool te plaatsen.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <Input
            type="text"
            inputMode="numeric"
            label="Breedte (vakjes)"
            value={String(cols)}
            onChange={(e) => setCols(Math.max(4, parseInt(e.target.value) || 10))}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Hoogte (vakjes)"
            value={String(rows)}
            onChange={(e) => setRows(Math.max(4, parseInt(e.target.value) || 10))}
          />
          <Button type="button" variant="secondary" onClick={handleResize}>
            Afmeting aanpassen
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">
            Symbool kiezen
          </p>
          <div className="flex flex-wrap gap-2">
            {CELL_SYMBOLS.map((sym, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedSym(i)}
                className={`min-h-[44px] min-w-[44px] rounded border text-xl ${
                  selectedSym === i
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] hover:bg-[var(--section-alt)]"
                }`}
                title={CELL_LABELS[i]}
              >
                {sym || "·"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div
            className="inline-grid gap-px p-2 border border-[var(--border)] rounded-lg bg-[var(--border)]"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(24px, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(24px, 1fr))`,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => toggleCell(r, c)}
                  className="min-w-[24px] min-h-[24px] bg-[var(--card)] text-center text-sm hover:ring-2 hover:ring-[var(--accent)]"
                >
                  {cell || " "}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </CalculatorCard>
  );
}
