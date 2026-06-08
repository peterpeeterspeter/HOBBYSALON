import "server-only";
import { randomUUID } from "crypto";
import { createPlatformClient } from "@/lib/platform/client";

export const MEDIA_BUCKET = "media";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

export function getFileFromFormData(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }
  return value;
}

export async function uploadImageFile(file: File, pathPrefix: string): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Alleen JPEG, PNG, WebP of GIF zijn toegestaan.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Afbeelding mag maximaal 5 MB zijn.");
  }

  const ext = extensionForMime(file.type);
  const path = `${pathPrefix}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createPlatformClient();

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buffer, {
    contentType: file.type,
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
