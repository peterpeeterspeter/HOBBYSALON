import assert from "node:assert/strict";
import test from "node:test";
import { publicPage, pageParameters } from "./pageview";
import { counterRoute, countPageview } from "./consent-counter.server";

// Active public taxonomy read from the platform on 2026-11-15.
const activeDomains = [
  "card-making", "crochet", "diy", "felting", "glass-art", "jewelry-making",
  "knitting", "leathercraft", "lettering", "polymer-clay", "pottery", "scrapbooking", "sewing",
];
const sections = ["workshops", "artikels", "learning-paths", "supplies", "handmade"];

for (const domain of activeDomains) {
  test(`active public hobby ${domain} reaches both sanitizers`, () => {
    for (const suffix of ["", ...sections.map((section) => `/${section}`)]) {
      const route = `/${domain}${suffix}`;
      const page = publicPage(route);
      assert.equal(page?.path, route);
      assert.equal(counterRoute(page!.path), `/${domain}`, "preserve existing domain-level counter aggregation");
    }
  });
}

test("nested learning-path templates reach the counter without retaining their slug", () => {
  for (const domain of activeDomains) {
    // Synthetic contract input, not evidence that this detail is published.
    const page = publicPage(`/${domain}/learning-paths/private-name?token=secret#private`);
    assert.equal(page?.path, `/${domain}/learning-paths/detail`);
    assert.equal(counterRoute(page!.path), `/${domain}`);
    assert.equal(counterRoute(`/${domain}/learning-paths/private-name`), `/${domain}`);
  }
});

test("client and counter both reject private and unknown domain sections", () => {
  for (const path of ["/crochet/private-name", "/crochet/dashboard", "/crochet/settings",
    "/dashboard", "/login", "/profile/projects", "/api/analytics/pageview",
    "/unknown-hobby", "/crochet/learning-paths/name/extra", "/crochet/learning-paths/INVALID_SLUG"]) {
    assert.equal(publicPage(path), null, path);
    assert.equal(counterRoute(path), null, path);
  }
});

test("new hobby routes strip queries, fragments and external referrer details", () => {
  for (const host of ["www.hobbysalon.be", "hobbysalon.nl"]) {
    const page = pageParameters(`https://${host}/jewelry-making?email=private#token`, "https://www.google.com/search?q=private");
    assert.deepEqual(page, { page_location: `https://${host}/jewelry-making`, page_title: "Hobbydomein | Hobbysalon", page_referrer: "https://www.google.com" });
  }
});

test("counter writes only aggregate templates for restored routes", async () => {
  const writes: Array<{ fn: string; args: Record<string, string> }> = [];
  const client = { rpc: async (fn: string, args: Record<string, string>) => { writes.push({ fn, args }); return { error: null }; } };
  for (const domain of activeDomains) {
    const page = publicPage(`/${domain}/learning-paths/private-name`)!;
    assert.equal(await countPageview(client, { path: page.path, host: "hobbysalon.nl", consent: "granted", day: "2026-11-15" }), true);
    assert.deepEqual(writes.at(-1), { fn: "increment_pageview", args: { p_day: "2026-11-15", p_host: "hobbysalon.nl", p_route: `/${domain}`, p_consent: "granted" } });
  }
  const before = writes.length;
  assert.equal(await countPageview(client, { path: "/crochet/private-name", host: "hobbysalon.nl", consent: "denied" }), false);
  assert.equal(writes.length, before);
  assert.ok(!JSON.stringify(writes).includes("private-name"));
});
