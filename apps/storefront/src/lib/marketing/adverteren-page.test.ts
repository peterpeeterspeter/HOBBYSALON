import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { ADVERTEREN_PAGE } from "./adverteren-page.ts";

describe("ADVERTEREN_PAGE", () => {
  it("exposes four priced tiers and a package discount", () => {
    assert.equal(ADVERTEREN_PAGE.tiers.length, 4);
    assert.equal(ADVERTEREN_PAGE.tiers[0].price, "€49");
    assert.equal(ADVERTEREN_PAGE.tiers[1].price, "€99");
    assert.equal(ADVERTEREN_PAGE.tiers[2].price, "€149");
    assert.equal(ADVERTEREN_PAGE.tiers[3].price, "€299");
    assert.match(ADVERTEREN_PAGE.packageBody, /15%/);
  });

  it("keeps sponsorship conditions and mailto CTA", () => {
    assert.ok(
      ADVERTEREN_PAGE.conditions.some((c) => c.includes("Gesponsord"))
    );
    assert.ok(
      ADVERTEREN_PAGE.conditions.some((c) =>
        c.toLowerCase().includes("sponsorblok")
      )
    );
    assert.ok(
      ADVERTEREN_PAGE.conditions.some((c) =>
        c.toLowerCase().includes("aparte mailing")
      )
    );
    assert.match(ADVERTEREN_PAGE.primaryCta.href, /^mailto:info@hobbysalon\.be/);
  });

  it("lists audience stats and top hobbies", () => {
    assert.ok(
      ADVERTEREN_PAGE.audienceStats.some((s) => s.value.includes("45.000"))
    );
    assert.ok(
      ADVERTEREN_PAGE.audienceStats.some((s) => s.detail.includes("12.250"))
    );
    assert.deepEqual(
      [...ADVERTEREN_PAGE.hobbies],
      [
        "Haken",
        "Kaarten maken",
        "Breien",
        "Borduren en handwerk",
        "Naaien",
        "Juwelen",
      ]
    );
  });
});
