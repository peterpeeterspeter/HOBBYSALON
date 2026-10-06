import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import {
  resolveDashboardCapabilities,
  resolveOfferSections,
} from "@/lib/auth/dashboard-access";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { createPlatformClient } from "@/lib/platform/client";
import {
  resolveCreationStatus,
  resolveEventStatus,
  resolveWorkshopStatus,
  sortInbox,
  type InboxItem,
} from "@/lib/dashboard/offer-status";
import type { OfferStatus } from "@/lib/dashboard/copy";

/** Auth + creator + capabilities, deduped per request. */
export const getDashboardContext = cache(async (nextPath = "/dashboard") => {
  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  const [creator, registrationContext] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  return {
    user,
    creator,
    registrationContext,
    caps,
    offerSections: resolveOfferSections(caps),
  };
});

type RelTitle = { title: string | null } | Array<{ title: string | null }> | null;

function relTitle(value: RelTitle, fallback: string): string {
  if (!value) return fallback;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.title ?? fallback;
}

export type InboxRow = InboxItem & { status: string; itemId: string | null };

/**
 * All requests (product, workshop, event) for one creator, new first.
 * Pass `itemId` together with exactly one source to load the requests of a
 * single creation, workshop or event.
 */
export async function loadInbox(input: {
  creatorId: string;
  includeCreations: boolean;
  includeWorkshops: boolean;
  includeEvents: boolean;
  limit?: number;
  itemId?: string;
}): Promise<InboxRow[]> {
  const supabase = createPlatformClient();
  const limit = input.limit ?? 30;
  const itemId = input.itemId ?? null;

  let productQuery = supabase
    .from("product_inquiries")
    .select("id, product_id, full_name, email, message, status, created_at, products(title)")
    .eq("creator_id", input.creatorId);
  if (itemId) productQuery = productQuery.eq("product_id", itemId);

  let workshopQuery = supabase
    .from("workshop_booking_requests")
    .select("id, workshop_id, full_name, email, message, status, created_at, workshops(title)")
    .eq("creator_id", input.creatorId);
  if (itemId) workshopQuery = workshopQuery.eq("workshop_id", itemId);

  let eventQuery = supabase
    .from("event_vendor_inquiries")
    .select(
      "id, event_id, contact_name, business_name, email, message, status, created_at, events(title)"
    )
    .eq("organizer_creator_id", input.creatorId);
  if (itemId) eventQuery = eventQuery.eq("event_id", itemId);

  const [products, workshops, events] = await Promise.all([
    input.includeCreations
      ? productQuery.order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    input.includeWorkshops
      ? workshopQuery.order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    input.includeEvents
      ? eventQuery.order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
  ]);

  type Row = {
    id: string;
    product_id?: string | null;
    workshop_id?: string | null;
    event_id?: string | null;
    full_name?: string | null;
    contact_name?: string | null;
    business_name?: string | null;
    email: string;
    message: string | null;
    status: string;
    created_at: string;
    products?: RelTitle;
    workshops?: RelTitle;
    events?: RelTitle;
  };

  const items: InboxRow[] = [
    ...((products.data ?? []) as Row[]).map((row) => ({
      id: row.id,
      source: "creatie" as const,
      name: row.full_name ?? "",
      email: row.email,
      message: row.message,
      subject: relTitle(row.products ?? null, "je creatie"),
      createdAt: row.created_at,
      isNew: row.status === "new",
      status: row.status,
      itemId: row.product_id ?? null,
      manageHref: row.product_id ? `/dashboard/products/${row.product_id}#aanvragen` : "/dashboard/aanbod",
    })),
    ...((workshops.data ?? []) as Row[]).map((row) => ({
      id: row.id,
      source: "workshop" as const,
      name: row.full_name ?? "",
      email: row.email,
      message: row.message,
      subject: relTitle(row.workshops ?? null, "je workshop"),
      createdAt: row.created_at,
      isNew: row.status === "new",
      status: row.status,
      itemId: row.workshop_id ?? null,
      manageHref: row.workshop_id ? `/dashboard/workshops/${row.workshop_id}#aanvragen` : "/dashboard/aanbod",
    })),
    ...((events.data ?? []) as Row[]).map((row) => ({
      id: row.id,
      source: "event" as const,
      name: [row.contact_name, row.business_name].filter(Boolean).join(", "),
      email: row.email,
      message: row.message,
      subject: relTitle(row.events ?? null, "je event"),
      createdAt: row.created_at,
      isNew: row.status === "new",
      status: row.status,
      itemId: row.event_id ?? null,
      manageHref: row.event_id ? `/dashboard/events/${row.event_id}#aanvragen` : "/dashboard/aanbod",
    })),
  ];

  return sortInbox(items) as InboxRow[];
}

export type OfferListItem = {
  id: string;
  kind: "creatie" | "workshop" | "event";
  title: string;
  imageUrl: string | null;
  status: OfferStatus;
  detail: string | null;
  editHref: string;
  publicHref: string | null;
  sortDate: string;
};

const dateFmt = new Intl.DateTimeFormat("nl-BE", {
  weekday: "short",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Brussels",
});

