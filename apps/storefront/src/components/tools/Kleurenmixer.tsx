"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
}

function blendColors(hex1: string, hex2: string, ratio: number): string {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return "#808080";
  const r = rgb1.r * (1 - ratio) + rgb2.r * ratio;
  const g = rgb1.g * (1 - ratio) + rgb2.g * ratio;
  const b = rgb1.b * (1 - ratio) + rgb2.b * ratio;
  return rgbToHex(r, g, b);
}

export function Kleurenmixer() {
  const [colorA, setColorA] = useState("#FF6B6B");
  const [colorB, setColorB] = useState("#4ECDC4");
  const [ratio, setRatio] = useState(0.5);

  const blended = blendColors(colorA, colorB, ratio);

  return (
    <CalculatorCard title="Kleurenmixer">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Wat gebeurt er als je garen A en garen B combineert? Visuele mix.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Garen A
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorA}
                onChange={(e) => setColorA(e.target.value)}
                className="h-14 w-20 rounded border border-[var(--border)] cursor-pointer"
              />
              <input
                type="text"
                value={colorA}
                onChange={(e) => setColorA(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-mono text-sm min-h-[44px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Garen B
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorB}
                onChange={(e) => setColorB(e.target.value)}
                className="h-14 w-20 rounded border border-[var(--border)] cursor-pointer"
              />
              <input
                type="text"
                value={colorB}
                onChange={(e) => setColorB(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-mono text-sm min-h-[44px]"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            Verhouding (0 = meer A, 1 = meer B)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={ratio}
            onChange={(e) => setRatio(parseFloat(e.target.value))}
            className="w-full h-3 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
          />
          <p className="text-sm text-[var(--muted)] mt-1">
            {(ratio * 100).toFixed(0)}% B, {(100 - ratio * 100).toFixed(0)}% A
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] p-6">
          <p className="text-sm font-medium text-[var(--foreground)] mb-3">
            Gecombineerde kleur
          </p>
          <div
            className="h-24 rounded-lg border border-[var(--border)]"
            style={{ backgroundColor: blended }}
          />
          <p className="mt-2 font-mono text-sm text-[var(--muted)]">
            {blended}
          </p>
        </div>
      </div>
    </CalculatorCard>
  );
}
