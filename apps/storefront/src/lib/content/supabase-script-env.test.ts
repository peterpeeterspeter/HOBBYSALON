import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveSupabaseUrl } from "./supabase-script-env.ts";

test("uses SUPABASE_URL when a public runtime URL is unavailable", () => {
  assert.equal(
    resolveSupabaseUrl({ SUPABASE_URL: "https://service.example.supabase.co" }),
    "https://service.example.supabase.co"
  );
});

test("prefers NEXT_PUBLIC_SUPABASE_URL when both URL names exist", () => {
  assert.equal(
    resolveSupabaseUrl({
      NEXT_PUBLIC_SUPABASE_URL: "https://public.example.supabase.co",
      SUPABASE_URL: "https://service.example.supabase.co",
    }),
    "https://public.example.supabase.co"
  );
});
