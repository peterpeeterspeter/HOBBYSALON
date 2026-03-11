import { NextRequest, NextResponse } from "next/server";
import { checkoutComplete } from "@/app/actions/checkout";

/**
 * Stripe redirects here after payment (3DS or card auth).
 * redirect_status: succeeded | failed | ...
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const searchParams = request.nextUrl.searchParams;
  const redirectStatus = searchParams.get("redirect_status");

  if (redirectStatus === "succeeded") {
    const result = await checkoutComplete({ redirect: false });
    if (result.success && result.orderSetId) {
      const params = new URLSearchParams({
        order: result.orderSetId,
      });
      if ((result.bundleCount ?? 0) > 0) {
        if (result.bundleId) {
          params.set("bundle_id", result.bundleId);
        }
        params.set("bundle_count", String(result.bundleCount));
        params.set("bundle_value", String(result.bundleValue ?? 0));
        if (result.bundleIds?.length) {
          params.set("bundle_ids", result.bundleIds.join(","));
        }
      }
      return NextResponse.redirect(
        `${origin}/checkout/success?${params.toString()}`
      );
    }
    return NextResponse.redirect(`${origin}/checkout?payment_error=1`);
  }

  if (redirectStatus === "failed" || redirectStatus === "canceled") {
    return NextResponse.redirect(
      `${origin}/checkout?payment_error=1`
    );
  }

  return NextResponse.redirect(`${origin}/checkout?payment_error=1`);
}
