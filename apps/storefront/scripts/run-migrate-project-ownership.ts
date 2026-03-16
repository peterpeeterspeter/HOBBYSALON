#!/usr/bin/env npx tsx
/**
 * Run the project ownership migration.
 * Loads DATABASE_URL from .env.local or .env.
 *
 * Usage: npx tsx scripts/run-migrate-project-ownership.ts
 * Or: DATABASE_URL=postgresql://... npx tsx scripts/run-migrate-project-ownership.ts
 */
import { config } from "dotenv";
import { execSync } from "child_process";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error(
    "DATABASE_URL is not set. Add it to .env.local with your Supabase Postgres connection string."
  );
  console.error(
    "Get it from: Supabase Dashboard > Project Settings > Database > Connection string (URI)"
  );
  console.error(
    "\nAlternatively, run the SQL manually in Supabase SQL Editor:"
  );
  console.error("  scripts/migrate-project-user-ownership.sql");
  process.exit(1);
}

const sqlPath = join(process.cwd(), "scripts", "migrate-project-user-ownership.sql");

execSync(`psql "${url.replace(/"/g, '\\"')}" -f "${sqlPath}"`, {
  stdio: "inherit",
});
