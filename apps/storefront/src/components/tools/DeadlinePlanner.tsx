"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";

export function DeadlinePlanner() {
  const [deadlineStr, setDeadlineStr] = useState("");
  const [totalRows, setTotalRows] = useState("");
  const [rowsDone, setRowsDone] = useState("");

  const deadline = deadlineStr ? new Date(deadlineStr) : null;
  const total = parseInt(totalRows, 10) || 0;
  const done = parseInt(rowsDone, 10) || 0;
  const remaining = Math.max(0, total - done);

  let result = "";
  if (deadline && !isNaN(deadline.getTime()) && remaining > 0) {
    const now = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft > 0) {
      const rowsPerDay = remaining / daysLeft;
      result = `Je moet ${rowsPerDay.toFixed(0)} rijen per dag maken om op tijd klaar te zijn.`;
    } else {
      result = "De deadline is al verstreken.";
    }
  }

  return (
    <CalculatorCard title="Deadline-planner">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Klaar voor Kerstmis? Hoeveel rijen per dag heb je nodig?
        </p>

        <Input
          type="date"
          label="Deadline"
          value={deadlineStr}
          onChange={(e) => setDeadlineStr(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="numeric"
            label="Totaal aantal rijen"
            placeholder="bijv. 200"
            value={totalRows}
            onChange={(e) => setTotalRows(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Rijen al gemaakt"
            placeholder="bijv. 50"
            value={rowsDone}
            onChange={(e) => setRowsDone(e.target.value)}
          />
        </div>

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
