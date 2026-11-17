"use client";

import { useRef, type ReactNode, type SyntheticEvent } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { analyticsAllowed } from "@/lib/analytics/consent";

/** One use per mounted tool, never a calculation-success or a page impression. */
export function ToolInteractionBoundary({ toolSlug, children }: { toolSlug: string; children: ReactNode }) {
  const used = useRef(new Set<string>());

  function record(event: SyntheticEvent<HTMLDivElement>, interaction: "input" | "control") {
    if (!event.isTrusted || used.current.has(toolSlug) || !(event.target instanceof Element)) return;
    const selector = interaction === "input" ? "input,select,textarea" : "button";
    const control = event.target.closest(selector);
    if (!control || !event.currentTarget.contains(control) || control.matches(":disabled,[readonly]")) return;
    // Consume even without consent: granting it later must not replay past actions.
    used.current.add(toolSlug);
    if (!analyticsAllowed()) return;
    trackEvent("tool_used", { tool_slug: toolSlug, interaction });
  }

  return (
    <div className="contents" onChange={(event) => record(event, "input")} onClick={(event) => record(event, "control")}>
      {children}
    </div>
  );
}
