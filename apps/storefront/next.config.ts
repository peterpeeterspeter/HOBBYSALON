import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
const workspaceRoot = path.resolve(import.meta.dirname, "../../");

// Medusa backend URL for CSP connect-src (must allow API calls from browser)
const medusaBackend = process.env.MEDUSA_BACKEND_URL ?? process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

// In development, React Fast Refresh and source maps use eval.
// Allow unsafe-eval only in dev; production stays strict.
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://js.stripe.com",
  "img-src 'self' blob: data: https:",
  "font-src 'self' https://js.stripe.com",
  `connect-src 'self' ${medusaBackend} http://localhost:9000 https://*.supabase.co https://api.stripe.com https://*.stripe.com`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'self'",
].join("; ");

// On Vercel, skip outputFileTracingRoot and turbopack.root to avoid path duplication
const isVercel = process.env.VERCEL === "1";
const nextConfig: NextConfig = {
  transpilePackages: ["@medusajs/js-sdk"],
  ...(isVercel ? {} : {
    outputFileTracingRoot: workspaceRoot,
    turbopack: { root: workspaceRoot },
  }),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
