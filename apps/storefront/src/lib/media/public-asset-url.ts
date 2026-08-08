/**
 * Vendor uploads often land as http://localhost:9000/static/... when the
 * backend file provider has no public S3 URL. Rewrite those to the public
 * Medusa host so browsers can load images in production.
 */
export function publicAssetUrl(
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();
  const backend =
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
    "https://api.hobbysalon.be";

  try {
    const parsed = new URL(trimmed);
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0";

    if (!isLocal) return trimmed;

    const publicBase = new URL(backend);
    parsed.protocol = publicBase.protocol;
    parsed.hostname = publicBase.hostname;
    parsed.port = publicBase.port;
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function publicAssetUrls(
  urls: Array<string | null | undefined>
): string[] {
  return urls
    .map((url) => publicAssetUrl(url))
    .filter((url): url is string => Boolean(url));
}
