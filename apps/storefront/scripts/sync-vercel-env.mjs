#!/usr/bin/env node
/**
 * Sync env vars from .env.local to Vercel preview and development.
 * Run: node scripts/sync-vercel-env.mjs
 */
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const content = readFileSync(envPath, "utf8");
const vars = {};
for (const line of content.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    vars[m[1].trim()] = v;
  }
}

const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "MEDUSA_BACKEND_URL",
  "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MEDUSA_ADMIN_API_TOKEN",
];

const sensitive = ["SUPABASE_SERVICE_ROLE_KEY", "MEDUSA_ADMIN_API_TOKEN"];
const cwd = join(__dirname, "..");

for (const env of ["preview", "development"]) {
  for (const key of keys) {
    const val = vars[key];
    if (!val) continue;
    try {
      const sensitiveFlag = sensitive.includes(key) ? ["--sensitive"] : [];
      // Preview env requires git branch (Vercel CLI bug); use "main" for main branch previews
      const envArgs = env === "preview" ? ["preview", "main"] : [env];
      const args = ["env", "add", key, ...envArgs, "--value", val, "--yes", "--force", ...sensitiveFlag];
      execSync(`vercel ${args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`, { cwd, stdio: "pipe" });
      console.log(`Added ${key} to ${env}`);
    } catch (e) {
      const err = (e.stderr || e.stdout || "").toString();
      if (err.includes("already exists") || err.includes("Invalid")) {
        console.log(`  ${key} in ${env}: skip (exists or invalid)`);
      } else {
        console.error(`Failed ${key} ${env}:`, e.message);
      }
    }
  }
}
