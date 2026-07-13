import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { toActiveNewsletterLeadMagnet } from "./newsletter-lead-magnet.ts";

test("returns a display-safe active lead magnet", () => {
  assert.deepEqual(
    toActiveNewsletterLeadMagnet({
      id: "campaign-id",
      code: "haak-startpakket-v1",
      title: "Hobbysalon Startgids Haken",
      is_active: true,
    }),
    {
      id: "campaign-id",
      code: "haak-startpakket-v1",
      title: "Hobbysalon Startgids Haken",
    }
  );
});

test("hides incomplete or inactive lead magnets", () => {
  assert.equal(
    toActiveNewsletterLeadMagnet({
      id: "campaign-id",
      code: "haak-startpakket-v1",
      title: "Hobbysalon Startgids Haken",
      is_active: false,
    }),
    null
  );
  assert.equal(toActiveNewsletterLeadMagnet({ id: "campaign-id" }), null);
});
