"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { convertGauge } from "@/lib/tools/gauge-formulas";

export function PatroonOmrekenen() {
  const [origStitches, setOrigStitches] = useState("");
  const [origRows, setOrigRows] = useState("");
  const [origStPerCm, setOrigStPerCm] = useState("");
  const [origRowsPerCm, setOrigRowsPerCm] = useState("");
  const [newStPerCm, setNewStPerCm] = useState("");
  const [newRowsPerCm, setNewRowsPerCm] = useState("");

  const oSt = parseFloat(origStitches.replace(",", ".")) || 0;
  const oR = parseFloat(origRows.replace(",", ".")) || 0;
  const oSpc = parseFloat(origStPerCm.replace(",", ".")) || 0;
  const oRpc = parseFloat(origRowsPerCm.replace(",", ".")) || 0;
  const nSpc = parseFloat(newStPerCm.replace(",", ".")) || 0;
  const nRpc = parseFloat(newRowsPerCm.replace(",", ".")) || 0;

  const newSt = oSpc > 0 && nSpc > 0 ? convertGauge(oSt, oSpc, nSpc) : null;
  const newRows = oRpc > 0 && nRpc > 0 ? convertGauge(oR, oRpc, nRpc) : null;

  return (
    <CalculatorCard title="Patroon omrekenen naar jouw gauge">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Het patroon is geschreven voor gauge A. Jij haalt gauge B. Herbereken
          steken en rijen.
        </p>

        <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-medium text-[var(--foreground)]">
            Patroon (originele gauge)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="text"
              inputMode="decimal"
              label="Steken in patroon"
              placeholder="bijv. 80"
              value={origStitches}
              onChange={(e) => setOrigStitches(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Rijen in patroon"
              placeholder="bijv. 120"
              value={origRows}
              onChange={(e) => setOrigRows(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Steken per cm (patroon)"
              placeholder="bijv. 2"
              value={origStPerCm}
              onChange={(e) => setOrigStPerCm(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Rijen per cm (patroon)"
              placeholder="bijv. 2.8"
              value={origRowsPerCm}
              onChange={(e) => setOrigRowsPerCm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-medium text-[var(--foreground)]">
            Jouw gauge
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="text"
              inputMode="decimal"
              label="Steken per cm (jouw proeflapje)"
              placeholder="bijv. 2.2"
              value={newStPerCm}
              onChange={(e) => setNewStPerCm(e.target.value)}
            />
            <Input
              type="text"
              inputMode="decimal"
              label="Rijen per cm (jouw proeflapje)"
              placeholder="bijv. 3"
              value={newRowsPerCm}
              onChange={(e) => setNewRowsPerCm(e.target.value)}
            />
          </div>
        </div>

        {(newSt !== null || newRows !== null) && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 space-y-2"
            role="status"
          >
            {newSt !== null && (
              <p className="text-[var(--foreground)]">
                <strong>Steken voor jou:</strong> {newSt}
              </p>
            )}
            {newRows !== null && (
              <p className="text-[var(--foreground)]">
                <strong>Rijen voor jou:</strong> {newRows}
              </p>
            )}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
