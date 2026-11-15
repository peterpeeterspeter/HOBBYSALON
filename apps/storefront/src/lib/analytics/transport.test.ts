import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../../next.config";
import { pageParameters } from "./pageview";

test("CSP allows GA4 collection on both global and regional endpoints", async () => {
  const rules = await nextConfig.headers!();
  const policy = rules.find((rule) => rule.source === "/(.*)")!.headers.find((header) => header.key === "Content-Security-Policy")!.value;
  const connect = policy.split(";").find((directive) => directive.trim().startsWith("connect-src "))!;
  assert.ok(connect.split(/\s+/).includes("https://*.google-analytics.com"));
  assert.ok(connect.includes("'self'"));
  assert.ok(!connect.split(/\s+/).includes("*"));
  assert.ok(policy.includes("frame-ancestors 'self'"));
});

test("CSP permits only the versioned Cloudflare beacon path", async () => {
  const rules = await nextConfig.headers!();
  const policy = rules.find((rule) => rule.source === "/(.*)")!.headers.find((header) => header.key === "Content-Security-Policy")!.value;
  const sources = (name: string) => policy.split(";").map((directive) => directive.trim().split(/\s+/)).find((tokens) => tokens[0] === name)!.slice(1);
  const script = sources("script-src");
  assert.ok(script.includes("https://static.cloudflareinsights.com/beacon.min.js/"));
  assert.ok(!script.includes("https://static.cloudflareinsights.com"));
  assert.ok(!script.includes("*"));
  assert.ok(!script.some((source) => source.includes("*.cloudflareinsights.com")));
  if (process.env.NODE_ENV === "production") assert.ok(!script.includes("'unsafe-eval'"));
  assert.ok(sources("connect-src").includes("'self'"));
  assert.ok(!sources("connect-src").some((source) => source.includes("cloudflareinsights.com")));
});

test("external referrer preserves search origin without private path or query", () => {
  const page = pageParameters("https://www.hobbysalon.be/artikelen?email=private", "https://www.google.com/search?q=private#secret");
  assert.equal(page?.page_referrer, "https://www.google.com");
  assert.equal(page?.page_location, "https://www.hobbysalon.be/artikelen");
});
