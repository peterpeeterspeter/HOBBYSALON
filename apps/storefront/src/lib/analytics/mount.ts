import { CONSENT_CHANGED, readConsent } from "./consent";
import { sendGa4Event } from "./ga4";
import { pageParameters } from "./pageview";

/** Wait only for transport readiness when consent already existed at mount. */
export function waitForMountMeasurement(event: string, payload: Record<string, unknown>, delivered: () => void): () => void {
  if (typeof window === "undefined" || readConsent() !== "granted" || !pageParameters(window.location.href)) { delivered(); return () => {}; }
  const initialRoute = window.location.origin + window.location.pathname;
  const snapshot = { ...payload };
  let active = true;
  function cancel() {
    active = false;
    window.removeEventListener("hs:ga4_ready", attempt);
    window.removeEventListener(CONSENT_CHANGED, consentChanged);
  }
  function consentChanged() { if (readConsent() !== "granted") { cancel(); delivered(); } }
  function attempt() {
    if (!active) return;
    if (readConsent() !== "granted" || initialRoute !== window.location.origin + window.location.pathname) { cancel(); return; }
    if (!window.hsGa4Ready) return;
    cancel();
    sendGa4Event(event, snapshot);
    delivered();
  }
  window.addEventListener("hs:ga4_ready", attempt);
  window.addEventListener(CONSENT_CHANGED, consentChanged);
  attempt();
  return cancel;
}
