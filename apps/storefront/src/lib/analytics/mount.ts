import { CONSENT_CHANGED, readConsent } from "./consent";
import { sendPosthogEvent } from "./posthog";
import { pageParameters } from "./pageview";

/** Wait only for transport readiness when consent already existed at mount. */
export function waitForMountMeasurement(event: string, payload: Record<string, unknown>, delivered: () => void): () => void {
  if (typeof window === "undefined" || readConsent() !== "granted" || !pageParameters(window.location.href)) { delivered(); return () => {}; }
  const initialRoute = window.location.origin + window.location.pathname;
  const snapshot = { ...payload };
  let active = true;
  function cancel() {
    active = false;
    window.removeEventListener("hs:posthog_ready", attempt);
    window.removeEventListener(CONSENT_CHANGED, consentChanged);
  }
  function consentChanged() { if (readConsent() !== "granted") { cancel(); delivered(); } }
  function attempt() {
    if (!active) return;
    if (readConsent() !== "granted" || initialRoute !== window.location.origin + window.location.pathname) { cancel(); return; }
    if (!window.hsPostHogReady) return;
    cancel();
    sendPosthogEvent(event, snapshot);
    delivered();
  }
  window.addEventListener("hs:posthog_ready", attempt);
  window.addEventListener(CONSENT_CHANGED, consentChanged);
  attempt();
  return cancel;
}
