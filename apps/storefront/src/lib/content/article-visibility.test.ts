import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript runner requires the explicit extension.
import { canPublishArticlesToHub, toVideoEmbedUrl } from "./article-visibility.ts";

test("workshop hosts, shops and editors publish to the hub", () => {
  assert.equal(canPublishArticlesToHub({ creator_types: ["workshopgever"] }), true);
  assert.equal(canPublishArticlesToHub({ creator_types: ["maker", "supplier"] }), true);
  assert.equal(canPublishArticlesToHub({ creator_types: ["maker"], editorial_publisher: true }), true);
});

test("other creators keep articles on their profile", () => {
  assert.equal(canPublishArticlesToHub({ creator_types: ["maker"] }), false);
  assert.equal(canPublishArticlesToHub({ creator_types: ["content_creator", "organizer"] }), false);
  assert.equal(canPublishArticlesToHub({ creator_types: [] }), false);
  assert.equal(canPublishArticlesToHub(null), false);
});

test("YouTube links become privacy friendly embeds", () => {
  const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
  assert.equal(toVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), embed);
  assert.equal(toVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=42"), embed);
  assert.equal(toVideoEmbedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x"), embed);
  assert.equal(toVideoEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ"), embed);
  assert.equal(toVideoEmbedUrl("  https://www.youtube.com/embed/dQw4w9WgXcQ  "), embed);
});

test("Vimeo links become player embeds", () => {
  assert.equal(toVideoEmbedUrl("https://vimeo.com/76979871"), "https://player.vimeo.com/video/76979871");
  assert.equal(
    toVideoEmbedUrl("https://player.vimeo.com/video/76979871?h=abc"),
    "https://player.vimeo.com/video/76979871"
  );
});

test("other or broken links are refused", () => {
  for (const raw of [
    "",
    null,
    "not a url",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload",
    "https://vimeo.com/channels/staffpicks",
    "javascript:alert(1)",
  ]) {
    assert.equal(toVideoEmbedUrl(raw), null, String(raw));
  }
});
