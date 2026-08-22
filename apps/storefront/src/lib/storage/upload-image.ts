import "server-only";
import { randomUUID } from "crypto";
import { createPlatformClient } from "@/lib/platform/client";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
} from "./image-constants";

export { MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from "./image-constants";
export const MEDIA_BUCKET = "media";
const MAX_BYTES = MAX_IMAGE_BYTES;
const ALLOWED_MIME = ALLOWED_IMAGE_MIME_TYPES;

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

function extensionForFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png" || ext === "webp" || ext === "gif") return ext;
  return null;
}

function resolveImageMime(file: File): string | null {
  if (file.type && ALLOWED_MIME.has(file.type)) {
    return file.type;
  }

  const fromName = extensionForFilename(file.name);
  if (fromName === "jpg") return "image/jpeg";
  if (fromName === "png") return "image/png";
  if (fromName === "webp") return "image/webp";
  if (fromName === "gif") return "image/gif";

  return null;
}

export function getFileFromFormData(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }
  return value;
}

export async function uploadImageFile(file: File, pathPrefix: string): Promise<string> {
  const mime = resolveImageMime(file);
  if (!mime) {
    throw new Error(
      "Alleen JPEG, PNG, WebP of GIF zijn toegestaan. iPhone: zet Camera op 'Meest compatibel (JPEG)' of exporteer de foto opnieuw."
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `Afbeelding is te groot (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_BYTES / (1024 * 1024)} MB.`
    );
  }

  const ext = extensionForMime(mime);
  const path = `${pathPrefix}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createPlatformClient();

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload mislukt: ${error.message}`);
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function resolveUploadedOrExistingUrl(
  formData: FormData,
  fileField: string,
  existingUrl: string | null | undefined,
  pathPrefix: string
): Promise<string | null> {
  const file = getFileFromFormData(formData, fileField);
  if (file) {
    return uploadImageFile(file, pathPrefix);
  }
  return existingUrl ?? null;
}

export async function requireUploadedImageUrl(
  formData: FormData,
  fileField: string,
  pathPrefix: string
): Promise<string> {
  const file = getFileFromFormData(formData, fileField);
  if (!file) {
    throw new Error("Kies een afbeelding om te uploaden.");
  }
  return uploadImageFile(file, pathPrefix);
}

function parseOptionalUrlFromFormData(
  formData: FormData,
  field: string
): string | null {
  const value = formData.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function resolveProductImageUrl(
  formData: FormData,
  options: {
    fileField: string;
    urlField: string;
    existingUrl?: string | null;
    pathPrefix: string;
  }
): Promise<string | null> {
  const file = getFileFromFormData(formData, options.fileField);
  if (file) {
    return uploadImageFile(file, options.pathPrefix);
  }

  const url = parseOptionalUrlFromFormData(formData, options.urlField);
  if (url) {
    return url;
  }

  if (formData.get(`${options.fileField}_remove`) === "1") {
    return null;
  }

  return options.existingUrl ?? null;
}
