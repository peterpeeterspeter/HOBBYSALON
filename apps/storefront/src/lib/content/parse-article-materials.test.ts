import assert from "node:assert/strict";
import test from "node:test";
import {
  materialsTitlesMatch,
  mergeMaterialsWithProducts,
  parseArticleMaterials,
  slugifyMaterialTitle,
} from "./parse-article-materials";

const SAMPLE_ATX = `
Intro tekst.

## 🛒 Materialenlijst

Voor een mooi beginnersproject heb je geen overvolle hobbykast nodig.

* glazen waxinelichthouder, jampotje of klein vaasje
* **decoupagelaklijm** geschikt voor papier en glas
* dun [decoratiepapier](https://example.com/papier), strozijdepapier of servetpapier
* eventueel metallic papier voor accenten

## 📋 Stap voor stap

* dit is geen materiaal
Begin met het glas schoon te maken.
`;

const SAMPLE_BARE = `
🌸 In het kort

Iets over het project.

🛒 Materialenlijst

- 1x zachte platte kwast
- klein schaartje

📋 Stap voor stap

Doe dit eerst.
`;

test("parses Materialenlijst under ATX heading and stops at next same-level heading", () => {
  const items = parseArticleMaterials(SAMPLE_ATX);
  assert.equal(items.length, 4);
  assert.equal(items[0].title, "glazen waxinelichthouder, jampotje of klein vaasje");
  assert.equal(items[1].title, "decoupagelaklijm geschikt voor papier en glas");
  assert.equal(
    items[2].title,
    "dun decoratiepapier, strozijdepapier of servetpapier"
  );
  assert.ok(!items.some((item) => item.title.includes("geen materiaal")));
});

test("parses bare emoji Materialenlijst heading and stops at next bare section", () => {
  const items = parseArticleMaterials(SAMPLE_BARE);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "zachte platte kwast");
  assert.equal(items[1].title, "klein schaartje");
});

test("ignores prose intro and only takes list lines", () => {
  const items = parseArticleMaterials(`
## Materialenlijst

Kies liever een kleine set.

Niet dit paragraph als item.

* echte lijstregel
`);
  assert.deepEqual(
    items.map((item) => item.title),
    ["echte lijstregel"]
  );
});

test("strips markdown links and bold from bullets", () => {
  const items = parseArticleMaterials(`
## Materialenlijst

* [**Glazen potje**](https://shop.example/pot) of vaasje
`);
  assert.equal(items[0].title, "Glazen potje of vaasje");
});

test("uses stable keys from normalized titles and dedupes", () => {
  const items = parseArticleMaterials(`
## Materialenlijst

* Glazen potje
* glazen potje
`);
  assert.equal(items.length, 1);
  assert.equal(items[0].key, `material:list:${slugifyMaterialTitle("Glazen potje")}`);
});

test("returns empty when section is missing", () => {
  assert.deepEqual(parseArticleMaterials("## Andere sectie\n\n* item"), []);
  assert.deepEqual(parseArticleMaterials(null), []);
});

test("parses Benodigdheden as materials section", () => {
  const items = parseArticleMaterials(`
## Benodigdheden

* Restjes garen in meerdere kleuren
* Haaknaald 2,5 mm
* Vulling

## Het lijf haken

* Toer 1: 6 v
`);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Restjes garen in meerdere kleuren");
  assert.equal(items[1].title, "Haaknaald 2,5 mm");
  assert.ok(!items.some((item) => item.title.includes("Toer")));
});

test("parses Dit heb je nodig alias", () => {
  const items = parseArticleMaterials(`
### Dit heb je nodig

- garen
- naald
`);
  assert.deepEqual(
    items.map((i) => i.title),
    ["garen", "naald"]
  );
});

test("matches product titles with containment and token overlap", () => {
  assert.equal(
    materialsTitlesMatch(
      "glazen waxinelichthouder, jampotje of klein vaasje",
      "Glazen waxinelichthouder"
    ),
    true
  );
  assert.equal(
    materialsTitlesMatch("zachte platte kwast", "LED-waxinelichtje"),
    false
  );
});

test("attaches matching products to checklist and leaves unmatched as offers", () => {
  const checklist = parseArticleMaterials(SAMPLE_ATX);
  const { materials, offers } = mergeMaterialsWithProducts(checklist, [
    {
      id: "p1",
      title: "Glazen waxinelichthouder",
      slug: "glazen-waxinelichthouder",
      short_description: "Voor tea lights",
    },
    {
      id: "p2",
      title: "Acrylverf set",
      slug: "acrylverf-set",
    },
  ]);

  const matched = materials.find((item) =>
    item.title.startsWith("glazen waxinelichthouder")
  );
  assert.ok(matched?.href === "/product/glazen-waxinelichthouder");
  assert.equal(matched?.linkLabel, "Bekijk");
  assert.equal(offers.length, 1);
  assert.equal(offers[0].title, "Acrylverf set");
  assert.equal(offers[0].kind, "offer");
  assert.ok(!materials.some((item) => item.title === "Acrylverf set"));
});
