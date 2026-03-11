"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/track";

type TrackOnMountProps = {
  event: string;
  payload?: Record<string, unknown>;
};

export function TrackOnMount({ event, payload }: TrackOnMountProps) {
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (hasTrackedRef.current) {
      return;
    }
    hasTrackedRef.current = true;
    trackEvent(event, payload ?? {});
  }, [event, payload]);

  return null;
}
