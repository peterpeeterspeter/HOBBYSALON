import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorMatchesSearch,
  formatCreatorOfferSentence,
  formatCreatorSpecialtyLine,
  hasReliableCreatorPlaceCoverage,
  resolveCreatorCardPhoto,
  resolveCreatorIntentFilter,
  resolveHobbyChipDomainIds,
} from "./creators-directory-helpers";

test("resolveCreatorIntentFilter maps intents and legacy types", () => {
  assert.deepEqual(resolveCreatorIntentFilter("workshops"), {
    kind: "type",
    creatorType: "workshopgever",
  });
  assert.deepEqual(resolveCreatorIntentFilter("handmade"), {
    kind: "type",
    creatorType: "maker",
  });
  assert.deepEqual(resolveCreatorIntentFilter("materials"), {
    kind: "type",
    creatorType: "supplier",
  });
  assert.deepEqual(resolveCreatorIntentFilter("markets"), { kind: "markets" });
  assert.deepEqual(resolveCreatorIntentFilter(null, "workshopgever"), {
    kind: "type",
    creatorType: "workshopgever",
  });
  assert.equal(resolveCreatorIntentFilter(null, null), null);
});

test("formatCreatorOfferSentence builds human Dutch line", () => {
  assert.equal(
    formatCreatorOfferSentence(["workshopgever", "maker"]),
    "Geeft workshops en maakt handgemaakte creaties"
  );
  assert.equal(
    formatCreatorOfferSentence(["supplier"]),
    "Verkoopt materialen"
  );
  assert.equal(
    formatCreatorOfferSentence(["maker"], true),
    "Maakt handgemaakte creaties en staat op hobbymarkten"
  );
  assert.equal(
    formatCreatorOfferSentence([]),
    "Creatieve maker op Hobbysalon"
  );
});

test("resolveCreatorCardPhoto prefers banner then avatar", () => {
  assert.equal(
    resolveCreatorCardPhoto({
      banner_url: "https://cdn/banner.jpg",
      avatar_url: "https://cdn/avatar.jpg",
    }),
    "https://cdn/banner.jpg"
  );
  assert.equal(
    resolveCreatorCardPhoto({ banner_url: null, avatar_url: "https://cdn/a.jpg" }),
    "https://cdn/a.jpg"
  );
  assert.equal(
    resolveCreatorCardPhoto({ banner_url: "  ", avatar_url: null }),
    null
  );
});

test("formatCreatorSpecialtyLine combines domain and city", () => {
  assert.equal(
    formatCreatorSpecialtyLine({
      domainNames: ["Keramiek", "Haken"],
      city: "Herentals",
    }),
    "Keramiek · Haken · Herentals"
  );
  assert.equal(
    formatCreatorSpecialtyLine({ domainNames: [], city: "Gent", bio: "Klei" }),
    "Klei · Gent"
  );
});

test("hasReliableCreatorPlaceCoverage uses 30% threshold", () => {
  assert.equal(
    hasReliableCreatorPlaceCoverage([
      { city: "A" },
      { city: null },
      { city: null },
      { city: null },
    ]),
    false
  );
  assert.equal(
    hasReliableCreatorPlaceCoverage([
      { city: "A" },
      { city: "B" },
      { city: null },
    ]),
    true
  );
});

test("resolveHobbyChipDomainIds keeps selected sticky", () => {
  assert.deepEqual(
    resolveHobbyChipDomainIds({
      domainIdsWithCreators: ["d2"],
      selectedDomainId: "d1",
      allDomainIdsOrdered: ["d1", "d2", "d3"],
    }),
    ["d1", "d2"]
  );
});

test("creatorMatchesSearch includes domain names", () => {
  assert.equal(
    creatorMatchesSearch(
      {
        display_name: "Ingrid",
        business_name: "Studio Ingrid",
        bio: null,
        city: null,
      },
      ["Keramiek"],
      "keramiek"
    ),
    true
  );
});
