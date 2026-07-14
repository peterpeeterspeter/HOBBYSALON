import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveDeliveryAsset } from "./delivery-asset-resolution.ts";

test("resolves only explicitly registered delivery assets", () => {
  const registry = {
    "haak-startpakket-v1": {
      assetPath: "src/lib/newsletter/assets/haken-startgids-v1.pdf",
      filename: "hobbysalon-startgids-haken.pdf",
    },
  };

  assert.deepEqual(resolveDeliveryAsset(registry, "haak-startpakket-v1"), {
    assetPath: "src/lib/newsletter/assets/haken-startgids-v1.pdf",
    filename: "hobbysalon-startgids-haken.pdf",
  });
  assert.equal(resolveDeliveryAsset(registry, "active-db-campaign-not-in-registry"), null);
});
