import "server-only";

import { headers } from "next/headers";
import { previewHostAllowlist } from "./config";
import { resolveMarketFromHeaders, type MarketResolution } from "./resolve";

/** Reads the platform host header. Forwarded-host is passed in and then ignored. */
export async function getRequestMarket(): Promise<MarketResolution> {
  const headerList = await headers();
  return resolveMarketFromHeaders({
    host: headerList.get("host"),
    forwardedHost: headerList.get("x-forwarded-host"),
    previewMarket: process.env.MARKET_PREVIEW_CODE ?? null,
    previewHostAllowlist: previewHostAllowlist(),
  });
}
