"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANALYTICS_EVENT_SCHEMAS,
  FUNNEL_EVENT_ORDER,
  clearStoredAnalyticsEvents,
  readStoredAnalyticsEvents,
  type DataLayerEvent,
} from "@/lib/analytics/track";

function mergeEvents(): DataLayerEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  const fromStorage = readStoredAnalyticsEvents();
  const fromDataLayer = (window.dataLayer ?? []) as DataLayerEvent[];
  const merged = [...fromStorage, ...fromDataLayer];
  const deduped = new Map<string, DataLayerEvent>();

  for (const event of merged) {
    const key = event.event_id || `${event.event}-${event.timestamp}-${event.path}`;
    if (!deduped.has(key)) {
      deduped.set(key, event);
    }
  }

  return [...deduped.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function AnalyticsFunnelDashboard() {
  const [events, setEvents] = useState<DataLayerEvent[]>([]);

  const refreshEvents = useCallback(() => {
    setEvents(mergeEvents());
  }, []);

  useEffect(() => {
    refreshEvents();

    const onCustomEvent = () => refreshEvents();
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "hs_analytics_events_v1") return;
      refreshEvents();
    };

    window.addEventListener("hs:analytics_event", onCustomEvent as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hs:analytics_event", onCustomEvent as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshEvents]);

  const funnelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const eventName of FUNNEL_EVENT_ORDER) {
      counts.set(eventName, 0);
    }
    for (const event of events) {
      if (!counts.has(event.event)) continue;
      counts.set(event.event, (counts.get(event.event) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  const schemaSummary = useMemo(() => {
    const knownEvents = events.filter((event) => !!ANALYTICS_EVENT_SCHEMAS[event.event]);
    const valid = knownEvents.filter((event) => event.schema_valid).length;
    const invalid = knownEvents.length - valid;
    return {
      knownEventsCount: knownEvents.length,
      valid,
      invalid,
    };
  }, [events]);

  const uniqueSessions = useMemo(
    () => new Set(events.map((event) => event.session_id)).size,
    [events]
  );
  const uniqueActors = useMemo(
    () => new Set(events.map((event) => event.actor_id)).size,
    [events]
  );

  const latestEvents = events.slice(0, 40);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Events</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{events.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Sessies</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{uniqueSessions}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Actoren</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{uniqueActors}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Schema valid</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
            {schemaSummary.valid}/{schemaSummary.knownEventsCount}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Funnel events</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FUNNEL_EVENT_ORDER.map((eventName) => (
            <div key={eventName} className="rounded-md border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--muted)]">{eventName}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                {funnelCounts.get(eventName) ?? 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Recente events</h2>
          <button
            type="button"
            onClick={() => {
              clearStoredAnalyticsEvents();
              setEvents([]);
            }}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
          >
            Log wissen
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="px-2 py-2 font-medium">Tijd</th>
                <th className="px-2 py-2 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Pad</th>
                <th className="px-2 py-2 font-medium">Entity</th>
                <th className="px-2 py-2 font-medium">Validatie</th>
              </tr>
            </thead>
            <tbody>
              {latestEvents.map((event) => (
                <tr key={event.event_id} className="border-b border-[var(--border)] align-top">
                  <td className="px-2 py-2 text-[var(--muted)]">{formatDateTime(event.timestamp)}</td>
                  <td className="px-2 py-2 font-medium text-[var(--foreground)]">{event.event}</td>
                  <td className="px-2 py-2 text-[var(--muted)]">{event.path}</td>
                  <td className="px-2 py-2 text-[var(--muted)]">
                    {event.primary_entity_type && event.primary_entity_id
                      ? `${event.primary_entity_type}:${event.primary_entity_id}`
                      : "-"}
                  </td>
                  <td className="px-2 py-2">
                    {event.schema_valid ? (
                      <span className="text-green-700">OK</span>
                    ) : (
                      <span className="text-red-700">
                        Mist: {event.required_fields_missing.join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {latestEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-[var(--muted)]">
                    Nog geen events in lokale analytics-log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
