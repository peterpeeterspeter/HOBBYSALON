import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { MARKETS, isNlMarketEnabled, ogLocaleFromLocale } from "./config.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveMarketFromHeaders } from "./resolve.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { marketSeoDecision } from "./seo-policy.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { marketSwitchTargets, publicMarketPath } from "./urls.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getSiteUrl, absoluteUrl, buildPageMetadata } from "../seo.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { countryCookieUpdate } from "../location/preference-update.ts";

const offEnv = {
  ENABLE_NL_MARKET: "false",
  NODE_ENV: "development",
};

const onPreviewEnv = {
  ENABLE_NL_MARKET: "true",
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
};

const productionAttemptEnv = {
  ENABLE_NL_MARKET: "true",
  VERCEL_ENV: "production",
  NODE_ENV: "production",
};

const productionLaunchEnv = {
  ENABLE_NL_MARKET: "true",
  ALLOW_NL_MARKET_IN_PRODUCTION: "true",
  VERCEL_ENV: "production",
  NODE_ENV: "production",
};

test("ENABLE_NL_MARKET stays off in production unless ALLOW_NL_MARKET_IN_PRODUCTION is true", () => {
  assert.equal(isNlMarketEnabled(offEnv), false);
  assert.equal(isNlMarketEnabled(productionAttemptEnv), false);
  assert.equal(
    isNlMarketEnabled({
      ...productionAttemptEnv,
      ALLOW_NL_MARKET_IN_PRODUCTION: "1",
    }),
    false
  );
  assert.equal(isNlMarketEnabled(productionLaunchEnv), true);
  assert.equal(isNlMarketEnabled(onPreviewEnv), true);
  assert.equal(isNlMarketEnabled({}), false);
});

test("NL indexing stays off while MarketConfig.NL is preparing even if production launch flags are set", () => {
  assert.equal(MARKETS.NL.rollout, "preparing");
  assert.equal(MARKETS.NL.indexing, "noindex");
  const resolved = resolveMarketFromHeaders({
    host: "hobbysalon.nl",
    env: productionLaunchEnv,
  });
  assert.equal(resolved.market.marketCode, "NL");
  const seo = marketSeoDecision(resolved, productionLaunchEnv);
  assert.equal(seo.index, false);
  assert.equal(seo.publishHreflang, false);
});

test("MarketConfig separates country from locales", () => {
  assert.equal(MARKETS.BE.marketCode, "BE");
  assert.equal(MARKETS.BE.defaultLocale, "nl-BE");
  assert.deepEqual([...MARKETS.BE.supportedLocales], ["nl-BE"]);
  assert.equal(MARKETS.NL.defaultLocale, "nl-NL");
  assert.equal(ogLocaleFromLocale("nl-BE"), "nl_BE");
  assert.equal(ogLocaleFromLocale("fr-BE"), "fr_BE");
});

test("resolves Belgian apex and www hosts with ports and case", () => {
  for (const host of ["www.hobbysalon.be", "HOBBYSALON.BE:443", "hobbysalon.be:3000"]) {
    const resolved = resolveMarketFromHeaders({ host, env: offEnv });
    assert.equal(resolved.market.marketCode, "BE");
    assert.equal(resolved.trustedHost, true);
    assert.equal(resolved.preview, false);
  }
});

test("NL host falls back to BE while ENABLE_NL_MARKET is off", () => {
  const resolved = resolveMarketFromHeaders({
    host: "www.hobbysalon.nl",
    residenceCountryCode: "NL",
    env: offEnv,
  });
  assert.equal(resolved.market.marketCode, "BE");
  assert.equal(resolved.trustedHost, false);
  assert.equal(resolved.preview, true);
  assert.equal(resolved.ignoredResidenceCountry, "NL");

  const seo = marketSeoDecision(resolved, offEnv);
  assert.equal(seo.index, false);
  assert.equal(seo.publishHreflang, false);
  assert.equal(seo.canonicalOrigin, MARKETS.BE.canonicalOrigin);
});

