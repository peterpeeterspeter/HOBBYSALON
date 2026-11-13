/**
 * The two buckets the counter distinguishes. `pending` is not a bucket: a
 * visitor who has not chosen yet is counted as `denied`, because that is
 * exactly how GA4 treats them. Counting them separately would flatter the
 * consented share.
 */
export type ConsentBucket = "granted" | "denied";

export const CONSENT_COOKIE_NAME = "hs_analytics_consent";

/** Cookie values that arrive from a client. Only the exact string counts. */
export function readConsentBucket(rawCookieValue: string | undefined): ConsentBucket {
  return rawCookieValue === "granted" ? "granted" : "denied";
}
