import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeNewsletterHtml } from "./sanitize-html";

test("sanitizeNewsletterHtml strips script tags and event handlers", () => {
  const dirty =
    '<p onclick="alert(1)">Hallo</p><script>alert(2)</script><a href="javascript:void(0)">x</a>';
  const clean = sanitizeNewsletterHtml(dirty);
  assert.match(clean, /Hallo/);
  assert.doesNotMatch(clean, /script/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /javascript:/i);
});

test("sanitizeNewsletterHtml replaces Acumbamail unsubscribe placeholder", () => {
  const html = '<a href="*|UNSUBSCRIBE_URL|*">Uitschrijven</a>';
  assert.equal(
    sanitizeNewsletterHtml(html),
    '<a href="#">Uitschrijven</a>'
  );
});
