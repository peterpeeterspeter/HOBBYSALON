"use client";

import { useState, useRef } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Button } from "@/components/ui/button";
import { nearestDmcColor } from "@/lib/tools/dmc-colors";

export function DmcKleurpalet() {
  const [, setImageDataUrl] = useState<string | null>(null);
  const [colors, setColors] = useState<Array<{ code: string; name: string; hex: string }>>([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError("");
    setImageDataUrl(null);
    setColors([]);

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Kies een afbeelding (jpg, png, gif of webp).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageDataUrl(dataUrl);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i]!;
          const g = imageData.data[i + 1]!;
          const b = imageData.data[i + 2]!;
          const key = `${r},${g},${b}`;
          const existing = colorMap.get(key);
          if (existing) existing.count++;
          else colorMap.set(key, { r, g, b, count: 1 });
        }

        const sorted = [...colorMap.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 15);

        const dmcColors = sorted.map(([, v]) => nearestDmcColor(v.r, v.g, v.b));
        const seen = new Set<string>();
        const unique: typeof dmcColors = [];
        for (const c of dmcColors) {
          if (!seen.has(c.code)) {
            seen.add(c.code);
            unique.push(c);
          }
        }
        setColors(unique);
      };
      img.onerror = () => setError("Afbeelding kon niet geladen worden.");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <CalculatorCard title="DMC-kleurpalet uit foto">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Upload een foto en krijg een palet passende DMC-kleuren. Alles lokaal.
        </p>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="dmc-palette-upload"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Kies een foto
          </Button>
        </div>

        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}

        {colors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--foreground)]">
              DMC-kleuren in je foto
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
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
