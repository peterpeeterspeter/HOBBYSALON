/**
 * Pure helpers for /workshops discovery: session pick, place+online rules,
 * duration, grouping, domain chip set.
 */

import {
  eventOverlapsRange,
  groupEventsByAgendaBucket,
  type AgendaDateRange,
  type AgendaGroup,
} from "@/lib/agenda/agenda-helpers";

export {
  formatAgendaPlaceLabel,
  sanitizeAgendaSearchQuery,
  resolveAgendaDatePreset,
  resolveAgendaCustomRange,
} from "@/lib/agenda/agenda-helpers";

export type WorkshopNextSession = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type WorkshopSessionRow = {
  id: string;
  workshop_id: string;
  starts_at: string;
  ends_at: string | null;
  is_cancelled?: boolean;
};

/** Duration in minutes from concrete session bounds. */
export function sessionDurationMinutes(session: {
  startsAt: string;
  endsAt: string;
}): number | null {
  const start = Date.parse(session.startsAt);
  const end = Date.parse(session.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return Math.round((end - start) / 60_000);
}

function sessionEffectiveEnd(session: {
  starts_at: string;
  ends_at: string | null;
}): string {
  return session.ends_at?.trim() ? session.ends_at : session.starts_at;
}

/**
 * No date range → first future (effective end ≥ now) non-cancelled session.
 * With date range → first session overlapping [from, to].
 * Returns earliest by starts_at among matches.
 */
export function pickNextMatchingSession(
  sessions: WorkshopSessionRow[],
  options: {
    nowIso: string;
    range?: AgendaDateRange | null;
  }
): WorkshopNextSession | null {
  const active = sessions.filter((s) => !s.is_cancelled);
  let candidates: WorkshopSessionRow[];

  if (options.range) {
    candidates = active.filter((s) =>
      eventOverlapsRange(
        { starts_at: s.starts_at, ends_at: s.ends_at },
        options.range!.from,
        options.range!.to
      )
    );
  } else {
    candidates = active.filter(
      (s) => sessionEffectiveEnd(s) >= options.nowIso
    );
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const first = candidates[0]!;
  return {
    id: first.id,
    startsAt: first.starts_at,
    endsAt: sessionEffectiveEnd(first),
  };
}

/**
 * Per workshop_id, pick next matching session. Drops workshops with no match.
 */
export function pickNextSessionByWorkshop(
  sessions: WorkshopSessionRow[],
  options: {
    nowIso: string;
    range?: AgendaDateRange | null;
  }
): Map<string, WorkshopNextSession> {
  const byWorkshop = new Map<string, WorkshopSessionRow[]>();
  for (const session of sessions) {
    if (session.is_cancelled) continue;
    const list = byWorkshop.get(session.workshop_id) ?? [];
    list.push(session);
    byWorkshop.set(session.workshop_id, list);
  }

  const result = new Map<string, WorkshopNextSession>();
  for (const [workshopId, rows] of byWorkshop) {
    const next = pickNextMatchingSession(rows, options);
    if (next) result.set(workshopId, next);
  }
  return result;
}

export function workshopMatchesPlaceQuery(
  workshop: {
    city?: string | null;
    location_name?: string | null;
  },
  place: string
): boolean {
  const needle = place.trim().toLowerCase();
  if (!needle) return true;
  const city = (workshop.city ?? "").toLowerCase();
  const location = (workshop.location_name ?? "").toLowerCase();
  return city.includes(needle) || location.includes(needle);
}

/**
 * Place filter excludes pure online unless formatFilter === "online".
 * With place + online: include online OR place-matching non-online.
 * With place only: place match and not pure online (hybrid OK if place matches).
 */
export function workshopPassesPlaceAndFormat(options: {
  workshop: {
    format_type: string;
    city?: string | null;
    location_name?: string | null;
  };
  place: string | null | undefined;
  formatFilter: string | null | undefined;
}): boolean {
  const { workshop, place, formatFilter } = options;
  const placeValue = place?.trim() || null;
  const isOnline = workshop.format_type === "online";

  if (!placeValue) {
    if (formatFilter) return workshop.format_type === formatFilter;
    return true;
  }

  const placeMatches = workshopMatchesPlaceQuery(workshop, placeValue);

  if (formatFilter === "online") {
    return isOnline || placeMatches;
  }

  if (formatFilter) {
    return (
      !isOnline &&
      workshop.format_type === formatFilter &&
      placeMatches
    );
  }

  return !isOnline && placeMatches;
}

export function groupWorkshopsByDiscoveryBucket<
  T extends {
    id: string;
    nextSession: WorkshopNextSession;
  },
>(
  items: T[],
  options: {
    mode: "preset" | "custom";
    now?: Date;
  }
): AgendaGroup<T & { starts_at: string; ends_at?: string | null }>[] {
  const asEvents = items.map((item) => ({
    ...item,
    starts_at: item.nextSession.startsAt,
    ends_at: item.nextSession.endsAt,
  }));
  return groupEventsByAgendaBucket(asEvents, {
    mode: options.mode,
    now: options.now,
  });
}

/** Domains present in results, always including selectedDomainId when set. */
export function resolveHobbyChipDomainIds(options: {
  resultDomainIds: string[];
  selectedDomainId?: string | null;
  allDomainIdsOrdered: string[];
}): string[] {
  const present = new Set(options.resultDomainIds.filter(Boolean));
  if (options.selectedDomainId) {
    present.add(options.selectedDomainId);
  }
  return options.allDomainIdsOrdered.filter((id) => present.has(id));
}
