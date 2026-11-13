import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { consentRatio, counterHost, counterRoute } from "./consent-counter.server.ts";

test("route templates are recorded, slugs are not", () => {
  assert.equal(counterRoute("/artikel/ijsvogel-haken-amigurumi"), "/artikel/detail");
  assert.equal(counterRoute("/creator/jane-doe"), "/creator/detail");
  assert.equal(counterRoute("/workshops"), "/workshops");
  assert.equal(counterRoute("/"), "/");
  // Query and hash never reach the table.
  assert.equal(counterRoute("/zoeken?q=naald"), "/zoeken");
  assert.equal(counterRoute("/#top"), "/");
  // Trailing slash normalises.
  assert.equal(counterRoute("/prijzen/"), "/prijzen");
});

test("unknown routes are dropped rather than guessed", () => {
  assert.equal(counterRoute("/admin/geheim"), null);
  assert.equal(counterRoute("/dashboard/instellingen"), null);
  assert.equal(counterRoute("/api/analytics/pageview"), null);
  assert.equal(counterRoute("/artikel/INVALID_SLUG"), null);
  assert.equal(counterRoute("/artikel"), null);
});

test("only the two real hosts are counted", () => {
  assert.equal(counterHost("www.hobbysalon.be"), "www.hobbysalon.be");
  assert.equal(counterHost("hobbysalon.nl"), "hobbysalon.nl");
  assert.equal(counterHost("hobbysalon.nl:443"), "hobbysalon.nl");
  assert.equal(counterHost("www.hobbysalon.nl"), "hobbysalon.nl");
  assert.equal(counterHost("evil.example"), null);
  assert.equal(counterHost(""), null);
});

test("consent ratio counts denied visitors, which GA4 never sees", () => {
  const ratio = consentRatio([
    { consent: "granted", views: 300 },
    { consent: "denied", views: 700 },
  ]);
  assert.equal(ratio.granted, 300);
  assert.equal(ratio.denied, 700);
  assert.equal(ratio.total, 1000);
  assert.equal(ratio.grantedShare, 0.3);
});

test("an empty window reports unknown, not zero percent", () => {
  const ratio = consentRatio([]);
  assert.equal(ratio.total, 0);
  assert.equal(ratio.grantedShare, null, "0/0 must not become 0%");
});
