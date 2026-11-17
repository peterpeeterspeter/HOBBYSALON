import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as crypto from "node:crypto";
import * as contract from "./conversions";
const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc");
export const GENERATION = "11111111-1111-4111-8111-111111111111";
export function fixture() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-test-only-secret";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "offline-public-project-key";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
  const jar = new Map<string, string>([["hs_posthog_consent_v1", "granted"], [contract.CONSENT_GENERATION_KEY, GENERATION]]);
  const rows: Record<string, any[]> = {};
  const operations: string[] = [];
  let fail = false;
  const client = { from(name: string) {
    operations.push(name);
    rows[name] ??= [];
    let mode = "select", patch: any, options: any;
    const filters: ((r: any) => boolean)[] = [];
    const q: any = {
      insert(p: any) { mode = "insert"; patch = p; return q; },
      upsert(p: any, o: any) { mode = "upsert"; patch = p; options = o; return q; },
      update(p: any) { mode = "update"; patch = p; return q; },
      eq(k: string, v: any) { filters.push(r => r[k] === v); return q; },
      is(k: string, v: any) { filters.push(r => (r[k] ?? null) === v); return q; },
      not(k: string, _op: string, _v: any) { filters.push(r => r[k] != null); return q; },
      select() { return q; },
      async maybeSingle() { return execute(); },
      then(resolve: any, reject: any) { return Promise.resolve(execute()).then(resolve, reject); },
    };
    function execute() {
      if (fail) return { data: null, error: { code: "42P01" } };
      if (mode === "insert" || mode === "upsert") {
        const keys = name === "analytics_receipt_claims" ? ["receipt_id"] : name === "analytics_conversion_claims" ? ["event", "entity_id"] : name === "analytics_signup_candidates" ? ["user_id"] : ["email", "lead_magnet_id"];
        if (rows[name].some(r => keys.every(k => r[k] === patch[k]))) return { data: null, error: options?.ignoreDuplicates ? null : { code: "23505" } };
        const row = { id: crypto.randomUUID(), ...patch };
        rows[name].push(row); return { data: row, error: null };
      }
      const row = rows[name].find(r => filters.every(f => f(r)));
      if (row && mode === "update") Object.assign(row, patch);
      return { data: row ?? null, error: null };
    }
    return q;
  } };
  const writes: any[] = [], captures: any[] = [];
  const store = { get: (key: string) => jar.has(key) ? { value: jar.get(key) } : undefined,
    set: (key: string, value: string, options: any) => { jar.set(key, value); writes.push([key, value, options]); } };
  const cache = new Map<string, any>();
  function load(name: string): any {
    if (cache.has(name)) return cache.get(name);
    const path = name === "api" ? "../../app/api/analytics/conversions/route.ts" : `./${name}.ts`;
    const code = swc.transformSync(readFileSync(new URL(path, import.meta.url), "utf8"), { jsc: { parser: { syntax: "typescript" }, target: "es2020" }, module: { type: "commonjs" } }).code;
    const mod = { exports: {} };
    const resolve = (id: string): any => {
      if (id === "server-only") return {};
      if (id === "node:crypto") return crypto;
      if (id === "next/headers") return { cookies: async () => store };
      if (id === "@/lib/platform/client") return { createPlatformClient: () => client };
      if (id.endsWith("/conversions")) return contract;
      if (id.endsWith("/conversion-dispatch.server") && name === "api") return { dispatchConversion: async (...args: any[]) => { captures.push(args); return true; } };
      return load(id.split("/").pop()!);
    };
    new Function("require", "module", "exports", code)(resolve, mod, mod.exports);
    cache.set(name, mod.exports); return mod.exports;
  }
  return { jar, rows, operations, client, writes, captures, load, setFailure: (value: boolean) => { fail = value; } };
}