test("NL host becomes market NL only when the flag is on outside production", () => {
  const resolved = resolveMarketFromHeaders({
    host: "hobbysalon.nl",
    env: onPreviewEnv,
  });
  assert.equal(resolved.market.marketCode, "NL");
  assert.equal(resolved.trustedHost, true);

  const seo = marketSeoDecision(resolved, onPreviewEnv);
  assert.equal(seo.index, false);
  assert.equal(seo.publishHreflang, false);
  assert.equal(seo.canonicalOrigin, MARKETS.NL.canonicalOrigin);
  assert.equal(seo.htmlLang, "nl-NL");
  assert.equal(seo.ogLocale, "nl_NL");
});

test("never trusts list-valued hosts or x-forwarded-host", () => {
  const spoofed = resolveMarketFromHeaders({
    host: "evil.example",
    forwardedHost: "www.hobbysalon.be",
    env: onPreviewEnv,
  });
  assert.equal(spoofed.market.marketCode, "BE");
  assert.equal(spoofed.trustedHost, false);
  assert.equal(marketSeoDecision(spoofed, onPreviewEnv).canonicalOrigin, MARKETS.BE.canonicalOrigin);

  const listHost = resolveMarketFromHeaders({
    host: "www.hobbysalon.be, evil.example",
    env: onPreviewEnv,
  });
  assert.equal(listHost.trustedHost, false);
  assert.equal(listHost.market.marketCode, "BE");
});

test("unknown host is never a trusted canonical or redirect target", () => {
  const resolved = resolveMarketFromHeaders({
    host: "preview-abc.vercel.app",
    env: onPreviewEnv,
  });
  assert.equal(resolved.market.marketCode, "BE");
  assert.equal(resolved.trustedHost, false);
  const seo = marketSeoDecision(resolved, onPreviewEnv);
  assert.equal(seo.canonicalOrigin, "https://www.hobbysalon.be");
  assert.equal(seo.index, false);
});

test("BE then NL in the same process do not leak market state", () => {
  const first = resolveMarketFromHeaders({
    host: "www.hobbysalon.be",
    env: onPreviewEnv,
  });
  assert.equal(first.market.marketCode, "BE");

  const second = resolveMarketFromHeaders({
    host: "hobbysalon.nl",
    env: onPreviewEnv,
  });
  assert.equal(second.market.marketCode, "NL");
  assert.equal(first.market.marketCode, "BE");

  const third = resolveMarketFromHeaders({
    host: "www.hobbysalon.be",
    env: onPreviewEnv,
  });
  assert.equal(third.market.marketCode, "BE");
  assert.equal(second.market.marketCode, "NL");
});

test("switch targets stay empty while ENABLE_NL_MARKET is off", () => {
  assert.deepEqual(
    marketSwitchTargets({
      currentPath: "/workshops?plaats=Gent",
      currentMarket: "BE",
      env: offEnv,
    }),
    []
  );
  assert.deepEqual(
    marketSwitchTargets({
      currentPath: "/workshops",
      currentMarket: "BE",
      env: productionAttemptEnv,
    }),
    []
  );
});

test("switch keeps safe public paths and drops tokens and payment query", () => {
  const targets = marketSwitchTargets({
    currentPath:
      "/zoeken?q=haak&token=secret&payment_intent=pi_1&session_id=cs_1&page=2",
    currentMarket: "BE",
    env: onPreviewEnv,
  });
  assert.equal(targets.length, 2);
  const nl = targets.find((target) => target.code === "NL");
  assert.ok(nl);
  assert.equal(nl.href.startsWith("https://hobbysalon.nl/zoeken?"), true);
  assert.match(nl.href, /q=haak/);
  assert.match(nl.href, /page=2/);
  assert.doesNotMatch(nl.href, /token=/);
  assert.doesNotMatch(nl.href, /payment_intent=/);
  assert.doesNotMatch(nl.href, /session_id=/);

  const be = targets.find((target) => target.code === "BE");
  assert.ok(be);
  assert.equal(be.href.startsWith("/"), true);
  assert.equal(be.href.startsWith("//"), false);
});

