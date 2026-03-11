import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://www.hobbysalon.be";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL;
}

export function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, getSiteUrl()).toString();
}

type BuildPageMetadataInput = {
  title: string;
  description?: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
};

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
}: BuildPageMetadataInput): Metadata {
  const ogImage = image ? absoluteUrl(image) : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type,
      url: absoluteUrl(path),
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: "Hobbysalon",
      locale: "nl_BE",
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
