import "server-only";
import { randomUUID } from "node:crypto";
import { parseConversionReceipt, type ConversionReceipt } from "./conversions";

export async function dispatchConversion(receipt: ConversionReceipt, market: "BE" | "NL"): Promise<boolean> {
  try {
    const safe = parseConversionReceipt(JSON.stringify(receipt));
    if (!safe) return false;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "");
    if (!key || host !== "https://us.i.posthog.com") {
      if (process.env.NODE_ENV !== "production") console.warn("Conversion capture disabled: missing key or unsupported ingestion host.");
      return false;
    }
    const response = await fetch(`${host}/i/v0/e/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: safe.event === "workshop_booking_registered" ? "workshop_booking" : safe.event,
        // Per-event random ID, never a user, entity, receipt or consent-generation identifier.
        distinct_id: randomUUID(),
        properties: {
          ...safe.payload, site_country: market, $process_person_profile: false,
          $geoip_disable: true, $ip: "0.0.0.0",
        },
      }),
      signal: AbortSignal.timeout(1500), cache: "no-store", redirect: "error",
    });
    return response.ok;
  } catch { return false; }
}
