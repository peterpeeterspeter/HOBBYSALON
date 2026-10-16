import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { CONVERSION_COOKIE, type ConversionReceipt } from "./conversions";

/** A short-lived first-party receipt, only when measurement was already allowed. */
export async function queueConversion(event: ConversionReceipt["event"], payload: Record<string, string>): Promise<void> {
  try {
    const store = await cookies();
    if (store.get("hs_analytics_consent")?.value !== "granted") return;
    store.set(CONVERSION_COOKIE, JSON.stringify({ id: randomUUID(), event, payload }), {
      path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 300,
    });
  } catch {
    // Optional analytics must never fail a successful business operation.
  }
}
