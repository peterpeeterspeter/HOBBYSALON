"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { analyticsAllowed } from "@/lib/analytics/consent";

/** Editorial make-list rows exposed at least halfway in a foreground viewport. */
export function HomeRecommendationsList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<Element>());

  useEffect(() => {
    if (!list.current || typeof IntersectionObserver === "undefined") return;
    const rows = Array.from(list.current.querySelectorAll("[data-home-recommendation]"));
    if (!rows.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible") return;
      let itemCount = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5 || seen.current.has(entry.target)) continue;
        seen.current.add(entry.target);
        observer.unobserve(entry.target);
        itemCount += 1;
      }
      // Consume denied exposures too; a later grant must not replay them.
      if (itemCount > 0 && analyticsAllowed()) {
        trackEvent("home_recommendations_viewed", {
          recommendation_source: "home_make_list",
          item_count: itemCount,
        });
      }
    }, { threshold: 0.5 });

    const observeUnseen = () => {
      for (const row of rows) {
        if (seen.current.has(row)) continue;
        observer.unobserve(row);
        observer.observe(row);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") observeUnseen();
    };
    observeUnseen();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [children]);

  return (
    <div ref={list} className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--card)] px-4 sm:px-5">
      {children}
    </div>
  );
}
