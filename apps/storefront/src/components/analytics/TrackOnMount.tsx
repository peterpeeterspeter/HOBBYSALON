"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { waitForMountMeasurement } from "@/lib/analytics/mount";

type TrackOnMountProps = {
  event: string;
  payload?: Record<string, unknown>;
};

export function TrackOnMount({ event, payload }: TrackOnMountProps) {
  const hasTrackedRef = useRef(false);
  const googleHandledRef = useRef(false);

  useEffect(() => {
    if (!hasTrackedRef.current) {
      hasTrackedRef.current = true;
      trackEvent(event, payload ?? {}, { google: false });
    }
    if (googleHandledRef.current) return;
    return waitForMountMeasurement(event, payload ?? {}, () => { googleHandledRef.current = true; });
  }, [event, payload]);

  return null;
}
