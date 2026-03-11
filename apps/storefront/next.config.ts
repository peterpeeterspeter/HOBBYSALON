import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
const workspaceRoot = path.resolve(import.meta.dirname, "../../");

// In development, React Fast Refresh and source maps use eval.
// Allow unsafe-eval only in dev; production stays strict.
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://js.stripe.com",
  "img-src 'self' blob: data: https:",
  "font-src 'self' https://js.stripe.com",
  "connect-src 'self' http://localhost:9000 https://*.supabase.co https://api.stripe.com https://*.stripe.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@medusajs/js-sdk"],
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
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
