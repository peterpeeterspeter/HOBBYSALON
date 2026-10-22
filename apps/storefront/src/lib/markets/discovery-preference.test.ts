import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOME_BE_HERO_TITLE,
  HOME_NL_HERO_TITLE,
  HOME_PAGE_CACHE_KEY,
  applyHardCountryFilter,
  homeHeroCopy,
  homePageCacheArgs,
  isPhysicalLocalListing,
  mergeLocalThenFill,
  rankByPreferredCountry,
  takePreferLocalThenRest,
} from "./discovery-preference";

type Row = {
  id: string;
  country_code: string | null;
  format_type?: string | null;
  title?: string;
};

describe("isPhysicalLocalListing", () => {
  it("matches physical in-market country", () => {
    assert.equal(
      isPhysicalLocalListing(
        { country_code: "NL", format_type: "in_person" },
        "NL"
      ),
      true
    );
  });

  it("rejects online and hybrid even when country matches", () => {
    assert.equal(
      isPhysicalLocalListing(
        { country_code: "NL", format_type: "online" },
        "NL"
      ),
      false
    );
    assert.equal(
      isPhysicalLocalListing(
        { country_code: "NL", format_type: "hybrid" },
        "nl"
      ),
      false
    );
  });

  it("rejects missing or unknown country as local", () => {
    assert.equal(
      isPhysicalLocalListing({ country_code: null }, "BE"),
      false
    );
    assert.equal(
      isPhysicalLocalListing({ country_code: "" }, "BE"),
      false
    );
    assert.equal(
      isPhysicalLocalListing({ country_code: "DE" }, "BE"),
      false
    );
  });
});

describe("hard filter vs preferred ranking", () => {
  const rows: Row[] = [
    { id: "nl-1", country_code: "NL", format_type: "in_person", title: "NL local" },
    { id: "be-1", country_code: "BE", format_type: "in_person", title: "BE local" },
    { id: "nl-online", country_code: "NL", format_type: "online", title: "NL online" },
    { id: "unknown", country_code: null, format_type: "in_person", title: "Unknown" },
    { id: "nl-2", country_code: "NL", format_type: "in_person", title: "NL late" },
  ];

  it("preferred ranking puts local physical first and keeps the other country", () => {
    const { ranked, localCount, totalCount } = rankByPreferredCountry(
      rows,
      "NL"
    );
    assert.equal(totalCount, 5);
    assert.equal(localCount, 2);
    assert.deepEqual(
      ranked.map((r) => r.id),
      ["nl-1", "nl-2", "be-1", "nl-online", "unknown"]
    );
    assert.ok(ranked.some((r) => r.id === "be-1"));
  });

  it("hard country filter keeps only that country", () => {
    const filtered = applyHardCountryFilter(rows, "NL");
    assert.deepEqual(
      filtered.map((r) => r.id),
      ["nl-1", "nl-online", "nl-2"]
    );
  });

  it("unknown country stays visible on BE preference (not local, not dropped)", () => {
    const { ranked, localCount } = rankByPreferredCountry(rows, "BE");
    assert.equal(localCount, 1);
    assert.ok(ranked.some((r) => r.id === "unknown"));
    assert.equal(ranked.find((r) => r.id === "be-1")?.id, "be-1");
    assert.equal(ranked[0]?.id, "be-1");
  });
});

describe("land before limit / truncation", () => {
  it("a local item beyond a global top-N still appears when preferred before limit", () => {
    const many: Row[] = [];
    for (let i = 0; i < 30; i++) {
      many.push({
        id: `be-${i}`,
        country_code: "BE",
        format_type: "in_person",
      });
    }
    many.push({
      id: "nl-deep",
      country_code: "NL",
      format_type: "in_person",
    });

    // Naive global top-24 would drop nl-deep (index 30). Preference + limit keeps it.
    const { page, localCount, totalCount } = takePreferLocalThenRest(
      many,
      "NL",
      24
    );
    assert.equal(totalCount, 31);
    assert.equal(localCount, 1);
    assert.equal(page[0]?.id, "nl-deep");
    assert.equal(page.length, 24);
    assert.ok(page.some((r) => r.country_code === "BE"));
  });

  it("facet totals: hard filter counts filtered set; ranking counts full visible set", () => {
    const rows: Row[] = [
      { id: "1", country_code: "NL", format_type: "in_person" },
      { id: "2", country_code: "BE", format_type: "in_person" },
      { id: "3", country_code: "NL", format_type: "online" },
      { id: "4", country_code: null, format_type: "in_person" },
    ];

    const hard = applyHardCountryFilter(rows, "NL");
    assert.equal(hard.length, 2);

    const soft = rankByPreferredCountry(rows, "NL");
    assert.equal(soft.totalCount, 4);
    assert.equal(soft.localCount, 1);
  });
});

