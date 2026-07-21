import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://www.hobbysalon.be";

export const DEFAULT_OG_IMAGE = "/og-image.png";
export const DEFAULT_OG_IMAGE_ALT = "Hobbysalon logo";
export const DEFAULT_OG_IMAGE_WIDTH = 603;
export const DEFAULT_OG_IMAGE_HEIGHT = 403;

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
  const ogImage = absoluteUrl(image?.trim() ? image : DEFAULT_OG_IMAGE);

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
      images: [
        {
          url: ogImage,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
        },
      ],
      siteName: "Hobbysalon",
      locale: "nl_BE",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
