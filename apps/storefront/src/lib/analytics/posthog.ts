"use client";

import { analyticsAllowed } from "./consent";
import { pageParameters } from "./pageview";
import { sendGoogleEvent } from "./google-tag";


type Scalar = string | number | boolean;
type Validator = (value: unknown) => value is Scalar;

const code: Validator = (value): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const uuid: Validator = (value): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const count: Validator = (value): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000;
const variantId: Validator = (value): value is string =>
  typeof value === "string" && /^variant_[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value);
const projectBundleId: Validator = (value): value is string =>
  typeof value === "string" && value.startsWith("project:") && uuid(value.slice(8));
const boolean: Validator = (value): value is boolean => typeof value === "boolean";
const oneOf = (...allowed: string[]): Validator =>
  (value): value is string => typeof value === "string" && allowed.includes(value);
const signupSource = oneOf("newsletter_form", "footer_form", "lead_magnet_form");

// Per-event keys, not a generic payload scrubber. IDs for people, arbitrary labels,
// search text, raw URLs, titles and internal tracking metadata are never forwarded.
const EVENT_PARAMETERS: Readonly<Record<string, Readonly<Record<string, Validator>>>> = {
  project_view: { project_id: uuid, difficulty_level: oneOf("beginner", "intermediate", "advanced") },
  home_recommendations_viewed: { recommendation_source: oneOf("home_make_list"), item_count: count },
  home_search_submitted: {},
  home_route_clicked: { route: oneOf("weekend", "workshops", "make_at_home", "agenda", "materials", "makersmarkt") },
  home_event_clicked: { agenda_item_id: uuid, item_index: count },
  home_journey_clicked: {
    journey_kind: oneOf("article", "project"),
    leg: oneOf("content", "material", "workshop", "maker"),
    destination: oneOf("article", "project", "product", "workshop", "creator"),
    item_index: count,
  },
  home_provider_clicked: { destination: oneOf("partners") },
  home_product_clicked: { route: oneOf("materials", "makersmarkt"), product_id: uuid, item_index: count },
  // Profile clicks, not confirmed follows or subscriptions.
  social_follow_clicked: { channel: oneOf("facebook", "instagram", "pinterest", "youtube"), placement: oneOf("home") },
  bundle_add: { bundle_id: projectBundleId, item_count: count, partial: boolean },
  add_to_cart: { quantity: count, variant_id: variantId },
  checkout_started: { item_count: count },
  // A checkout-success render is not yet authoritative purchase evidence.
  checkout_completed: { item_count: count },
  // Only the charge kind. No amount: the return landing knows which kind was
  // bought but not what Stripe captured, so any value here would be invented.
  platform_charge_returned: { charge_kind: oneOf("credit_pack", "plan", "workshop_listing") },
  workshop_booking_request_submitted: { workshop_id: uuid },
  workshop_booking_registered: { workshop_id: uuid },
  product_inquiry_submitted: { product_id: uuid },
  sign_up: { method: oneOf("email") },
  listing_published: { listing_type: oneOf("handmade", "destash"), product_id: uuid },
  newsletter_signup: { signup_source: signupSource, opt_in_method: oneOf("single", "double"), lead_magnet_code: code },
  newsletter_signup_requested: { signup_source: signupSource, lead_magnet_code: code },
  survey_submitted: { survey_key: oneOf("aanbod-verbeteren-2026") },
  tool_calculated: { tool_slug: code, formula_id: code },
  tool_used: { tool_slug: code, interaction: oneOf("input", "control") },
  tool_materials_clicked: { tool_slug: code, formula_id: code, product_id: uuid },
};

/** True means capture was invoked without throwing, not that ingestion was acknowledged. */
export function sendPosthogEvent(event: string, payload: Record<string, unknown> = {}): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!analyticsAllowed()) return false;
    const client = window.hsPostHog;
    if (!client) return false;
    if (!Object.prototype.hasOwnProperty.call(EVENT_PARAMETERS, event)) return false;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;

    const parameters: Record<string, Scalar> = {};
    for (const [key, validate] of Object.entries(EVENT_PARAMETERS[event])) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
      const value = payload[key];
      if (validate(value)) parameters[key] = value;
    }

    const page = pageParameters(window.location.href, typeof document === "undefined" ? "" : document.referrer);
    if (!page) return false;
    Object.assign(parameters, page);

    // The full-success producer omits partial; failures explicitly set true.
    if (event === "bundle_add" && typeof parameters.item_count === "number" && parameters.item_count > 0
      && !Object.prototype.hasOwnProperty.call(payload, "partial")) {
      parameters.partial = false;
    }

    let outboundEvent = event;
    if (event === "checkout_started") {
      outboundEvent = "begin_checkout";
      // Only the verified storefront cents contract, not an inferred amount.
      if (typeof payload.currency_code === "string" && payload.currency_code.toUpperCase() === "EUR") {
        parameters.currency = "EUR";
        if (payload.total_amount_unit === "cents" && typeof payload.total_amount === "number"
          && Number.isSafeInteger(payload.total_amount) && payload.total_amount >= 0 && payload.total_amount <= 100_000_000) {
          parameters.value = payload.total_amount / 100;
        }
      }
    }
    if (event === "workshop_booking_request_submitted" || event === "product_inquiry_submitted") {
      outboundEvent = "generate_lead";
      parameters.lead_type = event === "workshop_booking_request_submitted" ? "workshop" : "product";
    }
    // Preserve the existing outbound event names for registration conversions:
    // account -> sign_up, newsletter -> newsletter_signup, workshop -> workshop_booking.
    if (event === "workshop_booking_registered") {
      outboundEvent = "workshop_booking";
    }
    // Payment-method-agnostic "money moved back through the redirect". Kept
    // distinct from purchase so it never inflates revenue in reports. The event
    // name already carries the meaning; no extra status parameter.
    if (event === "platform_charge_returned") {
      outboundEvent = "platform_charge_returned";
    }
    client.capture(outboundEvent, { hs_safe: parameters });
    sendGoogleEvent(outboundEvent, parameters);
    return true;
  } catch {
    // Storage/property access and SDK failures must not break forms.
    return false;
  }
}
