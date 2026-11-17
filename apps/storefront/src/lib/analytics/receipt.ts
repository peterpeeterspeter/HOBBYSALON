import { CONSENT_CHANGED, readConsent, readConsentGeneration } from "./consent";
import { CONVERSION_COOKIE, parseConversionReceipts } from "./conversions";

const delivered = new Set<string>();

// This transport does not load the SDK or include page/session/user context.
export function consumeConversionReceipt(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    if (readConsent() !== "granted") return;
    const value = document.cookie.split(";").map(part => part.trim())
      .find(part => part.startsWith(`${CONVERSION_COOKIE}=`))?.slice(CONVERSION_COOKIE.length + 1);
    if (!value) return;
    document.cookie = `${CONVERSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    if (document.cookie.split(";").some(part => part.trim().startsWith(`${CONVERSION_COOKIE}=`))) return;
    const generation = readConsentGeneration();
    if (!generation) return;
    const receipts = parseConversionReceipts(decodeURIComponent(value)).filter(receipt =>
      receipt.signature && receipt.expiresAt && receipt.generation === generation && !delivered.has(receipt.id));
    if (!receipts.length || readConsent() !== "granted") return;
    for (const receipt of receipts) {
      if (delivered.size >= 100) delivered.delete(delivered.values().next().value!);
      delivered.add(receipt.id);
    }
    const controller = new AbortController();
    const stop = () => {
      if (readConsent() !== "granted" || readConsentGeneration() !== generation) controller.abort();
    };
    window.addEventListener(CONSENT_CHANGED, stop);
    void fetch("/api/analytics/conversions", {
      method: "POST", credentials: "same-origin", referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipts), signal: controller.signal,
    }).catch(() => {}).finally(() => window.removeEventListener(CONSENT_CHANGED, stop));
  } catch { /* Delete-before-send means no retry after withdrawal or uncertain delivery. */ }
}
