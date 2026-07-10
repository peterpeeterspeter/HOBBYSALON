import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/auth",
        "/cart",
        "/checkout",
        "/dashboard",
        "/favorites",
        "/login",
        "/profile",
        "/register",
      ],
    },
    sitemap: [absoluteUrl("/sitemap.xml"), absoluteUrl("/sitemap-news.xml")],
    host: getSiteUrl(),
  };
}
