import { cookies } from "next/headers";
import { CONSENT_GENERATION_KEY, parseConversionReceipts, validConsentGeneration } from "@/lib/analytics/conversions";
import { dispatchConversion } from "@/lib/analytics/conversion-dispatch.server";
import { verifyConversion, conversionUnavailable, conversionConfigured } from "@/lib/analytics/conversion-security.server";
import { createPlatformClient } from "@/lib/platform/client";

export async function POST(request: Request): Promise<Response> {
  const empty = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  try {
    const url = new URL(request.url);
    if (request.headers.get("origin") !== url.origin || url.protocol !== "https:" ||
        request.headers.get("sec-fetch-site") === "cross-site" ||
        !request.headers.get("content-type")?.startsWith("application/json")) return empty();
    const market = /^(www\.)?hobbysalon\.be$/.test(url.hostname) ? "BE"
      : /^(www\.)?hobbysalon\.nl$/.test(url.hostname) ? "NL" : null;
    if (!market) return empty();
    const store = await cookies();
    const generation = store.get(CONSENT_GENERATION_KEY)?.value;
    const allowed = () => !request.signal.aborted && store.get("hs_posthog_consent_v1")?.value === "granted" &&
      store.get(CONSENT_GENERATION_KEY)?.value === generation;
    if (!allowed() || !validConsentGeneration(generation) || !conversionConfigured()) return empty();
    if (Number(request.headers.get("content-length") ?? 0) > 3500) return empty();
    const receipts = parseConversionReceipts(await request.text());
    for (const receipt of receipts) {
      if (!allowed() || !verifyConversion(receipt, generation)) continue;
      // Durable unique INSERT before the single capture attempt. Never release/retry
      // a claim, including timeout or uncertain delivery. No account IDs here.
      const { data, error } = await createPlatformClient().from("analytics_receipt_claims")
        .insert({ receipt_id: receipt.id }).select("receipt_id").maybeSingle();
      if (error) { if (error.code !== "23505") conversionUnavailable(); continue; }
      if (data?.receipt_id && allowed()) await dispatchConversion(receipt, market);
    }
  } catch { conversionUnavailable(); }
  return empty();
}
