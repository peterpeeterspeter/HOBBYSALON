/**
 * Seed events and related data via Supabase Data API.
 * Run: npx tsx scripts/seed-events.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config(); // also load .env

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function main() {
  const in30 = addDays(30);
  const in30End = addDays(30);
  const d = new Date(in30End);
  d.setHours(d.getHours() + 8);
  const in30EndStr = d.toISOString();

  const in45 = addDays(45);
  const in46 = addDays(46);

  console.warn("Seeding events...");

  const { error: e1 } = await supabase.from("events").upsert(
    [
      {
        id: "e7777777-7777-7777-7777-777777777701",
        slug: "handmade-markt-antwerpen",
        title: "Handmade Markt Antwerpen",
        short_description:
          "Maandelijkse markt met makers van handgemaakte producten.",
        event_type: "handmade_market",
        organizer_creator_id: "c2222222-2222-2222-2222-222222222203",
        starts_at: in30,
        ends_at: in30EndStr,
        location_name: "De Studio",
        address_line_1: "Maarschalk Gérardstraat 4",
        city: "Antwerpen",
        postal_code: "2000",
        country_code: "BE",
        ticketing_mode: "none",
        ticket_url: null,
        ticket_price_cents: null,
        currency_code: "EUR",
        is_featured: true,
        is_active: true,
        seo_title: "Handmade Markt Antwerpen | Hobbysalon",
        seo_description:
          "Bezoek de Handmade Markt Antwerpen met unieke handgemaakte producten.",
      },
      {
        id: "e7777777-7777-7777-7777-777777777702",
        slug: "hobbybeurs-mechelen",
        title: "Hobbybeurs Mechelen",
        short_description: "Grote hobbybeurs met stands, workshops en demonstraties.",
        event_type: "hobby_fair",
        organizer_creator_id: "c2222222-2222-2222-2222-222222222201",
        starts_at: in45,
        ends_at: in46,
        location_name: "Nekkerspoel",
        address_line_1: "Nekkerspoel 1",
        city: "Mechelen",
        postal_code: "2800",
        country_code: "BE",
        ticketing_mode: "external_link",
        ticket_url: "https://example.com/tickets",
        ticket_price_cents: 1500,
        currency_code: "EUR",
        is_featured: true,
        is_active: true,
        seo_title: "Hobbybeurs Mechelen | Hobbysalon",
        seo_description: "Ontdek de grootste hobbybeurs van de regio.",
      },
    ],
    { onConflict: "id" }
  );
  if (e1) {
    console.error("Events:", e1.message);
    process.exit(1);
  }
  console.warn("  Events OK");

  const { error: e2 } = await supabase.from("event_domains").upsert(
    [
      { event_id: "e7777777-7777-7777-7777-777777777701", domain_id: "d1111111-1111-1111-1111-111111111101" },
      { event_id: "e7777777-7777-7777-7777-777777777701", domain_id: "d1111111-1111-1111-1111-111111111107" },
      { event_id: "e7777777-7777-7777-7777-777777777702", domain_id: "d1111111-1111-1111-1111-111111111101" },
      { event_id: "e7777777-7777-7777-7777-777777777702", domain_id: "d1111111-1111-1111-1111-111111111103" },
    ],
    { onConflict: "event_id,domain_id" }
  );
  if (e2) {
    console.error("Event domains:", e2.message);
  } else {
    console.warn("  Event domains OK");
  }

  const { error: e3 } = await supabase.from("event_creators").upsert(
    [
      { event_id: "e7777777-7777-7777-7777-777777777701", creator_id: "c2222222-2222-2222-2222-222222222201", role: "vendor" },
      { event_id: "e7777777-7777-7777-7777-777777777701", creator_id: "c2222222-2222-2222-2222-222222222203", role: "vendor" },
      { event_id: "e7777777-7777-7777-7777-777777777702", creator_id: "c2222222-2222-2222-2222-222222222201", role: "workshop_host" },
      { event_id: "e7777777-7777-7777-7777-777777777702", creator_id: "c2222222-2222-2222-2222-222222222202", role: "vendor" },
    ],
    { onConflict: "event_id,creator_id,role" }
  );
  if (e3) {
    console.error("Event creators:", e3.message);
  } else {
    console.warn("  Event creators OK");
  }

  const { error: e4 } = await supabase.from("event_workshops").upsert(
    [
      { event_id: "e7777777-7777-7777-7777-777777777702", workshop_id: "55555555-5555-5555-5555-555555555501" },
      { event_id: "e7777777-7777-7777-7777-777777777702", workshop_id: "55555555-5555-5555-5555-555555555503" },
    ],
    { onConflict: "event_id,workshop_id" }
  );
  if (e4) {
    console.error("Event workshops:", e4.message);
  } else {
    console.warn("  Event workshops OK");
  }

  const entityLinks = [
    { source_entity_type: "event", source_entity_id: "e7777777-7777-7777-7777-777777777701", target_entity_type: "product", target_entity_id: "44444444-4444-4444-4444-444444444401", relation_type: "features", sort_order: 1 },
    { source_entity_type: "event", source_entity_id: "e7777777-7777-7777-7777-777777777701", target_entity_type: "product", target_entity_id: "44444444-4444-4444-4444-444444444405", relation_type: "features", sort_order: 2 },
    { source_entity_type: "event", source_entity_id: "e7777777-7777-7777-7777-777777777702", target_entity_type: "product", target_entity_id: "44444444-4444-4444-4444-444444444402", relation_type: "features", sort_order: 1 },
  ];
  for (const link of entityLinks) {
    const { error: el } = await supabase.from("entity_links").insert(link);
    if (el && el.code !== "23505") {
      console.error("Entity link:", el.message);
    }
  }
  console.warn("  Entity links OK (duplicates ignored)");

  console.warn("Done.");
}

main();
