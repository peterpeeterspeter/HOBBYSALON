// Run: node --test scripts/tests/graph-presentation.test.mjs
// Source-bound regression for the actual public article page's GraphSection
// title/collection wiring. This does NOT render React or test browser output.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageUrl = new URL("../../apps/storefront/src/app/(public)/artikel/[slug]/page.tsx", import.meta.url);
const source = readFileSync(pageUrl, "utf8");

function productSection(collection) {
  const pattern = new RegExp(`\\{${collection}\\.length > 0 && \\(\\s*<GraphSection\\b([^>]*)>([\\s\\S]*?)<\\/GraphSection>`);
  const sections = [...source.matchAll(new RegExp(pattern.source, "g"))];
  assert.equal(sections.length, 1, `Exactly one source-bound ${collection} GraphSection exists`);
  const [, attributes, body] = sections[0];
  const title = attributes.match(/\btitle="([^"]+)"/)?.[1];
  assert.ok(title, "GraphSection has a literal title");
  assert.match(attributes, /\bseeAllHref="\/materials"/);
  assert.match(body, new RegExp(`\\{${collection}\\.map\\(`), "Title is bound to the intended product collection");
  assert.match(body, /<ProductCard\b/);
  return title;
}

test("source-bound relatedProducts heading recommends rather than claiming necessity (not React rendering)", () => {
  const title = productSection("relatedProducts");
  assert.notEqual(title, "Dit heb je nodig", "Related products are recommendations, not required materials");
  assert.ok(["Past bij dit project", "Aanbevolen producten"].includes(title), "Related products use a recommendation heading");
});

test("source-bound requiredMaterials keeps its necessity heading and own product collection", () => {
  assert.equal(productSection("requiredMaterials"), "Dit heb je nodig");
});

const productSource = readFileSync(new URL("../../apps/storefront/src/app/(public)/product/[slug]/page.tsx", import.meta.url), "utf8");

test("phase2: product project discovery wires its own collection and existing ProjectCard", () => {
  const sections = [...productSource.matchAll(/\{data\.relatedProjects\.length > 0 && \(\s*<EntityLinkBlock\s+title="([^"]+)"[^>]*>([\s\S]*?)<\/EntityLinkBlock>/g)];
  assert.equal(sections.length, 1);
  assert.equal(sections[0][1], "Ontdek projecten bij dit product");
  assert.match(sections[0][2], /data\.relatedProjects\.map\(/);
  assert.match(sections[0][2], /<ProjectCard\s+key=\{project\.id\}\s+project=\{project\}/);
  assert.match(productSource, /import \{[^}]*\bProjectCard\b[^}]*\} from "@\/components\/cards"/);
});

test("source-bound requiredTools keeps its tool heading and own product collection", () => {
  assert.equal(productSection("requiredTools"), "Benodigd gereedschap");
});
