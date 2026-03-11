"use client";

export type AnalyticsPayload = Record<string, unknown>;

type FunnelStage = "discovery" | "intent" | "checkout" | "purchase" | "engagement";

type AnalyticsEventSchema = {
  required: string[];
  funnelStage: FunnelStage;
};

export const ANALYTICS_EVENT_SCHEMAS: Record<string, AnalyticsEventSchema> = {
  project_view: {
    required: ["project_id", "project_slug", "difficulty_level"],
    funnelStage: "discovery",
  },
  home_recommendations_viewed: {
    required: ["recommendation_source", "item_count"],
    funnelStage: "discovery",
  },
  bundle_add: {
    required: ["bundle_id", "bundle_label", "item_count"],
    funnelStage: "intent",
  },
  add_to_cart: {
    required: ["variant_id", "quantity"],
    funnelStage: "intent",
  },
  checkout_started: {
    required: ["currency_code", "total_amount", "item_count"],
    funnelStage: "checkout",
  },
  checkout_completed: {
    required: ["order_id"],
    funnelStage: "purchase",
  },
  workshop_booking_request_submitted: {
    required: ["workshop_id", "creator_id"],
    funnelStage: "engagement",
  },
  newsletter_signup: {
    required: ["signup_source"],
    funnelStage: "engagement",
  },
};

export const FUNNEL_EVENT_ORDER = [
  "project_view",
  "bundle_add",
  "add_to_cart",
  "checkout_started",
  "checkout_completed",
] as const;

export type DataLayerEvent = AnalyticsPayload & {
  event: string;
  event_id: string;
  event_version: 1;
  timestamp: string;
  source: "storefront";
  funnel_stage: FunnelStage;
  session_id: string;
  visitor_id: string;
  user_id: string | null;
  actor_id: string;
  path: string;
  path_full: string;
  referrer_path: string | null;
  primary_entity_type: string | null;
  primary_entity_id: string | null;
  entity_keys: string[];
  required_fields_missing: string[];
  schema_valid: boolean;
};

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

const SESSION_STORAGE_KEY = "hs_session_id";
const VISITOR_STORAGE_KEY = "hs_visitor_id";
const EVENT_LOG_STORAGE_KEY = "hs_analytics_events_v1";
const EVENT_LOG_MAX_ITEMS = 500;
const RESERVED_TOP_LEVEL_KEYS = new Set([
  "event",
  "event_id",
  "event_version",
  "timestamp",
  "source",
  "funnel_stage",
  "session_id",
  "visitor_id",
  "actor_id",
  "path",
  "path_full",
  "referrer_path",
  "primary_entity_type",
  "primary_entity_id",
  "entity_keys",
  "required_fields_missing",
  "schema_valid",
]);

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sanitizePayload(payload: AnalyticsPayload): AnalyticsPayload {
  const sanitized: AnalyticsPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || typeof value === "function") {
      continue;
    }

    const normalizedKey = RESERVED_TOP_LEVEL_KEYS.has(key) ? `payload_${key}` : key;
    sanitized[normalizedKey] = value;
  }

  return sanitized;
}

function getSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = generateId("session");
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return "session_unavailable";
  }
}

function getVisitorId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const next = generateId("visitor");
    window.localStorage.setItem(VISITOR_STORAGE_KEY, next);
    return next;
  } catch {
    return "visitor_unavailable";
  }
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEntityMetadata(payload: AnalyticsPayload): {
  primaryEntityType: string | null;
  primaryEntityId: string | null;
  entityKeys: string[];
} {
  const entityPairs: Array<{ key: string; type: string; value: string }> = [];

  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("_id")) {
      const idValue = toNonEmptyString(value);
      if (!idValue) continue;
      entityPairs.push({
        key,
        type: key.slice(0, -3),
        value: idValue,
      });
      continue;
    }

    if (!key.endsWith("_ids")) continue;

    if (Array.isArray(value) && value.length > 0) {
      const first = toNonEmptyString(value[0]);
      if (!first) continue;
      entityPairs.push({
        key,
        type: key.slice(0, -4),
        value: first,
      });
      continue;
    }

    if (typeof value === "string") {
      const first = value
        .split(",")
        .map((entry) => entry.trim())
        .find((entry) => entry.length > 0);
      if (!first) continue;
      entityPairs.push({
        key,
        type: key.slice(0, -4),
        value: first,
      });
    }
  }

  const primary = entityPairs[0] ?? null;
  return {
    primaryEntityType: primary?.type ?? null,
    primaryEntityId: primary?.value ?? null,
    entityKeys: [...new Set(entityPairs.map((pair) => pair.key))],
  };
}

