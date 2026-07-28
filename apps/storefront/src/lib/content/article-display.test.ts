import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import {
  formatArticleDisplayTitle,
  getArticleTypeVisitorLabel,
  hasUsableArticleImage,
} from "./article-display.ts";

test("strips | Hobbysalon suffix only", () => {
  assert.equal(
    formatArticleDisplayTitle("Gehaakt mandje | Hobbysalon"),
    "Gehaakt mandje"
  );
});

test("strips - Hobbysalon suffix only", () => {
  assert.equal(
    formatArticleDisplayTitle("Beginnen met boetseren - Hobbysalon"),
    "Beginnen met boetseren"
  );
});

test("does not rewrite long editorial titles", () => {
  const long =
    "DIY toilettas naaien: stap voor stap met rits, voering en handige binnenvakjes";
  assert.equal(formatArticleDisplayTitle(long), long);
});

test("leaves titles without known suffixes unchanged", () => {
  assert.equal(formatArticleDisplayTitle("  Keramiek schaal  "), "Keramiek schaal");
});

test("visitor labels for hub types", () => {
  assert.equal(getArticleTypeVisitorLabel("tutorial"), "Stap voor stap");
  assert.equal(getArticleTypeVisitorLabel("guide"), "Technieken & uitleg");
  assert.equal(getArticleTypeVisitorLabel("inspiration"), "Creatieve ideeën");
  assert.equal(getArticleTypeVisitorLabel("interview"), "Makersverhalen");
});

test("usable image rejects empty and landing placeholders", () => {
  assert.equal(hasUsableArticleImage(null), false);
  assert.equal(hasUsableArticleImage(""), false);
  assert.equal(hasUsableArticleImage("/landing/placeholder-article.jpg"), false);
  assert.equal(hasUsableArticleImage("https://cdn.example.com/make.jpg"), true);
});
