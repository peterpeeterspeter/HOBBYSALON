import { unstable_cache } from "next/cache";
import {
  eventIsUpcomingOrOngoing,
  resolveAgendaDatePreset,
} from "@/lib/agenda/agenda-helpers";
import {
  formatCreatorOfferSentence,
  formatCreatorSpecialtyLine,
  resolveCreatorCardPhoto,
} from "@/lib/creators/creators-directory-helpers";
import { createPlatformClient } from "@/lib/platform/client";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listCreatorsDirectory,
  type CreatorDirectoryItem,
} from "@/lib/platform/queries/creators";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listAgendaEvents } from "@/lib/platform/queries/events";
import { listFeaturedProjects } from "@/lib/platform/queries/projects";
import {
  listDiscoveryWorkshops,
  type WorkshopDiscoveryItem,
} from "@/lib/platform/queries/workshops";
import { logServerPerf } from "@/lib/perf/server-timing";
import {
  resolveHomeJourney,
  type HomeJourney,
} from "@/lib/services/home-journey";
import {
  isLikelyTestHomeContent,
  selectHomeAgendaEvents,
} from "@/lib/services/home-router-helpers";
import type { Article, Domain, Event, Project } from "@/types/platform";

const HOME_PAGE_FETCH_TIMEOUT_MS = 45_000;
const DOMAIN_CHIP_CAP = 8;
const EVENT_TEASER_LIMIT = 3;
const WORKSHOP_TEASER_LIMIT = 3;
const MAKE_TEASER_LIMIT = 3;
const MAKER_TEASER_LIMIT = 3;

export type HomeMakeItem =
  | { kind: "article"; item: Article }
  | { kind: "project"; item: Project };

export type HomeEventMaker = {
  id: string;
  slug: string;
  display_name: string;
  business_name: string | null;
  avatar_url: string | null;
  studioName: string;
};

export type HomeEventTeaser = Event & {
  makers: HomeEventMaker[];
};

export type HomePageData = {
  domainsWithLiveContent: Domain[];
  featuredEvents: HomeEventTeaser[];
  journey: HomeJourney | null;
  upcomingWorkshops: WorkshopDiscoveryItem[];
  homeMakeItems: HomeMakeItem[];
  makers: CreatorDirectoryItem[];
};

const EMPTY_HOME_PAGE_DATA: HomePageData = {
  domainsWithLiveContent: [],
  featuredEvents: [],
  journey: null,
  upcomingWorkshops: [],
  homeMakeItems: [],
  makers: [],
};

async function settledValue<T>(
  promise: Promise<T>,
  fallback: T,
  label: string
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`[home-page] ${label} failed:`, error);
    return fallback;
  }
}

/** Near-term event selection — see home-router-helpers. */
export { selectHomeAgendaEvents } from "@/lib/services/home-router-helpers";

async function loadConfirmedEventMakers(
  eventIds: string[]
): Promise<Map<string, HomeEventMaker[]>> {
  const result = new Map<string, HomeEventMaker[]>();
  if (eventIds.length === 0) return result;

  const supabase = createPlatformClient();
  const { data: rosterRows, error } = await supabase
    .from("event_creators")
    .select("event_id, creator_id, role")
    .in("event_id", eventIds);

  if (error || !rosterRows?.length) return result;

  const creatorIds = [
    ...new Set(
      (rosterRows as Array<{ creator_id: string }>).map((r) => r.creator_id)
    ),
  ];
  const { data: creators } = await supabase
    .from("creators")
    .select("id, slug, display_name, business_name, avatar_url")
    .in("id", creatorIds);

  const byId = new Map<string, HomeEventMaker>();
  for (const row of creators ?? []) {
    const c = row as {
      id: string;
      slug: string;
      display_name: string;
      business_name: string | null;
      avatar_url: string | null;
    };
    byId.set(c.id, {
      id: c.id,
      slug: c.slug,
      display_name: c.display_name,
      business_name: c.business_name,
      avatar_url: c.avatar_url,
      studioName: c.business_name?.trim() || c.display_name,
    });
  }

  for (const row of rosterRows as Array<{
    event_id: string;
    creator_id: string;
  }>) {
    const maker = byId.get(row.creator_id);
    if (!maker) continue;
    const list = result.get(row.event_id) ?? [];
    if (!list.some((m) => m.id === maker.id)) {
      list.push(maker);
    }
    result.set(row.event_id, list);
  }

  return result;
}

async function loadFeaturedEventsBlock(): Promise<HomeEventTeaser[]> {
  const { events } = await listAgendaEvents({ upcoming_only: true });
  const selected = selectHomeAgendaEvents(events, EVENT_TEASER_LIMIT);
  const makersByEvent = await loadConfirmedEventMakers(
    selected.map((e) => e.id)
  );
  return selected.map((event) => ({
    ...event,
    makers: makersByEvent.get(event.id) ?? [],
  }));
}

