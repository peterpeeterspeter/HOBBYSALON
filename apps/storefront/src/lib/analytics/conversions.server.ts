import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { conversionGeneration, signConversion, verifyConversion } from "./conversion-security.server";
import { CONVERSION_COOKIE, validConsentGeneration, parseConversionReceipts, type ConversionReceipt } from "./conversions";

/** A short-lived first-party receipt, only when measurement was already allowed. */
export async function queueConversion(event: ConversionReceipt["event"], payload: Record<string, string>): Promise<void> {
  try {
    const store = await cookies();
    if (store.get("hs_posthog_consent_v1")?.value !== "granted") return;
    const generation = await conversionGeneration();
    if (!validConsentGeneration(generation)) return;
    const receipt = signConversion({ id: randomUUID(), event, payload, generation, expiresAt: Date.now() + 300_000 });
    if (!receipt) return;
    const pending = parseConversionReceipts(store.get(CONVERSION_COOKIE)?.value ?? "")
      .filter(item => verifyConversion(item, generation)).slice(-5);
    pending.push(receipt);
    while (encodeURIComponent(JSON.stringify(pending)).length > 3500) pending.shift();
    store.set(CONVERSION_COOKIE, JSON.stringify(pending), {
      path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 300,
    });
  } catch {
    // Optional analytics must never fail a successful business operation.
  }
}
