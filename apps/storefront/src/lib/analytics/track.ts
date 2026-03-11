"use client";

type AnalyticsPayload = Record<string, unknown>;

type DataLayerEvent = AnalyticsPayload & {
  event: string;
  timestamp: string;
};

export function trackEvent(event: string, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") {
    return;
  }

  const dataLayer = ((window as unknown as { dataLayer?: DataLayerEvent[] })
    .dataLayer ??= []);

  const eventPayload: DataLayerEvent = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  dataLayer.push(eventPayload);
}
