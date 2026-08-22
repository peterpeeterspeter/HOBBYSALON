"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackEvent } from "@/lib/analytics/track";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  event: string;
  eventPayload?: Record<string, unknown>;
};

export function TrackedLink({
  event,
  eventPayload,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackEvent(event, eventPayload ?? {});
        onClick?.(e);
      }}
    />
  );
}
