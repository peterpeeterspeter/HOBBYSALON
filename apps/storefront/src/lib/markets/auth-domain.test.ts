import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { sanitizeInternalRedirect } from "../auth/safe-redirect.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { MARKETS } from "./config.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import {
  authConfirmUrlForOrigin,
  publicOriginFromResolution,
} from "./public-origin.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveMarketFromHeaders } from "./resolve.ts";

const onPreviewEnv = {
  ENABLE_NL_MARKET: "true",
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
};

const offEnv = {
  ENABLE_NL_MARKET: "false",
  NODE_ENV: "development",
};

test("registration/reset confirm links follow the BE host", () => {
  const origin = publicOriginFromResolution(
    resolveMarketFromHeaders({ host: "www.hobbysalon.be", env: offEnv }),
    offEnv
  );
  assert.equal(origin, MARKETS.BE.canonicalOrigin);
  assert.equal(
    authConfirmUrlForOrigin(origin),
    "https://www.hobbysalon.be/auth/confirm"
  );
});

test("registration/reset confirm links follow the NL host when the flag is on", () => {
  const origin = publicOriginFromResolution(
    resolveMarketFromHeaders({ host: "hobbysalon.nl", env: onPreviewEnv }),
    onPreviewEnv
  );
  assert.equal(origin, MARKETS.NL.canonicalOrigin);
  assert.equal(
    authConfirmUrlForOrigin(origin),
    "https://hobbysalon.nl/auth/confirm"
  );
});

test("safe internal redirects accept the same paths under BE and NL site bases", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    for (const site of [
      MARKETS.BE.canonicalOrigin,
      MARKETS.NL.canonicalOrigin,
    ]) {
      process.env.NEXT_PUBLIC_SITE_URL = site;
      assert.equal(sanitizeInternalRedirect("/profile"), "/profile");
      assert.equal(
        sanitizeInternalRedirect("/cart?x=1#frag"),
        "/cart?x=1"
      );
      assert.equal(sanitizeInternalRedirect("//evil.example"), null);
      assert.equal(sanitizeInternalRedirect("https://evil.example"), null);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("BE host resolution and auth origin stay stable while NL flag is off", () => {
  const resolved = resolveMarketFromHeaders({
    host: "www.hobbysalon.be",
    env: offEnv,
  });
  assert.equal(resolved.market.marketCode, "BE");
  assert.equal(resolved.trustedHost, true);
  assert.equal(
    publicOriginFromResolution(resolved, offEnv),
    "https://www.hobbysalon.be"
  );
});
