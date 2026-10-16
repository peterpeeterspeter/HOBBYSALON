// Browser-safe conversion contract; no customer identities or raw URLs.
export const CONVERSION_COOKIE = "hs_conversion_receipt";
export type ConversionReceipt = {
  id: string;
  event: "sign_up" | "listing_published" | "newsletter_signup";
  payload: Record<string, string>;
};

export function newsletterSuccessEvent(success: boolean, leadMagnetCode?: string): "newsletter_signup" | "newsletter_signup_requested" | null {
  if (!success) return null;
  return leadMagnetCode ? "newsletter_signup_requested" : "newsletter_signup";
}

export function parseConversionReceipt(raw: string): ConversionReceipt | null {
  try {
    if (raw.length > 1024) return null;
    const receipt = JSON.parse(raw);
    if (!receipt || typeof receipt.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(receipt.id)) return null;
    const payload = receipt.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    if (receipt.event === "sign_up" && payload.method === "email") {
      return { id: receipt.id, event: "sign_up", payload: { method: "email" } };
    }
    if (receipt.event === "listing_published" && ["handmade", "destash"].includes(payload.listing_type)) {
      return { id: receipt.id, event: "listing_published", payload: { listing_type: payload.listing_type } };
    }
    if (receipt.event === "newsletter_signup" && payload.signup_source === "lead_magnet_form" && payload.opt_in_method === "double") {
      return { id: receipt.id, event: "newsletter_signup", payload: { signup_source: "lead_magnet_form", opt_in_method: "double" } };
    }
    return null;
  } catch { return null; }
}
