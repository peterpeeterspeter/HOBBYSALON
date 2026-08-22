/**
 * Workshopgever launch offer — single source of truth for cutoff, free cap,
 * paid fee, and Dutch marketing/dashboard copy.
 *
 * Launch window: until 1 October 2026 (Europe/Brussels). Up to 3 active
 * workshops are free and stay free after the cutoff. Extra / new listings
 * cost €9,99 for 2 months of visibility.
 */

export const WORKSHOP_LAUNCH_ENDS_AT = new Date("2026-10-01T00:00:00+02:00");

export const WORKSHOP_FREE_LISTING_CAP = 3;

export const WORKSHOP_LISTING_FEE_CENTS = 999;

export const WORKSHOP_LISTING_FEE_CURRENCY = "EUR";

export const WORKSHOP_PAID_VISIBILITY_MONTHS = 2;

export type WorkshopListingFeeStatus = "launch_free" | "paid" | "unpaid";

export function isWorkshopLaunchWindowOpen(now: Date = new Date()): boolean {
  return now.getTime() < WORKSHOP_LAUNCH_ENDS_AT.getTime();
}

export function canGrantWorkshopLaunchFreeSlot(
  launchFreeCount: number,
  now: Date = new Date()
): boolean {
  if (!isWorkshopLaunchWindowOpen(now)) return false;
  return launchFreeCount < WORKSHOP_FREE_LISTING_CAP;
}

/** Add N calendar months in UTC (matches Stripe one-time listing window). */
export function paidWorkshopListingExpiresAt(
  from: Date = new Date(),
  months: number = WORKSHOP_PAID_VISIBILITY_MONTHS
): Date {
  const expires = new Date(from.getTime());
  expires.setUTCMonth(expires.getUTCMonth() + months);
  return expires;
}

export function isWorkshopListingPubliclyVisible(input: {
  is_active: boolean;
  listing_fee_status: WorkshopListingFeeStatus | string | null | undefined;
  listing_expires_at: string | null | undefined;
  now?: Date;
}): boolean {
  if (!input.is_active) return false;
  const status = input.listing_fee_status ?? "unpaid";
  if (status === "launch_free") return true;
  if (status !== "paid") return false;
  if (!input.listing_expires_at) return false;
  const expires = new Date(input.listing_expires_at).getTime();
  if (Number.isNaN(expires)) return false;
  return expires > (input.now ?? new Date()).getTime();
}

export const WORKSHOP_LAUNCH_COPY = {
  /** Short badge / route card title during launch */
  offerHeadline: "Lanceraanbod: 3 workshops gratis tot 1 oktober",
  /** Dashboard banner lead */
  offerBody:
    "Tot 1 oktober 2026 mag je tot 3 workshops gratis plaatsen. Die drie blijven daarna gratis. Extra vermeldingen kosten €9,99 en blijven 2 maanden zichtbaar.",
  /** After-launch price line used on marketing pages */
  afterLaunchPrice:
    "Daarna €9,99 per extra vermelding, 2 maanden zichtbaar. Je 3 lanceringworkshops blijven gratis.",
  /** Paid fee display */
  feeLabel: "€9,99",
  feePeriodLabel: "per workshopvermelding, 2 maanden zichtbaar",
  /** Block publish when no free slot and unpaid */
  needPaymentMessage:
    "Je gratis lanceringsslots zijn op. Betaal €9,99 voor 2 maanden zichtbaarheid, of bewaar als concept.",
  /** Expired paid listing */
  expiredMessage: "Deze vermelding is verlopen. Activeer opnieuw voor €9,99 (2 maanden).",
  freeSlotsLabel: (used: number, cap: number = WORKSHOP_FREE_LISTING_CAP) =>
    `Gratis lanceringsslots: ${used}/${cap}`,
} as const;
