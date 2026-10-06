import { isWorkshopListingPubliclyVisible } from "@/lib/pricing/workshop-launch-offer";
import { DASHBOARD_COPY, type OfferStatus } from "@/lib/dashboard/copy";

/**
 * One plain status per offer item. Every list, card and edit page uses this,
 * so users never see "actief · wacht op betaling · verlopen" side by side.
 */
export function resolveWorkshopStatus(input: {
  is_active: boolean;
  listing_fee_status?: string | null;
  listing_expires_at?: string | null;
  canPublish: boolean;
  now?: Date;
}): OfferStatus {
  if (!input.is_active) {
    return input.canPublish ? "draft" : "review";
  }
  if (!input.canPublish) return "review";
  if (
    isWorkshopListingPubliclyVisible({
      is_active: input.is_active,
      listing_fee_status: input.listing_fee_status,
      listing_expires_at: input.listing_expires_at,
      now: input.now,
    })
  ) {
    return "visible";
  }
  if (input.listing_fee_status === "paid") return "expired";
  return "payment";
}

export function resolveEventStatus(input: {
  is_active: boolean;
  canPublish: boolean;
}): OfferStatus {
  if (!input.canPublish) return "review";
  return input.is_active ? "visible" : "draft";
}

export function resolveCreationStatus(input: { is_active: boolean }): OfferStatus {
  return input.is_active ? "visible" : "draft";
}

export function offerStatusLabel(status: OfferStatus): string {
  return DASHBOARD_COPY.status[status];
}

export type InboxSource = "creatie" | "workshop" | "event";

export type InboxItem = {
  id: string;
  source: InboxSource;
  name: string;
  email: string;
  message: string | null;
  subject: string;
  createdAt: string;
  isNew: boolean;
  manageHref: string;
};

const SOURCE_LABEL: Record<InboxSource, string> = {
  creatie: "Vraag over je creatie",
  workshop: "Boekingsaanvraag workshop",
  event: "Aanvraag standplaats",
};

export function inboxSourceLabel(source: InboxSource): string {
  return SOURCE_LABEL[source];
}

/** New first, then newest first. */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function buildReplyMailto(item: InboxItem): string {
  const subject = `Re: ${item.subject}`;
  const greeting = item.name ? `Dag ${item.name.split(" ")[0]},` : "Dag,";
  const body = `${greeting}\n\nBedankt voor je bericht via Hobbysalon.\n\n`;
  return `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
