import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { CONSENT_GENERATION_KEY, parseConversionReceipt, validConsentGeneration, type ConversionReceipt } from "./conversions";

let warned = false;
export function conversionUnavailable(): void {
  if (!warned) { warned = true; console.warn("Conversion measurement unavailable."); }
}
export function conversionConfigured(): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "") !== "https://us.i.posthog.com") {
    conversionUnavailable(); return false;
  }
  return true;
}
function signingKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) { conversionUnavailable(); return null; }
  return createHmac("sha256", secret).update("hobbysalon:conversion-receipt:v1").digest();
}
export async function conversionGeneration(): Promise<string | null> {
  try {
    const store = await cookies();
    const generation = store.get(CONSENT_GENERATION_KEY)?.value;
    if (store.get("hs_posthog_consent_v1")?.value !== "granted" || !validConsentGeneration(generation)) return null;
    return conversionConfigured() && signingKey() ? generation : null;
  } catch { return null; }
}
function message(receipt: ConversionReceipt): string {
  return JSON.stringify(["v1", receipt.id, receipt.event, receipt.payload, receipt.generation, receipt.expiresAt]);
}
export function signConversion(receipt: ConversionReceipt): ConversionReceipt | null {
  const key = signingKey();
  const safe = parseConversionReceipt(JSON.stringify(receipt));
  if (!key || !safe?.generation || !safe.expiresAt) return null;
  return { ...safe, signature: createHmac("sha256", key).update(message(safe)).digest("hex") };
}
export function verifyConversion(receipt: ConversionReceipt, generation: string): boolean {
  const safe = parseConversionReceipt(JSON.stringify(receipt));
  if (!safe?.signature || !safe.expiresAt || safe.expiresAt > Date.now() + 300_000 || safe.generation !== generation) return false;
  const signed = signConversion(safe);
  return !!signed?.signature && timingSafeEqual(Buffer.from(safe.signature, "hex"), Buffer.from(signed.signature, "hex"));
}
