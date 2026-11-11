import assert from "node:assert/strict";
import test from "node:test";
import { buildArticleBreadcrumbTrail } from "./article-breadcrumb.ts";

test("pattern article uses Patronen hub and domain", () => {
  const trail = buildArticleBreadcrumbTrail(
    {
      slug: "nijntje-haken-gratis-nederlands-patroonoverzicht",
      title: "Nijntje haken: gratis Nederlands patroonoverzicht",
      article_type: "pattern",
      crafts: ["haken"],
      domain_id: "d1111111-1111-1111-1111-111111111101",
    },
    { name: "Haken", slug: "crochet" }
  );
  assert.deepEqual(
    trail.map((item) => item.name),
    ["Home", "Patronen", "Haken", "Nijntje haken: gratis Nederlands patroonoverzicht"]
  );
  assert.equal(trail[2]?.path, "/patronen?domain=crochet");
});

test("tutorial without domain falls back to first craft label", () => {
  const trail = buildArticleBreadcrumbTrail(
    {
      slug: "voorbeeld",
      title: "Voorbeeldartikel",
      article_type: "tutorial",
      crafts: ["breien"],
      domain_id: null,
    },
    null
  );
  assert.deepEqual(
    trail.map((item) => item.name),
    ["Home", "Artikelen", "Breien", "Voorbeeldartikel"]
  );
  assert.equal(trail[2]?.path, undefined);
});
