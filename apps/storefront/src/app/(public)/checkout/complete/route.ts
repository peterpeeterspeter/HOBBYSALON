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
      return NextResponse.redirect(
        `${origin}/checkout/success?order=${result.orderSetId}`
      );
    }
  }

  if (redirectStatus === "failed") {
    return NextResponse.redirect(
      `${origin}/checkout?payment_error=1`
    );
  }

  return NextResponse.redirect(`${origin}/checkout/success`);
}
