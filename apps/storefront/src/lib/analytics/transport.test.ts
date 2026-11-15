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

test("external referrer preserves search origin without private path or query", () => {
  const page = pageParameters("https://www.hobbysalon.be/artikelen?email=private", "https://www.google.com/search?q=private#secret");
  assert.equal(page?.page_referrer, "https://www.google.com");
  assert.equal(page?.page_location, "https://www.hobbysalon.be/artikelen");
});
