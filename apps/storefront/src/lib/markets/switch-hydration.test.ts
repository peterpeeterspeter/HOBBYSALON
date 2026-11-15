import assert from "node:assert/strict";
import test from "node:test";
import { isNlMarketEnabled, type MarketCode } from "./config";
import { marketSwitchTargets } from "./urls";

for (const currentMarket of ["BE", "NL"] as const) {
  test(`country links retain the server decision in the ${currentMarket} browser`, () => {
    const enabled = isNlMarketEnabled({
      ENABLE_NL_MARKET: "true",
      VERCEL_ENV: "production",
      ALLOW_NL_MARKET_IN_PRODUCTION: "true",
    });
    const input = { currentMarket, currentPath: "/workshops?plaats=Gent", enabled };
    // Browser bundles do not receive unprefixed server environment variables.
    const browserInput = { ...input, env: {} };
    const targets = marketSwitchTargets(browserInput);
    assert.equal(targets.length, 2);
    assert.equal(targets.find((target) => target.current)?.code, currentMarket);
    assert.equal(targets.find((target) => target.current)?.href, input.currentPath);
  });
}

test("the serialized disabled decision wins over available server flags", () => {
  const input = {
    currentMarket: "BE" as MarketCode,
    currentPath: "/workshops",
    enabled: false,
    env: { ENABLE_NL_MARKET: "true" },
  };
  assert.deepEqual(marketSwitchTargets(input), []);
});