async function loadDomainsWithLiveContent(
  workshops: WorkshopDiscoveryItem[],
  events: HomeEventTeaser[]
): Promise<Domain[]> {
  const domains = await listActiveDomains();
  if (domains.length === 0) return [];

  const supabase = createPlatformClient();
  const liveIds = new Set<string>();

  for (const workshop of workshops) {
    if (workshop.domain_id) liveIds.add(workshop.domain_id);
  }

  const eventIds = events.map((e) => e.id);
  if (eventIds.length > 0) {
    const { data: eventDomains } = await supabase
      .from("event_domains")
      .select("domain_id")
      .in("event_id", eventIds);
    for (const row of eventDomains ?? []) {
      const id = (row as { domain_id: string }).domain_id;
      if (id) liveIds.add(id);
    }
  }

  // Broader live signals (not limited to teaser rows)
  const nowIso = new Date().toISOString();
  const [
    { data: workshopDomainRows },
    { data: articleDomainRows },
    { data: articleDirectRows },
    { data: productDomainRows },
    { data: moreEventDomainRows },
  ] = await Promise.all([
    supabase
      .from("workshops")
      .select("domain_id")
      .eq("is_active", true)
      .not("domain_id", "is", null)
      .limit(200),
    supabase.from("article_domains").select("domain_id").limit(200),
    supabase
      .from("articles")
      .select("domain_id")
      .eq("is_published", true)
      .not("domain_id", "is", null)
      .limit(200),
    supabase
      .from("products")
      .select("domain_id")
      .eq("is_active", true)
      .eq("status", "active")
      .not("domain_id", "is", null)
      .limit(200),
    supabase.from("event_domains").select("domain_id, event_id").limit(300),
  ]);

  for (const row of workshopDomainRows ?? []) {
    const id = (row as { domain_id: string | null }).domain_id;
    if (id) liveIds.add(id);
  }
  for (const row of articleDomainRows ?? []) {
    const id = (row as { domain_id: string }).domain_id;
    if (id) liveIds.add(id);
  }
  for (const row of articleDirectRows ?? []) {
    const id = (row as { domain_id: string | null }).domain_id;
    if (id) liveIds.add(id);
  }
  for (const row of productDomainRows ?? []) {
    const id = (row as { domain_id: string | null }).domain_id;
    if (id) liveIds.add(id);
  }

  // Only count event domains for upcoming/ongoing events
  const eventIdsForDomains = [
    ...new Set(
      (moreEventDomainRows ?? []).map(
        (r) => (r as { event_id: string }).event_id
      )
    ),
  ];
  if (eventIdsForDomains.length > 0) {
    const { data: eventRows } = await supabase
      .from("events")
      .select("id, starts_at, ends_at")
      .in("id", eventIdsForDomains.slice(0, 200))
      .eq("is_active", true);
    const upcomingEventIds = new Set(
      ((eventRows ?? []) as Event[])
        .filter((e) => eventIsUpcomingOrOngoing(e, nowIso))
        .map((e) => e.id)
    );
    for (const row of moreEventDomainRows ?? []) {
      const r = row as { domain_id: string; event_id: string };
      if (upcomingEventIds.has(r.event_id)) liveIds.add(r.domain_id);
    }
  }

  // Preserve stable sort_order from listActiveDomains
  return domains.filter((d) => liveIds.has(d.id)).slice(0, DOMAIN_CHIP_CAP);
}

async function loadMakeItems(): Promise<HomeMakeItem[]> {
  const [articles, projects] = await Promise.all([
    listLatestArticles(12),
    listFeaturedProjects(8),
  ]);

  const projectItems: HomeMakeItem[] = projects
    .filter(
      (p) =>
        Boolean(p.featured_image_url?.trim()) &&
        !isLikelyTestHomeContent(p.title, p.slug)
    )
    .map((item) => ({ kind: "project" as const, item }));

  const articleItems: HomeMakeItem[] = articles
    .filter(
      (a) =>
        Boolean(a.featured_image_url?.trim()) &&
        !isLikelyTestHomeContent(a.title, a.slug) &&
        a.article_type !== "news"
    )
    .map((item) => ({ kind: "article" as const, item }));

  const merged: HomeMakeItem[] = [];
  const max = Math.max(projectItems.length, articleItems.length);
  for (let i = 0; i < max && merged.length < MAKE_TEASER_LIMIT; i++) {
    if (projectItems[i]) merged.push(projectItems[i]!);
    if (merged.length >= MAKE_TEASER_LIMIT) break;
    if (articleItems[i]) merged.push(articleItems[i]!);
  }
  return merged;
}

