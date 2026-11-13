import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
// @ts-expect-error Node test runner requires explicit extension.
import { resolveMarketFromHeaders } from "./resolve.ts";
// @ts-expect-error Node test runner requires explicit extension.
import { marketSeoDecision } from "./seo-policy.ts";
// @ts-expect-error Node test runner requires explicit extension.
import { buildMarketPageMetadata, marketDefaultRobots, PRIVATE_PAGE_METADATA } from "./page-seo.ts";
// @ts-expect-error Node test runner requires explicit extension.
import { isPrivatePath, REGIONAL_LANDING_PATHS } from "./publication-paths.ts";

const launch = {
  ENABLE_NL_MARKET: "true",
  ALLOW_NL_MARKET_IN_PRODUCTION: "true",
  VERCEL_ENV: "production",
};
function decision(host: string, env = launch) {
  const resolution = resolveMarketFromHeaders({ host, env });
  const current = marketSeoDecision(resolution, env);
  // Simulate a separately approved SEO publication without changing production defaults.
  if (resolution.trustedHost && env.ENABLE_NL_MARKET === "true" && env.ALLOW_NL_MARKET_IN_PRODUCTION === "true") {
    return { ...current, index: true, publishHreflang: true };
  }
  return current;
}
function robots(metadata: ReturnType<typeof buildMarketPageMetadata>) {
  return metadata.robots as { index: boolean; follow: boolean };
}

test("private routes are actually wired through route-family layouts", () => {
  for (const prefix of ["account", "auth", "cart", "checkout", "favorites", "login", "profile", "register", "onboarding", "wachtwoord-vergeten"]) {
    const source = readFileSync(new URL(`../../app/(public)/${prefix}/layout.tsx`, import.meta.url), "utf8");
    assert.match(source, /export const metadata = PRIVATE_PAGE_METADATA/);
  }
});

test("news sitemap gates NL and preview before fetching, using market canonical", () => {
  const source = readFileSync(new URL("../../app/sitemap-news.xml/route.ts", import.meta.url), "utf8");
  assert.match(source, /seo.marketCode === "BE" && seo.index \? await listRecentNewsArticles\(\) : \[\]/);
  assert.match(source, /absoluteUrl\(`\/artikel\/\$\{article.slug\}`, seo.canonicalOrigin\)/);
});

test("only exact regional NL publications index, with reciprocal self hreflang", () => {
  for (const path of REGIONAL_LANDING_PATHS) {
    const nl = buildMarketPageMetadata({ title: "Regionaal", path }, decision("hobbysalon.nl"));
    const be = buildMarketPageMetadata({ title: "Regionaal", path }, decision("www.hobbysalon.be"));
    assert.equal(robots(nl).index, true);
    assert.equal(robots(be).index, true);
    assert.equal(nl.alternates?.canonical, `https://hobbysalon.nl${path === "/" ? "" : path}`);
    assert.deepEqual(nl.alternates?.languages, be.alternates?.languages);
    assert.equal(nl.alternates?.languages?.["nl-NL"], nl.alternates?.canonical);
    assert.equal(be.alternates?.languages?.["nl-BE"], be.alternates?.canonical);
  }
});

test("NL editorial, taxonomy and entities stay noindex even if a caller requests index or hreflang", () => {
  for (const path of ["/artikel/patroon", "/artikelen", "/tools", "/tools/teller", "/crochet", "/crochet/workshops", "/creator/maker", "/product/garen", "/workshop/les", "/agenda/beurs", "/event/beurs", "/project/vest", "/nieuwsbrief/issue", "/over-ons", "/prijzen", "/zoeken"]) {
    const meta = buildMarketPageMetadata({ title: "Publicatie", path, robots: { index: true }, languages: { "nl-NL": "https://evil.example" } }, decision("hobbysalon.nl"));
    assert.equal(robots(meta).index, false, path);
    assert.equal(robots(meta).follow, true, path);
    assert.equal(meta.alternates?.canonical, `https://hobbysalon.nl${path}`);
    assert.equal(meta.alternates?.languages, undefined, path);
  }
});

test("private route families are explicit noindex/nofollow in both markets", () => {
  for (const prefix of ["account", "auth", "cart", "checkout", "dashboard", "beheer", "favorites", "login", "profile", "register", "onboarding", "wachtwoord-vergeten"]) {
    for (const path of [`/${prefix}`, `/${prefix}/nested`]) {
      assert.equal(isPrivatePath(path), true, path);
      for (const host of ["www.hobbysalon.be", "hobbysalon.nl"]) {
        const meta = buildMarketPageMetadata({ title: "Privé", path, robots: { index: true } }, decision(host));
        assert.deepEqual(robots(meta), { index: false, follow: false }, path);
        assert.equal(meta.alternates, null);
      }
    }
  }
  assert.equal(isPrivatePath("/accounting"), false);
  assert.deepEqual(PRIVATE_PAGE_METADATA.robots, { index: false, follow: false });
});

test("root/public default is fail-closed for NL; only child robots override it", () => {
  assert.deepEqual(marketDefaultRobots(decision("hobbysalon.nl")), { index: false, follow: true });
  assert.deepEqual(marketDefaultRobots(decision("www.hobbysalon.be")), { index: true, follow: true });
  assert.deepEqual(marketDefaultRobots(decision("preview.vercel.app")), { index: false, follow: true });
  const source = readFileSync(new URL("../../app/(public)/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /generateMetadata/);
  assert.match(source, /marketDefaultRobots/);
  assert.doesNotMatch(source, /canonical\s*:/);
});

test("disabled gates and untrusted hosts cannot index or emit hreflang", () => {
  for (const env of [{ ...launch, ENABLE_NL_MARKET: "false" }, { ...launch, ALLOW_NL_MARKET_IN_PRODUCTION: "false" }]) {
    const meta = buildMarketPageMetadata({ title: "NL", path: "/workshops" }, decision("hobbysalon.nl", env));
    assert.equal(robots(meta).index, false);
    assert.equal(meta.alternates?.languages, undefined);
  }
  const meta = buildMarketPageMetadata({ title: "Preview", path: "/" }, decision("evil.example"));
  assert.equal(robots(meta).index, false);
  assert.equal(meta.alternates?.languages, undefined);
  assert.equal(meta.alternates?.canonical, "https://www.hobbysalon.be");
});

test("an explicit page-level noindex cannot be upgraded on a regional landing", () => {
  const meta = buildMarketPageMetadata({ title: "Niet publiceren", path: "/workshops", robots: { index: false } }, decision("hobbysalon.nl"));
  assert.equal(robots(meta).index, false);
  assert.equal(meta.alternates?.languages, undefined);
});
