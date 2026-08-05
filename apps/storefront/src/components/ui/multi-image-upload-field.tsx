"use client";

import { useId, useState } from "react";
import { MAX_IMAGE_BYTES } from "@/lib/storage/image-constants";

type MultiImageUploadFieldProps = {
  /** Repeated hidden field name written for each uploaded URL. */
  name?: string;
  label?: string;
  hint?: string;
  uploadPathPrefix: string;
  maxImages?: number;
  /** Already stored gallery images (edit forms). Counts toward maxImages. */
  existingCount?: number;
  /** Pre-fill from a restored form draft. */
  initialUrls?: string[];
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return `Bestand is te groot (${formatMegabytes(file.size)} MB). Maximum is ${formatMegabytes(MAX_IMAGE_BYTES)} MB.`;
  }

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension =
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".gif");

  if (file.type && !ALLOWED_TYPES.has(file.type) && !hasAllowedExtension) {
    return "Alleen JPEG, PNG, WebP of GIF zijn toegestaan.";
  }

  return null;
}

export function MultiImageUploadField({
  name = "gallery_image_urls",
  label = "Extra foto's",
  hint = "Voeg meerdere foto's toe van je workshop.",
  uploadPathPrefix,
  maxImages = 8,
  existingCount = 0,
  initialUrls,
}: MultiImageUploadFieldProps) {
  const inputId = useId();
  const slotsForNew = Math.max(0, maxImages - Math.max(0, existingCount));
  const [urls, setUrls] = useState<string[]>(() =>
    (initialUrls ?? []).filter(Boolean).slice(0, slotsForNew)
  );
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const remaining = slotsForNew - urls.length;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setLocalError(null);

    if (remaining <= 0) {
      setLocalError(
        existingCount > 0
          ? `Je hebt al ${existingCount} foto's. Maximum is ${maxImages} in totaal.`
          : `Je kan maximaal ${maxImages} extra foto's toevoegen.`
      );
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const validationError = validateImageFile(file);
        if (validationError) {
          setLocalError(validationError);
          continue;
        }

        const body = new FormData();
        body.append("file", file);
        body.append("path_prefix", uploadPathPrefix);

        const response = await fetch("/api/upload-image", {
          method: "POST",
          body,
        });
        const payload = (await response.json()) as {
          url?: string;
          error?: string;
        };

        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? "Upload mislukt.");
        }
        uploaded.push(payload.url);
      }

      if (uploaded.length > 0) {
        setUrls((prev) => [...prev, ...uploaded].slice(0, slotsForNew));
      }
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Upload mislukt. Probeer opnieuw."
      );
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
      >
        {label}
      </label>

      {urls.length > 0 ? (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, index) => (
            <li key={`${url}-${index}`} className="relative">
              <img
                src={url}
                alt=""
                className="aspect-square w-full rounded-lg border border-[var(--border)] object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute right-1 top-1 rounded bg-[var(--card)]/90 px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)] shadow"
              >
                Verwijder
              </button>
              <input type="hidden" name={name} value={url} />
            </li>
          ))}
        </ul>
      ) : null}

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        multiple
        disabled={uploading || remaining <= 0}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
        className="block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--accent-foreground)] hover:file:bg-[var(--accent-hover)] disabled:opacity-60"
      />

      {uploading ? (
        <p className="mt-1 text-xs text-[var(--muted)]">Foto&apos;s uploaden…</p>
      ) : null}
      {localError ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {localError}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      <p className="mt-1 text-xs text-[var(--muted)]">
        {existingCount > 0
          ? `Nog ${remaining} van ${maxImages} foto's mogelijk (${existingCount} al opgeslagen) · `
          : `Max. ${maxImages} extra foto's · `}
        JPEG/PNG/WebP/GIF · max. {formatMegabytes(MAX_IMAGE_BYTES)} MB per foto.
      </p>
    </div>
  );
}
