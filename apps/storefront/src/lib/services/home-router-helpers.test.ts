import assert from "node:assert/strict";
import test from "node:test";
import {
  isLikelyTestHomeContent,
  selectHomeAgendaEvents,
} from "./home-router-helpers";
import type { Event } from "@/types/platform";

function eventFixture(
  overrides: Partial<Event> & Pick<Event, "id" | "starts_at">
): Event {
  return {
    slug: overrides.id,
    title: overrides.id,
    short_description: null,
    description: null,
    event_type: "market",
    organizer_creator_id: null,
    ends_at: overrides.ends_at ?? overrides.starts_at,
    location_name: null,
    address_line_1: null,
    city: "Gent",
    postal_code: null,
    country_code: "BE",
    latitude: null,
    longitude: null,
    ticketing_mode: "none",
    ticket_url: null,
    ticket_price_cents: null,
    currency_code: null,
    featured_image_url: null,
    is_featured: false,
    is_active: true,
    seo_title: null,
    seo_description: null,
    created_at: overrides.starts_at,
    updated_at: overrides.starts_at,
    ...overrides,
  };
}

test("selectHomeAgendaEvents prefers near events over far featured", () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const near = eventFixture({
    id: "near",
    starts_at: new Date(now + 2 * day).toISOString(),
    is_featured: false,
  });
  const farFeatured = eventFixture({
    id: "far",
    starts_at: new Date(now + 50 * day).toISOString(),
    is_featured: true,
  });
  const selected = selectHomeAgendaEvents([farFeatured, near], 1);
  assert.equal(selected[0]?.id, "near");
});

test("selectHomeAgendaEvents drops past starts even with far-future ends_at", () => {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const stale = eventFixture({
    id: "stale",
    starts_at: new Date(now.getTime() - 60 * day).toISOString(),
    ends_at: new Date(now.getTime() + 400 * day).toISOString(),
  });
  const upcoming = eventFixture({
    id: "upcoming",
    starts_at: new Date(now.getTime() + 3 * day).toISOString(),
  });
  const selected = selectHomeAgendaEvents([stale, upcoming], 2, now);
  assert.deepEqual(
    selected.map((e) => e.id),
    ["upcoming"]
  );
});

test("selectHomeAgendaEvents falls back to far upcoming when near pool is empty", () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const far = eventFixture({
    id: "far-only",
    starts_at: new Date(now + 400 * day).toISOString(),
  });
  const selected = selectHomeAgendaEvents([far], 1);
  assert.equal(selected[0]?.id, "far-only");
});

test("isLikelyTestHomeContent filters demo and test seed titles", () => {
  assert.equal(
    isLikelyTestHomeContent(
      "Demo afgewerkte creatie",
      "demo-afgewerkte-creatie"
    ),
    true
  );
  assert.equal(
    isLikelyTestHomeContent("Testproject haken", "testproject-haken"),
    true
  );
  assert.equal(
    isLikelyTestHomeContent(
      "Handgehaakte sjaal in naturel",
      "handgehaakte-sjaal"
    ),
    false
  );
});
