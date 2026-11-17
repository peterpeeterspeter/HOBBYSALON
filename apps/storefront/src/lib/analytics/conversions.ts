// Browser-safe conversion contract; no customer identities or raw URLs.
export const CONVERSION_COOKIE = "hs_conversion_receipt";
export const PLATFORM_RETURN_COOKIE = "hs_platform_return";
export type PlatformChargeKind = "credit_pack" | "plan" | "workshop_listing";
export const validPlatformChargeKind = (value: unknown): value is PlatformChargeKind =>
  value === "credit_pack" || value === "plan" || value === "workshop_listing";
export const CONSENT_GENERATION_KEY = "hs_analytics_generation";
export const validConsentGeneration = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export type ConversionReceipt = {
  id: string;
  event: "sign_up" | "listing_published" | "newsletter_signup" | "workshop_booking_registered" | "platform_charge_returned";
  payload: Record<string, string>;
  generation?: string;
  expiresAt?: number;
  signature?: string;
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
    if (receipt.generation !== undefined && !validConsentGeneration(receipt.generation)) return null;
    if (receipt.expiresAt !== undefined && (!Number.isSafeInteger(receipt.expiresAt) || receipt.expiresAt <= Date.now())) return null;
    if (receipt.signature !== undefined && (typeof receipt.signature !== "string" || !/^[a-f0-9]{64}$/.test(receipt.signature))) return null;
    const generation = {
      ...(receipt.signature === undefined ? {} : { signature: receipt.signature }),
      ...(receipt.generation === undefined ? {} : { generation: receipt.generation }),
      ...(receipt.expiresAt === undefined ? {} : { expiresAt: receipt.expiresAt }),
    };
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    if (receipt.event === "platform_charge_returned" && validPlatformChargeKind(payload.charge_kind)) {
      return { id: receipt.id, event: "platform_charge_returned", payload: { charge_kind: payload.charge_kind }, ...generation };
    }
    if (receipt.event === "workshop_booking_registered" && validConsentGeneration(payload.workshop_id) && payload.actor_role === "organizer") {
      return { id: receipt.id, event: "workshop_booking_registered", payload: { workshop_id: payload.workshop_id, actor_role: "organizer" }, ...generation };
    }
    if (receipt.event === "sign_up" && payload.method === "email") {
      return { id: receipt.id, event: "sign_up", payload: { method: "email" }, ...generation };
    }
    if (receipt.event === "listing_published" && ["handmade", "destash"].includes(payload.listing_type)) {
      return { id: receipt.id, event: "listing_published", payload: { listing_type: payload.listing_type }, ...generation };
    }
    if (receipt.event === "newsletter_signup" && payload.signup_source === "lead_magnet_form" && payload.opt_in_method === "double") {
      return { id: receipt.id, event: "newsletter_signup", payload: { signup_source: "lead_magnet_form", opt_in_method: "double" }, ...generation };
    }
    return null;
  } catch { return null; }
}

export function parseConversionReceipts(raw: string): ConversionReceipt[] {
  try {
    if (raw.length > 3500) return [];
    const value = JSON.parse(raw);
    const items = Array.isArray(value) ? value : [value];
    if (items.length > 6) return [];
    return items.map(item => parseConversionReceipt(JSON.stringify(item)))
      .filter((item): item is ConversionReceipt => item !== null);
  } catch { return []; }
}
