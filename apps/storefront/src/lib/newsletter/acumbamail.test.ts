import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { buildAcumbamailSubscriberPayload } from "./acumbamail.ts";

test("builds an Acumbamail subscriber payload after confirmed consent", () => {
  assert.deepEqual(
    buildAcumbamailSubscriberPayload({
      email: "  MAAKSTER@EXAMPLE.COM ",
      firstName: "Marie",
      preferredCity: "Antwerpen",
      sourcePath: "/gratis-haakpatronen",
      confirmedAt: "2026-07-12T10:30:00.000Z",
    }),
    {
      email: "maakster@example.com",
      double_optin: 0,
      welcome_email: 0,
      update_subscriber: 1,
      voornaam: "Marie",
      plaats: "Antwerpen",
      taal: "nl",
      country: "BE",
      optin: 1,
      url: "/gratis-haakpatronen",
      added: "2026-07-12T10:30:00.000Z",
    }
  );
});