function getMissingRequiredFields(event: string, payload: AnalyticsPayload): string[] {
  const schema = ANALYTICS_EVENT_SCHEMAS[event];
  if (!schema) return [];

  return schema.required.filter((key) => {
    const value = payload[key];
    if (value == null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  });
}

function getFunnelStage(event: string): FunnelStage {
  return ANALYTICS_EVENT_SCHEMAS[event]?.funnelStage ?? "engagement";
}

function getReferrerPath(): string | null {
  if (typeof document === "undefined") return null;
  const referrer = document.referrer;
  if (!referrer) return null;

  try {
    const ref = new URL(referrer);
    if (ref.origin !== window.location.origin) {
      return ref.origin;
    }
    const search = ref.search || "";
    return `${ref.pathname}${search}` || "/";
  } catch {
    return null;
  }
}

function appendEventToLog(eventPayload: DataLayerEvent): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const currentRaw = window.localStorage.getItem(EVENT_LOG_STORAGE_KEY);
    const current = currentRaw
      ? (JSON.parse(currentRaw) as DataLayerEvent[])
      : [];
    const next = [...current, eventPayload].slice(-EVENT_LOG_MAX_ITEMS);
    window.localStorage.setItem(EVENT_LOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

export function readStoredAnalyticsEvents(): DataLayerEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(EVENT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DataLayerEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearStoredAnalyticsEvents(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(EVENT_LOG_STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function trackEvent(event: string, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") {
    return;
  }

  const sanitizedPayload = sanitizePayload(payload);
  const userId = toNonEmptyString(sanitizedPayload.user_id);
  const visitorId = getVisitorId();
  const eventId = generateId("evt");
  const path = window.location.pathname;
  const pathFull = `${window.location.pathname}${window.location.search}`;
  const entityMetadata = getEntityMetadata(sanitizedPayload);
  const missingRequiredFields = getMissingRequiredFields(event, sanitizedPayload);

  const eventPayload: DataLayerEvent = {
    ...sanitizedPayload,
    event,
    event_id: eventId,
    event_version: 1,
    timestamp: new Date().toISOString(),
    source: "storefront",
    funnel_stage: getFunnelStage(event),
    session_id: getSessionId(),
    visitor_id: visitorId,
    user_id: userId,
    actor_id: userId ?? visitorId,
    path,
    path_full: pathFull,
    referrer_path: getReferrerPath(),
    primary_entity_type: entityMetadata.primaryEntityType,
    primary_entity_id: entityMetadata.primaryEntityId,
    entity_keys: entityMetadata.entityKeys,
    required_fields_missing: missingRequiredFields,
    schema_valid: missingRequiredFields.length === 0,
  };

  const dataLayer = (window.dataLayer ??= []);
  dataLayer.push(eventPayload);
  appendEventToLog(eventPayload);
  window.dispatchEvent(
    new CustomEvent<DataLayerEvent>("hs:analytics_event", { detail: eventPayload })
  );

  if (process.env.NODE_ENV === "development" && missingRequiredFields.length > 0) {
    console.warn("[analytics] Missing required fields", {
      event,
      missingRequiredFields,
      payload: eventPayload,
    });
  }
}
