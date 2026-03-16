"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { DMC_COLORS, nearestDmcColor } from "@/lib/tools/dmc-colors";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function BorduurpaletGenerator() {
  const [hex, setHex] = useState("#6B8BB8");

  const rgb = hexToRgb(hex);
  let harmonisch: Array<{ code: string; name: string; hex: string }> = [];

  if (rgb) {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const baseDmc = nearestDmcColor(rgb.r, rgb.g, rgb.b);
    const seen = new Set<string>([baseDmc.code]);

    const candidates = DMC_COLORS.filter((c) => !seen.has(c.code))
      .map((c) => {
        const cRgb = hexToRgb(c.hex);
        if (!cRgb) return { dmc: c, dist: 999 };
        const cHsl = rgbToHsl(cRgb.r, cRgb.g, cRgb.b);
        const hueDiff = Math.abs(cHsl.h - hsl.h);
        const hueDist = Math.min(hueDiff, 360 - hueDiff);
        return { dmc: c, dist: hueDist };
      })
      .filter((x) => x.dist < 40)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map((x) => x.dmc);

    harmonisch = [baseDmc, ...candidates];
  }

  return (
    <CalculatorCard title="Borduurpalet generator">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Kies een kleur en vind harmonische DMC-combinaties (analoog kleurenschema).
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">
              Basiskleur
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="h-12 w-16 rounded border border-[var(--border)] cursor-pointer"
                aria-label="Kies basiskleur"
              />
              <Input
                type="text"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                placeholder="#000000"
                className="w-28 font-mono"
              />
            </div>
          </div>
        </div>

        {harmonisch.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Passende DMC-kleuren
            </p>
            <div className="flex flex-wrap gap-2">
              {harmonisch.map((c) => (
                <div
                  key={c.code}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                >
                  <div
                    className="h-6 w-6 rounded border border-[var(--border)]"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-sm">
                    {c.code} {c.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
