/**
 * Pure homepage router helpers (no Next/Supabase imports — safe for unit tests).
 */

import { eventIsUpcomingOrOngoing } from "@/lib/agenda/agenda-helpers";
import type { Event } from "@/types/platform";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Near-term first; mild featured boost so far fairs don't displace this weekend. */
export function selectHomeAgendaEvents(
  events: Event[],
  limit = 3
): Event[] {
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const upcoming = events.filter((event) =>
    eventIsUpcomingOrOngoing(event, nowIso)
  );

  const windows = [21, 45, 90];
  let pool: Event[] = [];
  for (const days of windows) {
    const horizon = now + days * DAY_MS;
    pool = upcoming.filter((event) => {
      const start = new Date(event.starts_at).getTime();
      return start <= horizon || start <= now;
    });
    if (pool.length >= limit) break;
  }

  return [...pool]
    .sort((a, b) => {
      const aRank =
        new Date(a.starts_at).getTime() - (a.is_featured ? 3 * DAY_MS : 0);
      const bRank =
        new Date(b.starts_at).getTime() - (b.is_featured ? 3 * DAY_MS : 0);
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