async function loadMakersBlock(
  featuredEvents: HomeEventTeaser[]
): Promise<CreatorDirectoryItem[]> {
  const rosterIds = [
    ...new Set(featuredEvents.flatMap((e) => e.makers.map((m) => m.id))),
  ];

  const directory = await listCreatorsDirectory({
    sort: "recommended",
    limit: 24,
  });

  const byId = new Map(directory.creators.map((c) => [c.id, c]));
  const selected: CreatorDirectoryItem[] = [];

  for (const id of rosterIds) {
    const fromDir = byId.get(id);
    if (fromDir) {
      selected.push(fromDir);
    } else {
      // Roster maker may not be in first directory page — build a lean card
      const rosterMaker = featuredEvents
        .flatMap((e) => e.makers)
        .find((m) => m.id === id);
      if (!rosterMaker) continue;
      const lean: CreatorDirectoryItem = {
        id: rosterMaker.id,
        slug: rosterMaker.slug,
        display_name: rosterMaker.display_name,
        business_name: rosterMaker.business_name,
        bio: null,
        avatar_url: rosterMaker.avatar_url,
        banner_url: null,
        website_url: null,
        instagram_url: null,
        facebook_url: null,
        city: null,
        country_code: null,
        creator_types: [],
        is_verified: false,
        is_featured: false,
        created_at: "",
        updated_at: "",
        domainNames: [],
        domainIds: [],
        offerSentence: formatCreatorOfferSentence([]),
        specialtyLine: formatCreatorSpecialtyLine({ domainNames: [] }),
        photoUrl: resolveCreatorCardPhoto({
          banner_url: null,
          avatar_url: rosterMaker.avatar_url,
        }),
        studioName: rosterMaker.studioName,
      };
      selected.push(lean);
    }
    if (selected.length >= MAKER_TEASER_LIMIT) break;
  }

  if (selected.length < MAKER_TEASER_LIMIT) {
    for (const creator of directory.creators) {
      if (selected.some((s) => s.id === creator.id)) continue;
      if (!creator.photoUrl && !creator.specialtyLine) continue;
      selected.push(creator);
      if (selected.length >= MAKER_TEASER_LIMIT) break;
    }
  }

  return selected.filter(
    (c) => Boolean(c.photoUrl) || Boolean(c.specialtyLine)
  );
}

async function loadHomePageData(): Promise<HomePageData> {
  const totalStartMs = Date.now();

  const [featuredEvents, upcomingWorkshops, homeMakeItems, journey] =
    await Promise.all([
      settledValue(loadFeaturedEventsBlock(), [], "agenda"),
      settledValue(
        listDiscoveryWorkshops({
          sort: "soon",
          limit: WORKSHOP_TEASER_LIMIT,
        }).then((r) =>
          r.workshops.filter(
            (w) =>
              Boolean(w.nextSession?.startsAt) &&
              !isLikelyTestHomeContent(w.title, w.slug)
          )
        ),
        [],
        "workshops"
      ),
      settledValue(loadMakeItems(), [], "make-items"),
      settledValue(resolveHomeJourney(), null, "journey"),
    ]);

  const [domainsWithLiveContent, makers] = await Promise.all([
    settledValue(
      loadDomainsWithLiveContent(upcomingWorkshops, featuredEvents),
      [],
      "domains"
    ),
    settledValue(loadMakersBlock(featuredEvents), [], "makers"),
  ]);

  logServerPerf("home-page", {
    total: Date.now() - totalStartMs,
    events: featuredEvents.length,
    workshops: upcomingWorkshops.length,
    make: homeMakeItems.length,
    makers: makers.length,
    domains: domainsWithLiveContent.length,
    journey: journey ? 1 : 0,
  });

  return {
    domainsWithLiveContent,
    featuredEvents,
    journey,
    upcomingWorkshops,
    homeMakeItems,
    makers,
  };
}

function normalizeHomePageData(
  data: Partial<HomePageData> | null | undefined
): HomePageData {
  return {
    ...EMPTY_HOME_PAGE_DATA,
    ...data,
    domainsWithLiveContent: data?.domainsWithLiveContent ?? [],
    featuredEvents: data?.featuredEvents ?? [],
    journey: data?.journey ?? null,
    upcomingWorkshops: data?.upcomingWorkshops ?? [],
    homeMakeItems: data?.homeMakeItems ?? [],
    makers: data?.makers ?? [],
  };
}

async function withTimeoutFallback<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const getHomePageDataCached = unstable_cache(
  async (): Promise<HomePageData> => {
    try {
      return normalizeHomePageData(
        await withTimeoutFallback(
          loadHomePageData(),
          HOME_PAGE_FETCH_TIMEOUT_MS,
          EMPTY_HOME_PAGE_DATA
        )
      );
    } catch {
      return EMPTY_HOME_PAGE_DATA;
    }
  },
  ["home-page-data-v4"],
  {
    revalidate: 60 * 5,
    tags: ["home-page"],
  }
);

export async function getHomePageData(): Promise<HomePageData> {
  return normalizeHomePageData(await getHomePageDataCached());
}

/** Exported for hero weekend CTA — Europe/Brussels via agenda helpers. */
export function homeWeekendAgendaHref(): string {
  const range = resolveAgendaDatePreset("weekend");
  if (!range) return "/agenda";
  return "/agenda?when=weekend";
}
