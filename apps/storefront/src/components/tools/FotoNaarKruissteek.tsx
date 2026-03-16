"use client";

import { useState, useRef } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { nearestDmcColor } from "@/lib/tools/dmc-colors";

export function FotoNaarKruissteek() {
  const [pixelSize, setPixelSize] = useState("20");
  const [maxColors, setMaxColors] = useState("20");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [colors, setColors] = useState<Array<{ code: string; name: string; hex: string }>>([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        const pixels = parseInt(pixelSize, 10) || 20;
        const maxC = parseInt(maxColors, 10) || 20;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const maxDim = 400;
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

        const step = Math.max(1, Math.floor(Math.min(w, h) / pixels));
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const i = (y * w + x) * 4;
            const r = imageData.data[i]!;
            const g = imageData.data[i + 1]!;
            const b = imageData.data[i + 2]!;
            const key = `${r},${g},${b}`;
            const existing = colorMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              colorMap.set(key, { r, g, b, count: 1 });
            }
          }
        }

        const sorted = [...colorMap.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, maxC);

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

        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, w, h);

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = Math.ceil(w / step) * step;
        tempCanvas.height = Math.ceil(h / step) * step;
        const tctx = tempCanvas.getContext("2d");
        if (!tctx) return;

        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

        const smallData = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const block = Math.max(1, step);
        for (let y = 0; y < tempCanvas.height; y += block) {
          for (let x = 0; x < tempCanvas.width; x += block) {
            const i = (y * tempCanvas.width + x) * 4;
            const r = smallData.data[i]!;
            const g = smallData.data[i + 1]!;
            const b = smallData.data[i + 2]!;
            const dmc = nearestDmcColor(r, g, b);
            ctx.fillStyle = dmc.hex;
            ctx.fillRect(x, y, block, block);
          }
        }
      };
      img.onerror = () => setError("Afbeelding kon niet geladen worden.");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <CalculatorCard title="Foto naar kruissteekpatroon">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Upload een foto om een vereenvoudigd kruissteekpatroon te maken met
          DMC-kleuren. Alles gebeurt op je apparaat; er wordt niets geüpload.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="numeric"
            label="Grootte patroon (steek per pixel)"
            placeholder="20"
            value={pixelSize}
            onChange={(e) => setPixelSize(e.target.value)}
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Max. aantal kleuren"
            placeholder="20"
            value={maxColors}
            onChange={(e) => setMaxColors(e.target.value)}
          />
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="photo-upload"
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

        {imageDataUrl && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Voorvertoning (gepixeliseerd)
              </p>
              <canvas
                ref={canvasRef}
                className="max-w-full rounded-lg border border-[var(--border)]"
                style={{ maxHeight: 400 }}
              />
            </div>

            {colors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  DMC-kleuren in je patroon
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
          </>
        )}
      </div>
    </CalculatorCard>
  );
}
