import { cookies } from "next/headers";
import { PLATFORM_RETURN_COOKIE } from "@/lib/analytics/conversions";
import { conversionGeneration, conversionUnavailable } from "@/lib/analytics/conversion-security.server";
import { queueConversion } from "@/lib/analytics/conversions.server";
import { platformReturnCookieOptions, safePlatformOrigin, verifyPlatformReturn } from "@/lib/analytics/platform-return.server";
import { createPlatformClient } from "@/lib/platform/client";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Query input can only select a fixed legacy UX destination, never a URL.
  const kind = url.searchParams.get("kind");
  const path = kind === "workshop_listing" ? "/dashboard/workshops?checkout=pending&type=workshop_listing"
    : kind === "credit_pack" ? "/dashboard/products?checkout=pending&type=credits"
    : kind === "plan" ? "/dashboard/products?checkout=pending&type=plan" : "/dashboard";
  const origin = safePlatformOrigin(url) ? url.origin : "https://www.hobbysalon.be";
  const response = new Response(null, { status: 303, headers: {
    Location: `${origin}${path}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
  } });
  try {
    // Stripe returns by top-level cross-site GET; Origin/Sec-Fetch-Site cannot
    // require same-origin here. Signed host+session binding authenticates state.
    if (!safePlatformOrigin(url) || request.signal.aborted) return response;
    const generation = await conversionGeneration();
    if (!generation) return response;
    const store = await cookies();
    const raw = store.get(PLATFORM_RETURN_COOKIE)?.value ?? "";
    const state = verifyPlatformReturn(raw, generation, url);
    if (!state) return response;
    store.set(PLATFORM_RETURN_COOKIE, "", { ...platformReturnCookieOptions, maxAge: 0 });
    if (request.signal.aborted || await conversionGeneration() !== generation) return response;
    // Durable nonce uniqueness before one queue attempt. Never release a claim
    // or retry a failed/uncertain delivery; this is a return, NOT a purchase.
    const { data, error } = await createPlatformClient().from("analytics_conversion_claims")
      .insert({ event: "platform_charge_returned", entity_id: state.nonce }).select("entity_id").maybeSingle();
    if (error) { if (error.code !== "23505") conversionUnavailable(); return response; }
    if (data?.entity_id && !request.signal.aborted && await conversionGeneration() === generation) {
      await queueConversion("platform_charge_returned", { charge_kind: state.charge_kind });
    }
  } catch { /* Analytics failure must not prevent the fixed dashboard return. */ }
  return response;
}
