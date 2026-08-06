import assert from "node:assert/strict";
import test from "node:test";
import { parseArticleSteps } from "./parse-article-steps";

const SAMPLE_BARE_STAP_N = `
🛒 Materialenlijst

- katoenen garen
- haaknaald 4 mm

📋 STAP VOOR STAP

Voor je begint meet je de kruik op.

Stap 1: Maak de stekenproef

Haak met garen en naald 4 mm een proeflapje van 16 steken.

Stap 2: Zet de steken op

Maak 41 losse. Dit is de onderkant van je hoes.

Stap 3: Haak het hoofdpaneel

Werk in heen en weer gaande toeren tot ongeveer 32 cm hoog.

🎨 VARIATIES EN CREATIEVE IDEEËN

- streepjespatroon
`;

const SAMPLE_ATX = `
## 🛒 Materialenlijst

* garen

## 📋 Stap voor stap

Stap 1: **Glas** schoonmaken

Maak het glas vetvrij.

Stap 2: Papier snijden

Knip nette stroken.

## Tips

Nog iets anders.
`;

const SAMPLE_LIST_FALLBACK = `
📋 STAP VOOR STAP

Intro zonder genummerde stappen.

* dit is de eerste actie
* **tweede** actie met [link](https://example.com)
* derde actie

🎨 VARIATIES
`;

test("parses Stap N blocks under bare STAP VOOR STAP and stops at next section", () => {
  const steps = parseArticleSteps(SAMPLE_BARE_STAP_N);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].key, "step:list:1");
  assert.equal(steps[0].title, "Stap 1: Maak de stekenproef");
  assert.match(steps[0].detail ?? "", /proeflapje/);
  assert.equal(steps[1].title, "Stap 2: Zet de steken op");
  assert.equal(steps[2].title, "Stap 3: Haak het hoofdpaneel");
  assert.ok(!(steps[2].detail ?? "").includes("VARIATIES"));
});

test("parses Stap N under ATX heading", () => {
  const steps = parseArticleSteps(SAMPLE_ATX);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].title, "Stap 1: Glas schoonmaken");
  assert.match(steps[0].detail ?? "", /vetvrij/);
  assert.equal(steps[1].title, "Stap 2: Papier snijden");
});

test("falls back to list bullets when no Stap N headers", () => {
  const steps = parseArticleSteps(SAMPLE_LIST_FALLBACK);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].key, "step:list:1");
  assert.equal(steps[0].title, "dit is de eerste actie");
  assert.equal(steps[0].detail, null);
  assert.equal(steps[1].title, "tweede actie met link");
  assert.equal(steps[2].title, "derde actie");
});

test("returns empty when section missing", () => {
  assert.deepEqual(parseArticleSteps(""), []);
  assert.deepEqual(parseArticleSteps(null), []);
  assert.deepEqual(
    parseArticleSteps("## Materialenlijst\n\n- garen\n"),
    []
  );
});