test("switch rejects protocol-relative and external current paths", () => {
  const unsafe = marketSwitchTargets({
    currentPath: "//evil.example/steal",
    currentMarket: "BE",
    env: onPreviewEnv,
  });
  assert.equal(unsafe.find((t) => t.code === "BE")?.href, "/");
  assert.equal(unsafe.find((t) => t.code === "NL")?.href, "https://hobbysalon.nl/");
});

test("cart and checkout stay host-bound on switch", () => {
  const targets = marketSwitchTargets({
    currentPath: "/checkout?step=payment&payment_intent=pi_x",
    currentMarket: "BE",
    env: onPreviewEnv,
  });
  const nl = targets.find((target) => target.code === "NL");
  assert.ok(nl);
  assert.equal(nl.hostBound, true);
  assert.equal(nl.href, "https://hobbysalon.nl/");
});

test("Belgian public paths stay relative and map detail fallbacks", () => {
  assert.equal(publicMarketPath("/"), "/");
  assert.equal(publicMarketPath("/workshops"), "/workshops");
  assert.equal(publicMarketPath("/workshop/porselein"), "/workshops");
  assert.equal(publicMarketPath("/zoeken"), "/zoeken");
});

test("existing Belgian SEO helpers keep the BE origin and locale", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    assert.equal(getSiteUrl(), "https://www.hobbysalon.be");
    assert.equal(absoluteUrl("/workshops"), "https://www.hobbysalon.be/workshops");
    const meta = buildPageMetadata({
      title: "Workshops",
      path: "/workshops",
      description: "Ontdek workshops",
    });
    assert.equal(
      meta.alternates?.canonical,
      "https://www.hobbysalon.be/workshops"
    );
    assert.equal(meta.openGraph?.locale, "nl_BE");
    assert.equal(meta.openGraph?.url, "https://www.hobbysalon.be/workshops");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("BE trusted host indexes while ENABLE_NL_MARKET is off", () => {
  const resolved = resolveMarketFromHeaders({
    host: "www.hobbysalon.be",
    env: offEnv,
  });
  const seo = marketSeoDecision(resolved, offEnv);
  assert.equal(seo.index, true);
  assert.equal(seo.follow, true);
  assert.equal(seo.publishHreflang, false);
  assert.equal(seo.canonicalOrigin, MARKETS.BE.canonicalOrigin);
  assert.equal(seo.htmlLang, "nl-BE");
  assert.equal(seo.ogLocale, "nl_BE");
});

test("NL preparing never publishes hreflang or indexes even with flag on", () => {
  assert.equal(MARKETS.NL.rollout, "preparing");
  assert.equal(MARKETS.NL.indexing, "noindex");
  const resolved = resolveMarketFromHeaders({
    host: "hobbysalon.nl",
    env: onPreviewEnv,
  });
  const seo = marketSeoDecision(resolved, onPreviewEnv);
  assert.equal(seo.index, false);
  assert.equal(seo.publishHreflang, false);
  assert.equal(seo.canonicalOrigin, MARKETS.NL.canonicalOrigin);
  assert.equal(seo.htmlLang, "nl-NL");
});

test("articles without market origin keep BE canonical on absolute form", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const meta = buildPageMetadata({
      title: "Artikel",
      path: "/artikel/voorbeeld",
      description: "BE artikel",
      type: "article",
    });
    assert.equal(
      meta.alternates?.canonical,
      "https://www.hobbysalon.be/artikel/voorbeeld"
    );
    assert.equal(meta.alternates?.languages, undefined);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("city-only location save keeps the stored country", () => {
  assert.deepEqual(
    countryCookieUpdate({ hasCountryField: false, submittedCountry: null }),
    { action: "keep" }
  );
  assert.deepEqual(
    countryCookieUpdate({ hasCountryField: true, submittedCountry: "NL" }),
    { action: "set", value: "NL" }
  );
  assert.deepEqual(
    countryCookieUpdate({ hasCountryField: true, submittedCountry: "" }),
    { action: "delete" }
  );
});
