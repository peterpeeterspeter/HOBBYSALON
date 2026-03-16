"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function FiletChartMaker() {
  const [cols, setCols] = useState(15);
  const [rows, setRows] = useState(15);
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [initDone, setInitDone] = useState(false);

  if (!initDone) {
    const newGrid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    setGrid(newGrid);
    setInitDone(true);
  }

  const handleResize = () => {
    const newGrid = Array(rows)
      .fill(null)
      .map((_, i) =>
        Array(cols)
          .fill(false)
          .map((_, j) => grid[i]?.[j] ?? false)
      );
    setGrid(newGrid);
  };

  const toggleCell = (r: number, c: number) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r]![c] = !next[r]![c];
      return next;
    });
  };

  return (
    <CalculatorCard title="Filet chart maker">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Filethaakwerk: open vakjes = leeg, gevulde vakjes = blok. Klik om te
          wisselen.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <Input
            type="number"
            min={5}
            max={50}
            label="Breedte"
            value={cols}
            onChange={(e) => setCols(Math.max(5, parseInt(e.target.value) || 15))}
          />
          <Input
            type="number"
            min={5}
            max={50}
            label="Hoogte"
            value={rows}
            onChange={(e) => setRows(Math.max(5, parseInt(e.target.value) || 15))}
          />
          <Button type="button" variant="secondary" onClick={handleResize}>
            Aanpassen
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div
            className="inline-grid gap-px p-2 border border-[var(--border)] rounded-lg bg-[var(--border)]"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(20px, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(20px, 1fr))`,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => toggleCell(r, c)}
                  className={`min-w-[20px] min-h-[20px] border border-[var(--border)] ${
                    cell
                      ? "bg-[var(--foreground)]"
                      : "bg-[var(--card)]"
                  }`}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </CalculatorCard>
  );
}
