import type { CaptureResult, PostHogConfig } from "posthog-js";
import { readConsent } from "./consent";
import { pageParameters } from "./pageview";

/** Discard SDK-enriched URLs, attribution, person properties and automatic events. */
export function sanitizePosthogEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event || typeof window === "undefined") return null;
  const page = pageParameters(window.location.href, document.referrer);
  const safe = event.properties.hs_safe;
  if (!page || !safe || typeof safe !== "object") return null;
  const granted = readConsent() === "granted";
  if (event.event !== "$pageview" && !granted) return null;
  const properties: Record<string, unknown> = {};
  // Preserve only SDK transport/identity fields; never its automatically collected page data.
  for (const key of ["token", "distinct_id", "$lib", "$lib_version"]) {
    if (event.properties[key] !== undefined) properties[key] = event.properties[key];
  }
  // Cookieless ingestion needs this input for its daily hash; do not persist browser identity.
  if (!granted && event.properties.distinct_id === "$posthog_cookieless"
    && typeof event.properties.$raw_user_agent === "string") {
    properties.$raw_user_agent = event.properties.$raw_user_agent;
  }
  if (granted) {
    for (const key of ["$device_id", "$session_id", "$window_id"]) {
      if (event.properties[key] !== undefined) properties[key] = event.properties[key];
    }
  }
  return { ...event, properties: {
    ...properties, ...safe, ...page,
    $current_url: page.page_location,
    $pathname: new URL(page.page_location).pathname,
    $host: new URL(page.page_location).hostname,
    $referrer: page.page_referrer ?? "",
    $process_person_profile: false,
  } };
}

export function posthogConfig(): Partial<PostHogConfig> {
  return {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2026-08-30",
    cookieless_mode: "on_reject",
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    cross_subdomain_cookie: false,
    persistence: "localStorage+cookie",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    person_profiles: "never",
    save_campaign_params: false,
    save_referrer: false,
    ip: false,
    request_batching: false,
    before_send: sanitizePosthogEvent,
  };
}
