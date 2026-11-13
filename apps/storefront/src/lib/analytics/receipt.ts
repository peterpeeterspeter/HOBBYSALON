import { analyticsAllowed, readConsentGeneration } from "./consent";
import { CONVERSION_COOKIE, parseConversionReceipt } from "./conversions";
import { sendGa4Event } from "./ga4";
import { pageParameters } from "./pageview";

// At most one short-lived receipt; no person ID, history queue or retries.
const delivered = new Set<string>();
export function consumeConversionReceipt(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    if (!analyticsAllowed() || !pageParameters(window.location.href)) return;
    const value = document.cookie.split(";").map(part => part.trim())
      .find(part => part.startsWith(`${CONVERSION_COOKIE}=`))?.slice(CONVERSION_COOKIE.length + 1);
    if (!value) return;
    // Remove before dispatch: render/effect re-entry cannot deliver twice.
    document.cookie = `${CONVERSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    if (document.cookie.split(";").some(part => part.trim().startsWith(`${CONVERSION_COOKIE}=`))) return;
    const receipt = parseConversionReceipt(decodeURIComponent(value));
    if (!receipt || !receipt.generation || receipt.generation !== readConsentGeneration() || delivered.has(receipt.id)) return;
    if (delivered.size >= 100) delivered.delete(delivered.values().next().value!);
    delivered.add(receipt.id);
    sendGa4Event(receipt.event, receipt.payload);
  } catch { /* Optional measurement never fails a business action. */ }
}
