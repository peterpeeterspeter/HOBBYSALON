import assert from "node:assert/strict";
import test from "node:test";
import { splitArticleBodyForFeaturedImage } from "./article-mid-image";

const PHOTO = "https://cdn.example.com/nijntje.jpg";

test("inserts before the stap-voor-stap heading when the body is long enough", () => {
  const body = [
    "Een overzicht van het project en waarom het leuk is om te haken. Je maakt een klein figuurtje met eenvoudige steken, zodat ook beginners het rustig kunnen volgen.",
    "",
    "## Materialen",
    "- Haakgaren maat 3 in wit en blauw of rood",
    "- Haaknaald 2,5 mm",
    "- Borduurgaren voor de ogen en neus",
    "- Fiberfill",
    "",
    "## Stap voor stap",
    "Begin met een ketting van 30 lossen en haak in spiralen verder tot de kop vorm krijgt.",
    "Daarna borduur je de ogen, naai je de oren vast en vul je het lijfje met fiberfill tot het stevig blijft staan.",
    "Werk de draadjes weg en controleer of de verhoudingen kloppen met het originele patroon.",
  ].join("\n");
  const split = splitArticleBodyForFeaturedImage(body, PHOTO);
  assert.ok(split);
  assert.ok(split.before.includes("Materialen"));
  assert.ok(split.after.startsWith("## Stap voor stap"));
});

test("skips when the header photo is already in the article text", () => {
  const body = `Intro over het haakwerk.\n\n![Nijntje](${PHOTO})\n\n## Stap voor stap\nHaak verder in het rond tot het lijfje stevig is en de oren rechtop staan.`;
  assert.equal(splitArticleBodyForFeaturedImage(body, PHOTO), null);
});

test("skips short articles", () => {
  assert.equal(splitArticleBodyForFeaturedImage("Kort stukje tekst.", PHOTO), null);
});
