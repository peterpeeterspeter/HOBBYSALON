import type { MetadataRoute } from "next";
import { getRequestMarket } from "@/lib/markets/request";
import {
  isNlSeoPublished,
  marketSeoDecision,
} from "@/lib/markets/seo-policy";
import { absoluteUrl } from "@/lib/seo";

const PRIVATE_DISALLOW = [
  "/api",
  "/auth",
  "/cart",
  "/checkout",
  "/dashboard",
  "/favorites",
  "/login",
  "/profile",
  "/register",
] as const;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const resolution = await getRequestMarket();
  const seo = marketSeoDecision(resolution);
  const origin = seo.canonicalOrigin;

  // NL stays non-indexable until the controlled launch (flag + live + index).
  if (seo.marketCode === "NL" && !isNlSeoPublished()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: origin,
    };
  }

  if (!seo.index) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: origin,
    };
  }

  const sitemaps =
    seo.marketCode === "NL"
      ? [absoluteUrl("/sitemap.xml", origin)]
      : [
          absoluteUrl("/sitemap.xml", origin),
          absoluteUrl("/sitemap-news.xml", origin),
        ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_DISALLOW],
    },
    sitemap: sitemaps,
    host: origin,
  };
}
