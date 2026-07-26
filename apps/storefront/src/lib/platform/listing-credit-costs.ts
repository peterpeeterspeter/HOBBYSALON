/**
 * Listing fee pricing, in credits. 1 credit ~ EUR0.50.
 *
 * Deliberately free of imports: this is pure configuration, so it can be
 * read and tested without pulling in `server-only` or a Supabase client.
 * listing-credits.ts re-exports everything here, so consumers can keep
 * importing from either module.
 */

export const LISTING_CREDIT_COSTS = {
  handmadeListing: 1,
  collectionListing: 3,
  listingBump: 1,
  spotlight7Days: 5,
  homepageSpotlight: 20,
  newsletterFeature: 35,
  // Flat cost per outreach send, regardless of recipient count - matches
  // the "hoogste-marge product" positioning (~200 credits = ~EUR99).
  exhibitorOutreach: 200,
} as const;

// Cost to publish an event, by event_type. pop_up/open_atelier are
// low-commitment; workshop_day/handmade_market are a full organized day;
// hobby_fair is the "beurs" tier with real B2B reach.
export const EVENT_CREDIT_COSTS: Record<string, number> = {
  pop_up: 15,
  open_atelier: 15,
  workshop_day: 30,
  handmade_market: 30,
  hobby_fair: 200,
};

export function getEventCreditCost(eventType: string): number {
  return EVENT_CREDIT_COSTS[eventType] ?? EVENT_CREDIT_COSTS.handmade_market;
}
