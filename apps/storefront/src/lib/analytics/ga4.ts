"use client";

export type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

type Scalar = string | number;
type Validator = (value: unknown) => value is Scalar;

const code: Validator = (value): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const uuid: Validator = (value): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const count: Validator = (value): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000;
const oneOf = (...allowed: string[]): Validator =>
  (value): value is string => typeof value === "string" && allowed.includes(value);
const signupSource = oneOf("newsletter_form", "footer_form", "lead_magnet_form");

// Per-event keys, not a generic payload scrubber. IDs for people, arbitrary labels,
// search text, raw URLs, titles and internal tracking metadata are never forwarded.
const EVENT_PARAMETERS: Readonly<Record<string, Readonly<Record<string, Validator>>>> = {
  project_view: { project_id: uuid, difficulty_level: oneOf("beginner", "intermediate", "advanced") },
  home_recommendations_viewed: { recommendation_source: code, item_count: count },
  home_search_submitted: {},
  home_route_clicked: {},
  home_event_clicked: {},
  home_journey_clicked: {},
  home_provider_clicked: {},
  bundle_add: { item_count: count },
  add_to_cart: { quantity: count },
  checkout_started: { item_count: count },
  // A checkout-success render is not yet authoritative purchase evidence.
  checkout_completed: { item_count: count },
  workshop_booking_request_submitted: { workshop_id: uuid },
  product_inquiry_submitted: { product_id: uuid },
  sign_up: { method: oneOf("email") },
  listing_published: { listing_type: oneOf("handmade", "destash"), product_id: uuid },
  newsletter_signup: { signup_source: signupSource, opt_in_method: oneOf("single", "double"), lead_magnet_code: code },
  newsletter_signup_requested: { signup_source: signupSource, lead_magnet_code: code },
  tool_calculated: { tool_slug: code, formula_id: code },
  tool_materials_clicked: { tool_slug: code, formula_id: code, product_id: uuid },
};

function originAndPath(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

/** Best-effort, bounded transport. No queue, replay, HTTP requests or retries. */
export function sendGa4Event(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("hs_analytics_consent") !== "granted") return;
    const gtag = window.gtag;
    if (typeof gtag !== "function") return;
    if (!Object.prototype.hasOwnProperty.call(EVENT_PARAMETERS, event)) return;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;

    const parameters: Record<string, Scalar> = {};
    for (const [key, validate] of Object.entries(EVENT_PARAMETERS[event])) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
      const value = payload[key];
      if (validate(value)) parameters[key] = value;
    }

    const pageLocation = originAndPath(`${window.location.origin}${window.location.pathname}`);
    if (!pageLocation) return;
    parameters.page_location = pageLocation;
    const pageReferrer = typeof document === "undefined" ? undefined : originAndPath(document.referrer);
    if (pageReferrer) parameters.page_referrer = pageReferrer;

    let ga4Event = event;
    if (event === "workshop_booking_request_submitted" || event === "product_inquiry_submitted") {
      ga4Event = "generate_lead";
      parameters.lead_type = event === "workshop_booking_request_submitted" ? "workshop" : "product";
    }
    gtag.call(window, "event", ga4Event, parameters);
  } catch {
    // Storage/property access and Google tag failures must not break forms.
  }
}
