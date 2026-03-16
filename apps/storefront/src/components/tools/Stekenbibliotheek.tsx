"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { STITCHES } from "@/lib/tools/stitches-data";

export function Stekenbibliotheek() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"breien" | "haken" | "alle">("alle");

  const filtered = STITCHES.filter((s) => {
    const matchQ =
      !q.trim() ||
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      s.nameNl.toLowerCase().includes(q.toLowerCase());
    const matchCat =
      category === "alle" || s.category === category;
    return matchQ && matchCat;
  });

  return (
    <CalculatorCard title="Stekenbibliotheek">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Zoek steken op met uitleg en symbool. Brei- en haakvarianten.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            label="Zoeken"
            placeholder="bijv. tricot, stokje..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label="Categorie"
            options={[
              { value: "alle", label: "Alle" },
              { value: "breien", label: "Breien" },
              { value: "haken", label: "Haken" },
            ]}
            value={category}
            onChange={(e) => setCategory(e.target.value as "breien" | "haken" | "alle")}
          />
        </div>

        <div className="space-y-4">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-[var(--border)] p-4"
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--section-alt)] text-2xl"
                  aria-hidden
                >
                  {s.symbol}
                </span>
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {s.nameNl} ({s.name})
                  </p>
                  <p className="text-sm text-[var(--muted)]">{s.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CalculatorCard>
  );
}
