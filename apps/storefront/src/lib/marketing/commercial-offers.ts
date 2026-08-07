/**
 * Re-exports from public-pricing for backward compatibility.
 * Home-event helpers remain here; plan arrays are deprecated.
 */
export {
  WORKSHOP_COMMISSION_NOTE,
  SUPPLIER_COMMISSION_NOTE,
  WORKSHOP_PLANS,
  SUPPLIER_PLANS,
  ORGANIZER_PLANS,
  WORKSHOP_PLAN_FAQ,
  ORGANIZER_PLAN_FAQ,
  type MarketingPlanCard,
} from "@/lib/pricing/public-pricing";

export const HOME_EVENT_CAMPAIGN_MIN_EVENTS = 4;
export const HOME_EVENT_CAMPAIGN_MIN_REGIONS = 2;

export function isHomeEventCampaignReady(events: {
  city?: string | null;
  country_code?: string | null;
}[]): boolean {
  if (events.length < HOME_EVENT_CAMPAIGN_MIN_EVENTS) return false;
  const regions = new Set(
    events
      .map((event) => {
        const city = event.city?.trim().toLowerCase();
        const country = event.country_code?.trim().toUpperCase();
        if (city) return `city:${city}`;
        if (country) return `country:${country}`;
        return null;
      })
      .filter((value): value is string => Boolean(value))
  );
  return regions.size >= HOME_EVENT_CAMPAIGN_MIN_REGIONS;
}
