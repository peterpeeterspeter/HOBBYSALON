/**
 * Pure homepage router helpers (no Next/Supabase imports — safe for unit tests).
 */

import {
  agendaInstantMs,
  isUpcomingOrOngoingToday,
} from "@/lib/agenda/agenda-helpers";
import type { Event } from "@/types/platform";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Near-term first; mild featured boost so far fairs don't displace this weekend.
 *  If nothing falls in the near windows, fall back to all upcoming events so the
 *  homepage still surfaces the agenda when inventory is sparse or far out.
 *  Multi-day events that started earlier stay if ends_at ≥ today; past single-day drop. */
export function selectHomeAgendaEvents(
  events: Event[],
  limit = 3,
  now = new Date()
): Event[] {
  const nowMs = now.getTime();
  const upcoming = events.filter((event) =>
    isUpcomingOrOngoingToday(event, now)
  );

  const windows = [21, 45, 90];
  let pool: Event[] = [];
  for (const days of windows) {
    const horizon = nowMs + days * DAY_MS;
    pool = upcoming.filter((event) => {
      const start = agendaInstantMs(event.starts_at);
      return Number.isFinite(start) && (start <= horizon || start <= nowMs);
    });
    if (pool.length >= limit) break;
  }

  if (pool.length === 0) {
    pool = upcoming;
  }

  return [...pool]
    .sort((a, b) => {
      const aRank =
        agendaInstantMs(a.starts_at) - (a.is_featured ? 3 * DAY_MS : 0);
      const bRank =
        agendaInstantMs(b.starts_at) - (b.is_featured ? 3 * DAY_MS : 0);
      return aRank - bRank;
    })
    .slice(0, limit);
}

export function isLikelyTestHomeContent(title: string, slug: string): boolean {
  const hay = `${title} ${slug}`.toLowerCase();
  if (
    [
      "testproduct",
      "edzzed",
      "prject",
      "test workshop",
      "testproject",
      "demo ",
      "demo-",
      "-demo",
      "placeholder",
      "lorem ipsum",
    ].some((m) => hay.includes(m))
  ) {
    return true;
  }
  return (
    /^test\b/.test(hay) ||
    /^demo\b/.test(hay) ||
    title.trim().length < 3
  );
}
