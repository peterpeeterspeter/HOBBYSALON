import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { MARKETS } from "./config.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveMarketFromHeaders } from "./resolve.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import {
  REGIONAL_LANDING_PATHS,
  buildRegionalPageMetadata,
  regionalHreflangLanguages,
  regionalLandingCopy,
} from "./regional-seo.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { marketSeoDecision } from "./seo-policy.ts";

const onPreviewEnv = {
  ENABLE_NL_MARKET: "true",
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
};

const offEnv = {
  ENABLE_NL_MARKET: "false",
  NODE_ENV: "development",
};

test("regional landings cover the five shared SEO surfaces", () => {
  assert.deepEqual([...REGIONAL_LANDING_PATHS], [
    "/",
    "/workshops",
    "/creators",
    "/materials",
    "/agenda",
  ]);
});

test("BE and NL homepage titles match the discovery heroes", () => {
  assert.equal(
    regionalLandingCopy("/", "BE").title,
    "Zin om iets moois te maken?"
  );
  assert.equal(
    regionalLandingCopy("/", "NL").title,
    "Ontdek creatieve workshops, hobbywinkels en materialen in Nederland"
  );
});

test("BE regional metadata keeps BE canonical and no hreflang while NL preparing", () => {
  const decision = marketSeoDecision(
    resolveMarketFromHeaders({ host: "www.hobbysalon.be", env: offEnv }),
    offEnv
  );
  const meta = buildRegionalPageMetadata({
    path: "/workshops",
    decision,
  });
  assert.equal(
    meta.alternates?.canonical,
    "https://www.hobbysalon.be/workshops"
  );
  assert.equal(meta.openGraph?.locale, "nl_BE");
  assert.equal(meta.alternates?.languages, undefined);
  assert.equal(
    (meta.robots as { index?: boolean } | undefined)?.index,
    true
  );
});

test("NL regional metadata uses NL origin and stays noindex while preparing", () => {
  const decision = marketSeoDecision(
    resolveMarketFromHeaders({ host: "hobbysalon.nl", env: onPreviewEnv }),
    onPreviewEnv
  );
  const meta = buildRegionalPageMetadata({
    path: "/",
    decision,
  });
  assert.equal(meta.alternates?.canonical, "https://hobbysalon.nl");
  assert.equal(meta.openGraph?.locale, "nl_NL");
  assert.equal(meta.alternates?.languages, undefined);
  assert.equal(
    (meta.robots as { index?: boolean } | undefined)?.index,
    false
  );
  assert.equal(
    typeof meta.title === "object" &&
      meta.title !== null &&
      "absolute" in meta.title
      ? meta.title.absolute
      : meta.title,
    "Ontdek creatieve workshops, hobbywinkels en materialen in Nederland"
  );
});

test("hreflang map is reciprocal for equivalent landings", () => {
  const languages = regionalHreflangLanguages("/agenda");
  assert.equal(languages["nl-BE"], "https://www.hobbysalon.be/agenda");
  assert.equal(languages["nl-NL"], "https://hobbysalon.nl/agenda");
  assert.equal(languages["x-default"], "https://www.hobbysalon.be/agenda");
});

test("hreflang only attaches when NL SEO is published", () => {
  assert.equal(MARKETS.NL.rollout, "preparing");
  const be = marketSeoDecision(
    resolveMarketFromHeaders({ host: "www.hobbysalon.be", env: onPreviewEnv }),
    onPreviewEnv
  );
  assert.equal(be.publishHreflang, false);
  const withHreflang = buildRegionalPageMetadata({
    path: "/creators",
    decision: { ...be, publishHreflang: true },
  });
  assert.deepEqual(withHreflang.alternates?.languages, {
    "nl-BE": "https://www.hobbysalon.be/creators",
    "nl-NL": "https://hobbysalon.nl/creators",
    "x-default": "https://www.hobbysalon.be/creators",
  });
});
