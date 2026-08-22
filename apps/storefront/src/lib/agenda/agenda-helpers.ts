/**
 * Pure agenda helpers: date presets, grouping, search sanitize, place labels.
 * Timezone is Europe/Brussels for Belgian/Dutch audience.
 */

export const AGENDA_TIMEZONE = "Europe/Brussels";

export type AgendaDatePreset = "today" | "weekend" | "next_week" | "month";

export type AgendaDateRange = {
  from: string; // ISO
  to: string; // ISO inclusive end-of-day
};

/** Neutralise characters that break PostgREST `or(...)` / `ilike` filters. */
export function sanitizeAgendaSearchQuery(
  q: string | null | undefined
): string | null {
  const term = q?.trim() ?? "";
  if (term.length < 2) return null;
  const cleaned = term
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

export type AgendaPlaceLabelMode = "in" | "around" | "within_km";

export function formatAgendaPlaceLabel(options: {
  place: string;
  mode: AgendaPlaceLabelMode;
  km?: number;
}): string {
  const place = options.place.trim();
  if (!place) return "";
  if (options.mode === "within_km" && options.km != null && options.km > 0) {
    return `Binnen ${options.km} km van ${place}`;
  }
  if (options.mode === "around") {
    return `Rond ${place}`;
  }
  return `In ${place}`;
}

function partsInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday, // Mon, Tue, ...
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Instant for local Y-M-D H:M:S in Europe/Brussels (handles DST via offset probe). */
export function zonedDateTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = AGENDA_TIMEZONE
): string {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const asLocal = partsInTimeZone(utcGuess, timeZone);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const actualAsUtc = Date.UTC(
    asLocal.year,
    asLocal.month - 1,
    asLocal.day,
    asLocal.hour,
    asLocal.minute,
    asLocal.second
  );
  const corrected = new Date(utcGuess.getTime() + (desiredAsUtc - actualAsUtc));
  return corrected.toISOString();
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function weekdayIndex(weekdayShort: string): number {
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  return map[weekdayShort] ?? 1;
}

function endOfLocalDayIso(
  year: number,
  month: number,
  day: number,
  timeZone = AGENDA_TIMEZONE
): string {
  return zonedDateTimeToUtcIso(year, month, day, 23, 59, 59, timeZone);
}

function startOfLocalDayIso(
  year: number,
  month: number,
  day: number,
  timeZone = AGENDA_TIMEZONE
): string {
  return zonedDateTimeToUtcIso(year, month, day, 0, 0, 0, timeZone);
}

/**
 * Resolve a named date preset to an inclusive ISO range in Europe/Brussels.
 * Returns null for unknown / empty presets.
 */
export function resolveAgendaDatePreset(
  preset: string | null | undefined,
  now = new Date(),
  timeZone = AGENDA_TIMEZONE
): AgendaDateRange | null {
  if (!preset) return null;
  const local = partsInTimeZone(now, timeZone);

  if (preset === "today") {
    return {
      from: startOfLocalDayIso(local.year, local.month, local.day, timeZone),
      to: endOfLocalDayIso(local.year, local.month, local.day, timeZone),
    };
  }

  if (preset === "weekend") {
    const dow = weekdayIndex(local.weekday);
    // Mon=1 … Sat=6, Sun=0. Days until Saturday.
    const daysUntilSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
    const sat =
      daysUntilSat >= 0
        ? addCalendarDays(local.year, local.month, local.day, daysUntilSat)
        : addCalendarDays(local.year, local.month, local.day, -1);
    const sun = addCalendarDays(sat.year, sat.month, sat.day, 1);
    return {
      from: startOfLocalDayIso(sat.year, sat.month, sat.day, timeZone),
      to: endOfLocalDayIso(sun.year, sun.month, sun.day, timeZone),
    };
  }

  if (preset === "next_week") {
    const dow = weekdayIndex(local.weekday);
    // Days until next Monday (if today is Monday, next week's Monday = +7).
    const daysUntilNextMon = dow === 1 ? 7 : dow === 0 ? 1 : 8 - dow;
    const mon = addCalendarDays(
      local.year,
      local.month,
      local.day,
      daysUntilNextMon
    );
    const sun = addCalendarDays(mon.year, mon.month, mon.day, 6);
    return {
      from: startOfLocalDayIso(mon.year, mon.month, mon.day, timeZone),
      to: endOfLocalDayIso(sun.year, sun.month, sun.day, timeZone),
    };
  }

  if (preset === "month") {
    const lastDay = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
    return {
      from: startOfLocalDayIso(local.year, local.month, local.day, timeZone),
      to: endOfLocalDayIso(local.year, local.month, lastDay, timeZone),
    };
  }

  return null;
}

export function parseAgendaDateParam(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day;
}

/** Build inclusive ISO range from YYYY-MM-DD params. */
export function resolveAgendaCustomRange(
  fromDay: string | null | undefined,
  toDay: string | null | undefined,
  timeZone = AGENDA_TIMEZONE
): AgendaDateRange | null {
  const from = parseAgendaDateParam(fromDay);
  const to = parseAgendaDateParam(toDay);
  if (!from && !to) return null;
  const fromParts = (from ?? to)!.split("-").map(Number) as [number, number, number];
  const toParts = (to ?? from)!.split("-").map(Number) as [number, number, number];
  return {
    from: startOfLocalDayIso(fromParts[0], fromParts[1], fromParts[2], timeZone),
    to: endOfLocalDayIso(toParts[0], toParts[1], toParts[2], timeZone),
  };
}

export function eventEffectiveEndIso(event: {
  starts_at: string;
  ends_at?: string | null;
}): string {
  return event.ends_at?.trim() ? event.ends_at : event.starts_at;
}

/** Inclusive overlap: event intersects [rangeFrom, rangeTo]. */
export function eventOverlapsRange(
  event: { starts_at: string; ends_at?: string | null },
  rangeFrom: string,
  rangeTo: string
): boolean {
  const start = event.starts_at;
  const end = eventEffectiveEndIso(event);
  return start <= rangeTo && end >= rangeFrom;
}

/** Still happening or not yet started (upcoming / ongoing). */
export function eventIsUpcomingOrOngoing(
  event: { starts_at: string; ends_at?: string | null },
  nowIso: string
): boolean {
  return eventEffectiveEndIso(event) >= nowIso;
}

export function eventMatchesPlace(
  event: { city?: string | null; location_name?: string | null },
  place: string
): boolean {
  const needle = place.trim().toLowerCase();
  if (!needle) return true;
  const city = (event.city ?? "").toLowerCase();
  const location = (event.location_name ?? "").toLowerCase();
  return city.includes(needle) || location.includes(needle);
}

export type AgendaGroup<T extends { starts_at: string; ends_at?: string | null }> = {
  key: string;
  label: string;
  events: T[];
};

function formatDayHeading(iso: string, timeZone = AGENDA_TIMEZONE): string {
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function localDayKey(iso: string, timeZone = AGENDA_TIMEZONE): string {
  const p = partsInTimeZone(new Date(iso), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function capitalizeNl(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Group events for agenda display.
 * - preset mode: Dit weekend / Volgende week / Later deze maand / Later
 * - custom mode: one heading per calendar day (starts_at local day)
 */
export function groupEventsByAgendaBucket<
  T extends { id: string; starts_at: string; ends_at?: string | null },
>(
  events: T[],
  options: {
    mode: "preset" | "custom";
    now?: Date;
    timeZone?: string;
  }
): AgendaGroup<T>[] {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? AGENDA_TIMEZONE;

  if (options.mode === "custom") {
    const byDay = new Map<string, T[]>();
    for (const event of events) {
      const key = localDayKey(event.starts_at, timeZone);
      const list = byDay.get(key) ?? [];
      list.push(event);
      byDay.set(key, list);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({
        key,
        label: capitalizeNl(formatDayHeading(dayEvents[0]!.starts_at, timeZone)),
        events: dayEvents,
      }));
  }

  const weekend = resolveAgendaDatePreset("weekend", now, timeZone)!;
  const nextWeek = resolveAgendaDatePreset("next_week", now, timeZone)!;
  const month = resolveAgendaDatePreset("month", now, timeZone)!;

  const buckets: AgendaGroup<T>[] = [
    { key: "weekend", label: "Dit weekend", events: [] },
    { key: "next_week", label: "Volgende week", events: [] },
    { key: "month", label: "Later deze maand", events: [] },
    { key: "later", label: "Later", events: [] },
  ];

  for (const event of events) {
    if (eventOverlapsRange(event, weekend.from, weekend.to)) {
      buckets[0]!.events.push(event);
    } else if (eventOverlapsRange(event, nextWeek.from, nextWeek.to)) {
      buckets[1]!.events.push(event);
    } else if (eventOverlapsRange(event, month.from, month.to)) {
      buckets[2]!.events.push(event);
    } else {
      buckets[3]!.events.push(event);
    }
  }

  return buckets.filter((b) => b.events.length > 0);
}
