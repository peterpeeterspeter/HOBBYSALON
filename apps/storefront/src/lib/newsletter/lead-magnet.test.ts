import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { buildConfirmationUrl, createConfirmationToken, normalizeNewsletterEmail, verifyConfirmationToken } from "./lead-magnet.ts";

test("normalizes a subscriber email for idempotent lead-magnet signup", () => {
  assert.equal(normalizeNewsletterEmail("  MAAKSTER@Example.be "), "maakster@example.be");
});

test("rejects malformed lead-magnet email input", () => {
  assert.equal(normalizeNewsletterEmail("geen-email"), null);
});

test("creates a signed confirmation token that is bound to its campaign and email", () => {
  const token = createConfirmationToken(
    { email: "maakster@example.be", leadMagnetCode: "haak-start" },
    "test-secret"
  );

  assert.deepEqual(verifyConfirmationToken(token, "test-secret"), {
    email: "maakster@example.be",
    leadMagnetCode: "haak-start",
  });
  assert.equal(verifyConfirmationToken(token, "wrong-secret"), null);
});

test("builds an encoded absolute confirmation URL", () => {
  assert.equal(
    buildConfirmationUrl("https://www.hobbysalon.be/", "signed token+/="),
    "https://www.hobbysalon.be/nieuwsbrief/bevestigen?token=signed+token%2B%2F%3D"
  );
});
