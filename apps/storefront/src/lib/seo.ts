import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://www.hobbysalon.be";

export const DEFAULT_OG_IMAGE = "/og-image.png";
export const DEFAULT_OG_IMAGE_ALT = "Hobbysalon logo";
export const DEFAULT_OG_IMAGE_WIDTH = 603;
export const DEFAULT_OG_IMAGE_HEIGHT = 403;

/** Belgian public origin. Prefer MarketSeoDecision.canonicalOrigin for market pages. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL;
}

export function absoluteUrl(pathOrUrl: string, origin?: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    // Rewrite accidental localhost Medusa asset URLs for OG / JSON-LD.
    try {
      const parsed = new URL(pathOrUrl);
      const isLocal =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0";
      if (isLocal) {
        const backend =
          process.env.MEDUSA_BACKEND_URL?.trim() ||
          process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
          "https://api.hobbysalon.be";
        const publicBase = new URL(backend);
        parsed.protocol = publicBase.protocol;
        parsed.hostname = publicBase.hostname;
        parsed.port = publicBase.port;
        return parsed.toString();
      }
    } catch {
      // fall through
    }
    return pathOrUrl;
  }

  const base = origin ?? getSiteUrl();
  if (pathOrUrl === "/" || pathOrUrl === "") {
    return new URL("/", `${base}/`).toString().replace(/\/$/, "") || base;
  }
  return new URL(pathOrUrl, `${base}/`).toString();
}

export type BuildPageMetadataInput = {
  title: string;
  description?: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  /** Canonical / OG origin. Defaults to the Belgian site URL. */
  origin?: string;
  /** Open Graph locale (underscore form). Defaults to nl_BE. */
  locale?: string;
  /** When true, skip the root layout title template. */
  absoluteTitle?: boolean;
  /** Reciprocal hreflang map (absolute URLs). Omit when NL is not launched. */
  languages?: Record<string, string>;
  robots?: Metadata["robots"];
};

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  origin,
  locale = "nl_BE",
  absoluteTitle = false,
  languages,
  robots,
}: BuildPageMetadataInput): Metadata {
  const site = origin ?? getSiteUrl();
  const canonical = absoluteUrl(path, site);
  const ogImage = absoluteUrl(image?.trim() ? image : DEFAULT_OG_IMAGE, site);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    // Absolute canonicals so BE-only pages (articles, tools, …) keep the
    // Belgian origin even when the request host / metadataBase is NL.
    alternates: {
      canonical,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      type,
      url: canonical,
      title,
      description,
      images: [
        {
          url: ogImage,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
        },
      ],
      siteName: "Hobbysalon",
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    ...(robots ? { robots } : {}),
  };
}
