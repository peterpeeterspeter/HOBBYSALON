import "server-only";
import { getRequestMarket } from "./request";
import { marketSeoDecision } from "./seo-policy";
import { buildMarketPageMetadata } from "./page-seo";
import type { BuildPageMetadataInput } from "../seo";

/** Metadata-only adapter; does not alter discovery or commerce data. */
export async function buildRequestPageMetadata(input: BuildPageMetadataInput) {
  const resolution = await getRequestMarket();
  return buildMarketPageMetadata(input, marketSeoDecision(resolution));
}
