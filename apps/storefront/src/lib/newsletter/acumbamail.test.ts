import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { acumbamailListId, buildAcumbamailSubscriberPayload, isAcumbamailSyncConfigured } from "./acumbamail.ts";

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
      Voornaam: "Marie",
      Plaats: "Antwerpen",
      Taal: "nl",
      country: "BE",
      optin: "1",
      url: "/gratis-haakpatronen",
      added: "2026-07-12T10:30:00.000Z",
    }
  );
});

test("rejects invalid email before payload build", () => {
  assert.throws(
    () =>
      buildAcumbamailSubscriberPayload({
        email: "not-an-email",
        firstName: null,
        preferredCity: null,
        sourcePath: "/footer",
        confirmedAt: "2026-07-12T10:30:00.000Z",
      }),
    /Ongeldig e-mailadres/
  );
});

test("isAcumbamailSyncConfigured is false under test NODE_ENV", () => {
  assert.equal(isAcumbamailSyncConfigured(), false);
});

test("defaults to the Hobbysalon Subscribers list", () => {
  const previous = process.env.ACUMBAMAIL_LIST_ID;
  delete process.env.ACUMBAMAIL_LIST_ID;
  assert.equal(acumbamailListId(), "836565");
  if (previous === undefined) delete process.env.ACUMBAMAIL_LIST_ID;
  else process.env.ACUMBAMAIL_LIST_ID = previous;
});
