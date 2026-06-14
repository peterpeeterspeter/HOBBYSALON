-- Seed commercial plans and grandfather existing creators/events
-- Run after migrate-commercial-plans.sql:
-- psql "${DATABASE_URL}" -f apps/storefront/scripts/seed-commercial-plans.sql

insert into public.commercial_plans (
  code, segment, name, price_cents, currency_code, billing_period,
  listing_limit, product_limit, external_links_allowed, featured_allowed,
  video_allowed, analytics_allowed, is_active
) values
  ('workshop_essential', 'workshop', 'Workshop Essential', 19000, 'EUR', 'yearly',
   5, null, false, false, false, false, true),
  ('workshop_premium', 'workshop', 'Workshop Premium', 69000, 'EUR', 'yearly',
   null, null, true, true, true, true, true),
  ('maker_free', 'maker', 'Maker Gratis', 0, 'EUR', 'yearly',
   null, null, false, false, false, false, true),
  ('maker_premium', 'maker', 'Maker Premium', 9900, 'EUR', 'yearly',
   null, 50, false, true, false, true, true),
  ('supplier_basic', 'supplier', 'Winkel Basis', 0, 'EUR', 'yearly',
   null, null, false, false, false, false, true),
  ('supplier_premium', 'supplier', 'Winkel Premium', 49000, 'EUR', 'yearly',
   null, null, true, true, false, true, true),
  ('organizer_event_basic', 'organizer', 'Event Basis', 4900, 'EUR', 'one_time',
   null, null, false, false, false, false, true),
  ('organizer_event_premium', 'organizer', 'Event Premium', 24900, 'EUR', 'one_time',
   null, null, true, true, false, true, true)
on conflict (code) do update set
  segment = excluded.segment,
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency_code = excluded.currency_code,
  billing_period = excluded.billing_period,
  listing_limit = excluded.listing_limit,
  product_limit = excluded.product_limit,
  external_links_allowed = excluded.external_links_allowed,
  featured_allowed = excluded.featured_allowed,
  video_allowed = excluded.video_allowed,
  analytics_allowed = excluded.analytics_allowed,
  is_active = excluded.is_active,
  updated_at = now();

-- Grandfather workshopgevers -> workshop_essential
insert into public.creator_plan_subscriptions (creator_id, plan_id, status, starts_at, ends_at)
select c.id, p.id, 'active', now(), null
from public.creators c
cross join public.commercial_plans p
where p.code = 'workshop_essential'
  and 'workshopgever' = any(c.creator_types)
  and not exists (
    select 1 from public.creator_plan_subscriptions s
    join public.commercial_plans cp on cp.id = s.plan_id
    where s.creator_id = c.id and cp.segment = 'workshop' and s.status = 'active'
  );

-- Grandfather makers -> maker_free
insert into public.creator_plan_subscriptions (creator_id, plan_id, status, starts_at, ends_at)
select c.id, p.id, 'active', now(), null
from public.creators c
cross join public.commercial_plans p
where p.code = 'maker_free'
  and 'maker' = any(c.creator_types)
  and not exists (
    select 1 from public.creator_plan_subscriptions s
    join public.commercial_plans cp on cp.id = s.plan_id
    where s.creator_id = c.id and cp.segment = 'maker' and s.status = 'active'
  );

-- Grandfather suppliers -> supplier_basic
insert into public.creator_plan_subscriptions (creator_id, plan_id, status, starts_at, ends_at)
select c.id, p.id, 'active', now(), null
from public.creators c
cross join public.commercial_plans p
where p.code = 'supplier_basic'
  and 'supplier' = any(c.creator_types)
  and not exists (
    select 1 from public.creator_plan_subscriptions s
    join public.commercial_plans cp on cp.id = s.plan_id
    where s.creator_id = c.id and cp.segment = 'supplier' and s.status = 'active'
  );

-- Grandfather organizers -> organizer_event_basic on each active event
insert into public.event_plan_subscriptions (event_id, plan_id, status, starts_at, ends_at)
select e.id, p.id, 'active', now(), null
from public.events e
cross join public.commercial_plans p
where p.code = 'organizer_event_basic'
  and e.is_active = true
  and not exists (
    select 1 from public.event_plan_subscriptions s
    where s.event_id = e.id and s.status = 'active'
  );