describe("mergeLocalThenFill (search)", () => {
  it("fills after local without duplicates", () => {
    const local = [
      { id: "a" },
      { id: "b" },
    ];
    const filler = [
      { id: "a" },
      { id: "c" },
      { id: "d" },
    ];
    assert.deepEqual(
      mergeLocalThenFill(local, filler, 3).map((r) => r.id),
      ["a", "b", "c"]
    );
  });
});

describe("homepage copy and cache args", () => {
  it("keeps BE title unchanged and NL H1 exact", () => {
    assert.equal(homeHeroCopy("BE").title, HOME_BE_HERO_TITLE);
    assert.equal(homeHeroCopy("BE").title, "Zin om iets moois te maken?");
    assert.equal(
      homeHeroCopy("NL").title,
      HOME_NL_HERO_TITLE
    );
    assert.equal(
      homeHeroCopy("NL").title,
      "Ontdek creatieve workshops, hobbywinkels en materialen in Nederland"
    );
  });

  it("puts marketCode in cache args so BE/NL entries isolate", () => {
    const be = homePageCacheArgs("BE");
    const nl = homePageCacheArgs("NL");
    assert.equal(be.key, HOME_PAGE_CACHE_KEY);
    assert.equal(nl.key, HOME_PAGE_CACHE_KEY);
    assert.equal(be.marketCode, "BE");
    assert.equal(nl.marketCode, "NL");
    assert.notEqual(be.marketCode, nl.marketCode);
  });

  it("simulates concurrent BE/NL payloads without shared last-market state", async () => {
    // Pure stand-in for getHomePageData: returns market-specific payload from args only.
    async function fakeCachedHome(marketCode: "BE" | "NL") {
      const { marketCode: code } = homePageCacheArgs(marketCode);
      await new Promise((r) => setTimeout(r, code === "NL" ? 5 : 15));
      return {
        marketCode: code,
        heroTitle: homeHeroCopy(code).title,
        materials: code === "NL" ? [] : [{ id: "be-product" }],
      };
    }

    const [firstBe, firstNl] = await Promise.all([
      fakeCachedHome("BE"),
      fakeCachedHome("NL"),
    ]);
    assert.equal(firstBe.marketCode, "BE");
    assert.equal(firstNl.marketCode, "NL");
    assert.equal(firstBe.heroTitle, HOME_BE_HERO_TITLE);
    assert.equal(firstNl.heroTitle, HOME_NL_HERO_TITLE);
    assert.equal(firstNl.materials.length, 0);
    assert.ok(firstBe.materials.length > 0);

    const [secondNl, secondBe] = await Promise.all([
      fakeCachedHome("NL"),
      fakeCachedHome("BE"),
    ]);
    assert.equal(secondNl.marketCode, "NL");
    assert.equal(secondBe.marketCode, "BE");
    assert.equal(secondNl.materials.length, 0);
  });
});

describe("ENABLE_NL_MARKET on BE host — missing country codes stay", () => {
  it("BE preference keeps unknown-country rows in the rest bucket", () => {
    const rows: Row[] = [
      { id: "be", country_code: "BE", format_type: "in_person" },
      { id: "missing", country_code: null, format_type: "in_person" },
      { id: "nl", country_code: "NL", format_type: "in_person" },
    ];
    // Flag-on BE host still resolves market BE → preferred BE, not hard filter.
    const { ranked, localCount, totalCount } = rankByPreferredCountry(
      rows,
      "BE"
    );
    assert.equal(totalCount, 3);
    assert.equal(localCount, 1);
    assert.ok(ranked.some((r) => r.id === "missing"));
    assert.ok(ranked.some((r) => r.id === "nl"));
  });
});
