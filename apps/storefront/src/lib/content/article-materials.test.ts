import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { parseArticleMaterialRequirements } from "./article-materials.ts";

test("parses only explicit material sections, including emoji headings", () => {
  const items = parseArticleMaterialRequirements(`
## In het kort
- geen materiaal

## 🛒 Materialenlijst
- Glad garen
- Breinaalden
- 1. Breinaalden

Een rustige uitleg die niet mag worden gelezen als materiaal.
`);

  assert.deepEqual(items, [
    { key: "material:article:glad-garen", title: "Glad garen", kind: "material", detail: null },
    { key: "material:article:breinaalden", title: "Breinaalden", kind: "material", detail: null },
  ]);
});

test("returns no requirements when there is no explicit materials section", () => {
  assert.deepEqual(parseArticleMaterialRequirements("## Tips\n- Kies rustig garen"), []);
});