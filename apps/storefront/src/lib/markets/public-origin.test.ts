import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { MARKETS } from "./config.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import {
  authConfirmUrlForOrigin,
  fallbackPublicOrigin,
  publicOriginFromResolution,
} from "./public-origin.ts";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { resolveMarketFromHeaders } from "./resolve.ts";

const offEnv = {
  ENABLE_NL_MARKET: "false",
  NODE_ENV: "development",
};

const onPreviewEnv = {
  ENABLE_NL_MARKET: "true",
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
};

test("BE host resolves auth/public origin to Belgian canonical", () => {
  const resolution = resolveMarketFromHeaders({
    host: "www.hobbysalon.be",
    env: offEnv,
  });
  assert.equal(
    publicOriginFromResolution(resolution, offEnv),
    "https://www.hobbysalon.be"
  );
  assert.equal(
    authConfirmUrlForOrigin(publicOriginFromResolution(resolution, offEnv)),
    "https://www.hobbysalon.be/auth/confirm"
  );
});

test("NL host with flag on resolves auth/public origin to Nederlandse canonical", () => {
  const resolution = resolveMarketFromHeaders({
    host: "hobbysalon.nl",
    env: onPreviewEnv,
  });
  assert.equal(resolution.market.marketCode, "NL");
  assert.equal(
    publicOriginFromResolution(resolution, onPreviewEnv),
    MARKETS.NL.canonicalOrigin
  );
  assert.equal(
    authConfirmUrlForOrigin(publicOriginFromResolution(resolution, onPreviewEnv)),
    "https://hobbysalon.nl/auth/confirm"
  );
});

test("NL host with flag off falls back to BE origin for redirects", () => {
  const resolution = resolveMarketFromHeaders({
    host: "www.hobbysalon.nl",
    env: offEnv,
  });
  assert.equal(resolution.trustedHost, false);
  assert.equal(
    publicOriginFromResolution(resolution, offEnv),
    MARKETS.BE.canonicalOrigin
  );
});

test("fallbackPublicOrigin prefers NEXT_PUBLIC_SITE_URL then BE", () => {
  assert.equal(
    fallbackPublicOrigin({ NEXT_PUBLIC_SITE_URL: "https://www.hobbysalon.be/" }),
    "https://www.hobbysalon.be"
  );
  assert.equal(fallbackPublicOrigin({}), MARKETS.BE.canonicalOrigin);
});
