import "server-only";

const backendUrl =
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000";

export type SellerAuthExchangeResult = {
  token: string;
  seller_id: string;
  member_id: string;
  seller_type: string;
};

export async function exchangeSupabaseSessionForSellerToken(
  supabaseAccessToken: string
): Promise<SellerAuthExchangeResult> {
  const response = await fetch(
    `${backendUrl}/store/platform/seller-auth/exchange`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | SellerAuthExchangeResult
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && "message" in payload && payload.message
        ? payload.message
        : "Kon geen verkoperssessie starten.";
    throw new Error(message);
  }

  if (!payload || !("token" in payload) || !payload.token) {
    throw new Error("Ongeldig antwoord van de commerce API.");
  }

  return payload;
}

export function getVendorPanelUrl(): string {
  return (
    process.env.VENDOR_PANEL_URL ??
    process.env.NEXT_PUBLIC_VENDOR_PANEL_URL ??
    "http://localhost:7000"
  ).replace(/\/$/, "");
}

export function buildVendorPanelHandoffUrl(token: string): string {
  const vendorPanelUrl = getVendorPanelUrl();
  const callback = new URL("/login/callback", vendorPanelUrl);
  callback.searchParams.set("token", token);
  return callback.toString();
}