export function formatDashboardDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** Everything a creator offers, in one list. */
export async function loadOfferList(input: {
  creatorId: string;
  includeCreations: boolean;
  includeWorkshops: boolean;
  includeEvents: boolean;
  canPublishWorkshops: boolean;
  canPublishEvents: boolean;
}): Promise<OfferListItem[]> {
  const supabase = createPlatformClient();
  const nowIso = new Date().toISOString();

  const [products, workshops, sessions, events] = await Promise.all([
    input.includeCreations
      ? supabase
          .from("products")
          .select("id, slug, title, featured_image_url, is_active, price_cents, product_type, updated_at")
          .eq("creator_id", input.creatorId)
          .in("product_type", ["handmade", "destash"])
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    input.includeWorkshops
      ? supabase
          .from("workshops")
          .select(
            "id, slug, title, featured_image_url, is_active, listing_fee_status, listing_expires_at, updated_at"
          )
          .eq("creator_id", input.creatorId)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    input.includeWorkshops
      ? supabase
          .from("workshop_sessions")
          .select("workshop_id, starts_at, is_cancelled, workshops!inner(creator_id)")
          .eq("workshops.creator_id", input.creatorId)
          .eq("is_cancelled", false)
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    input.includeEvents
      ? supabase
          .from("events")
          .select("id, slug, title, featured_image_url, is_active, starts_at, updated_at")
          .eq("organizer_creator_id", input.creatorId)
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const nextSession = new Map<string, string>();
  for (const row of (sessions.data ?? []) as Array<{ workshop_id: string; starts_at: string }>) {
    if (!nextSession.has(row.workshop_id)) nextSession.set(row.workshop_id, row.starts_at);
  }

  const items: OfferListItem[] = [];

  for (const row of (products.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    featured_image_url: string | null;
    is_active: boolean;
    price_cents: number | null;
    updated_at: string;
  }>) {
    items.push({
      id: row.id,
      kind: "creatie",
      title: row.title,
      imageUrl: row.featured_image_url,
      status: resolveCreationStatus(row),
      detail:
        row.price_cents != null
          ? new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(
              row.price_cents / 100
            )
          : null,
      editHref: `/dashboard/products/${row.id}`,
      publicHref: row.is_active ? `/product/${row.slug}` : null,
      sortDate: row.updated_at,
    });
  }

  for (const row of (workshops.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    featured_image_url: string | null;
    is_active: boolean;
    listing_fee_status: string | null;
    listing_expires_at: string | null;
    updated_at: string;
  }>) {
    const status = resolveWorkshopStatus({ ...row, canPublish: input.canPublishWorkshops });
    const next = nextSession.get(row.id);
    items.push({
      id: row.id,
      kind: "workshop",
      title: row.title,
      imageUrl: row.featured_image_url,
      status,
      detail: next ? `Volgende datum: ${formatDashboardDate(next)}` : "Nog geen komende datum",
      editHref: `/dashboard/workshops/${row.id}`,
      publicHref: status === "visible" ? `/workshop/${row.slug}` : null,
      sortDate: row.updated_at,
    });
  }

  for (const row of (events.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    featured_image_url: string | null;
    is_active: boolean;
    starts_at: string;
    updated_at: string;
  }>) {
    const status = resolveEventStatus({ ...row, canPublish: input.canPublishEvents });
    items.push({
      id: row.id,
      kind: "event",
      title: row.title,
      imageUrl: row.featured_image_url,
      status,
      detail: formatDashboardDate(row.starts_at),
      editHref: `/dashboard/events/${row.id}`,
      publicHref: status === "visible" ? `/agenda/${row.slug}` : null,
      sortDate: row.updated_at,
    });
  }

  return items.sort(
    (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
  );
}

/** Upcoming workshop dates and events in the next 30 days. */
export async function loadUpcoming(input: {
  creatorId: string;
  includeWorkshops: boolean;
  includeEvents: boolean;
}): Promise<Array<{ id: string; title: string; startsAt: string; href: string; kind: string }>> {
  const supabase = createPlatformClient();
  const now = new Date();
  const until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [sessions, events] = await Promise.all([
    input.includeWorkshops
      ? supabase
          .from("workshop_sessions")
          .select("id, workshop_id, starts_at, workshops!inner(title, creator_id)")
          .eq("workshops.creator_id", input.creatorId)
          .eq("is_cancelled", false)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", until.toISOString())
          .order("starts_at", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    input.includeEvents
      ? supabase
          .from("events")
          .select("id, title, starts_at")
          .eq("organizer_creator_id", input.creatorId)
          .gte("starts_at", now.toISOString())
          .lte("starts_at", until.toISOString())
          .order("starts_at", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = [
    ...((sessions.data ?? []) as Array<{
      id: string;
      workshop_id: string;
      starts_at: string;
      workshops: RelTitle;
    }>).map((row) => ({
      id: row.id,
      title: relTitle(row.workshops, "Workshop"),
      startsAt: row.starts_at,
      href: `/dashboard/workshops/${row.workshop_id}`,
      kind: "Workshop",
    })),
    ...((events.data ?? []) as Array<{ id: string; title: string; starts_at: string }>).map(
      (row) => ({
        id: row.id,
        title: row.title,
        startsAt: row.starts_at,
        href: `/dashboard/events/${row.id}`,
        kind: "Event",
      })
    ),
  ];

  return rows
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 5);
}
