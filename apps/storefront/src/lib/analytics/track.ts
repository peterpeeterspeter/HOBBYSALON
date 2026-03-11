"use client";

type AnalyticsPayload = Record<string, unknown>;

type DataLayerEvent = AnalyticsPayload & {
  event: string;
  timestamp: string;
  source: "storefront";
  session_id: string;
  path: string;
};

const SESSION_STORAGE_KEY = "hs_session_id";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `hs_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = generateSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return "session_unavailable";
  }
}

export function trackEvent(event: string, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") {
    return;
  }

  const dataLayer = ((window as unknown as { dataLayer?: DataLayerEvent[] })
    .dataLayer ??= []);

  const eventPayload: DataLayerEvent = {
    event,
    timestamp: new Date().toISOString(),
    source: "storefront",
    session_id: getSessionId(),
    path: window.location.pathname,
    ...payload,
  };

  dataLayer.push(eventPayload);
}
