"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_IMAGE_BYTES } from "@/lib/storage/image-constants";

type ImageUploadFieldProps = {
  name: string;
  label: string;
  hint?: string;
  currentUrl?: string | null;
  required?: boolean;
  previewClassName?: string;
  urlFieldName?: string;
  urlDefaultValue?: string;
  urlPlaceholder?: string;
  uploadPathPrefix?: string;
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
    return `Bestand is te groot (${formatMegabytes(file.size)} MB). Maximum is ${formatMegabytes(MAX_IMAGE_BYTES)} MB. Probeer de foto te verkleinen of exporteer als JPEG.`;
  }

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension =
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".gif");

  if (file.type && !ALLOWED_TYPES.has(file.type) && !hasAllowedExtension) {
    return "Alleen JPEG, PNG, WebP of GIF zijn toegestaan. iPhone: zet Camera op 'Meest compatibel (JPEG)'.";
  }

  return null;
}

export function ImageUploadField({
  name,
  label,
  hint,
  currentUrl,
  required = false,
  previewClassName = "h-24 w-24 rounded-lg object-cover",
  urlFieldName,
  urlDefaultValue,
  urlPlaceholder = "https://...",
  uploadPathPrefix = "uploads",
}: ImageUploadFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState(
    urlDefaultValue?.trim() || currentUrl?.trim() || ""
  );
  const [removed, setRemoved] = useState(false);

  const resolvedUrlFieldName = urlFieldName ?? `${name}_uploaded_url`;
  const hasImage = !removed && Boolean(previewUrl || uploadedUrl || currentUrl);
  const needsFile = required && !hasImage && !urlFieldName;

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setLocalError(null);

    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setLocalError(validationError);
      event.target.value = "";
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setRemoved(false);
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
      return nextPreview;
    });

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("path_prefix", uploadPathPrefix);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Upload mislukt.");
      }

      setUploadedUrl(payload.url);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Upload mislukt. Probeer een kleinere JPEG of PNG."
      );
      setPreviewUrl((previous) => {
        if (previous?.startsWith("blob:")) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
      event.target.value = "";
    } finally {
      setUploading(false);
    }
  }

  const displayUrl = removed
    ? null
    : previewUrl ?? (uploadedUrl || currentUrl || null);

  function clearImage() {
    setRemoved(true);
    setUploadedUrl("");
    setLocalError(null);
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      {displayUrl ? (
        <div className="mb-2 flex flex-wrap items-end gap-3">
          <img
            src={displayUrl}
            alt=""
            className={`border border-[var(--border)] ${previewClassName}`}
          />
          <button
            type="button"
            onClick={clearImage}
            className="text-sm font-medium text-red-700 hover:underline"
          >
            Foto verwijderen
          </button>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        required={needsFile}
        disabled={uploading}
        onChange={handleFileChange}
        className="block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--accent-foreground)] hover:file:bg-[var(--accent-hover)] disabled:opacity-60"
      />
      <input type="hidden" name={resolvedUrlFieldName} value={removed ? "" : uploadedUrl} />
      <input type="hidden" name={`${name}_remove`} value={removed ? "1" : ""} />
      {urlFieldName ? (
        <div className="mt-3">
          <label
            htmlFor={`${inputId}-url`}
            className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
          >
            Of plak een afbeeldings-URL
          </label>
          <input
            id={`${inputId}-url`}
            type="url"
            defaultValue={urlDefaultValue ?? ""}
            placeholder={urlPlaceholder}
            onChange={(event) => {
              setRemoved(false);
              setUploadedUrl(event.target.value.trim());
              setLocalError(null);
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>
      ) : null}
      {uploading ? (
        <p className="mt-1 text-xs text-[var(--muted)]">Foto uploaden…</p>
      ) : null}
      {localError ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {localError}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      <p className="mt-1 text-xs text-[var(--muted)]">
        JPEG, PNG, WebP of GIF · max. {formatMegabytes(MAX_IMAGE_BYTES)} MB. Foto&apos;s van
        iPhone worden automatisch geüpload voordat je het formulier verstuurt.
      </p>
    </div>
  );
}
