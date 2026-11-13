-- Consent-segmented pageview counter.
--
-- GA4 cannot report this: the reporting API exposes no consent dimension, and
-- denied visitors are by definition invisible to Google. Every report that only
-- reads GA4 therefore overstates nothing but silently undercounts traffic.
--
-- This table deliberately holds no personal data. No IP, no user agent, no
-- client id, no session id, no raw slug. Only a day, a route template, a host,
-- a consent bucket and a count. Nothing here can be traced to a visitor.

create table if not exists public.analytics_pageview_daily (
  day date not null,
  host text not null check (host in ('www.hobbysalon.be', 'hobbysalon.nl')),
  route text not null,
  consent text not null check (consent in ('granted', 'denied')),
  views bigint not null default 0 check (views >= 0),
  primary key (day, host, route, consent)
);

comment on table public.analytics_pageview_daily is
  'Aggregated pageviews split by consent. Anonymous totals only; no visitor identifiers.';

-- Reporting reads whole days, sometimes one host, sometimes one route.
create index if not exists analytics_pageview_daily_day_idx
  on public.analytics_pageview_daily (day desc);

create index if not exists analytics_pageview_daily_host_day_idx
  on public.analytics_pageview_daily (host, day desc);

-- Only the service role writes and reads. No anon or authenticated access: the
-- table is a reporting source, not application data.
alter table public.analytics_pageview_daily enable row level security;

-- These roles exist on Supabase but not on a bare Postgres, so guard them.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.analytics_pageview_daily from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.analytics_pageview_daily from authenticated;
  end if;
  -- Reporting and the counter both run as the service role.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.analytics_pageview_daily to service_role;
  end if;
end $$;

-- Atomic upsert-and-increment so concurrent requests cannot lose a count.
create or replace function public.increment_pageview(
  p_day date,
  p_host text,
  p_route text,
  p_consent text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.analytics_pageview_daily (day, host, route, consent, views)
  values (p_day, p_host, p_route, p_consent, 1)
  on conflict (day, host, route, consent)
  do update set views = public.analytics_pageview_daily.views + 1;
$$;

revoke all on function public.increment_pageview(date, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.increment_pageview(date, text, text, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.increment_pageview(date, text, text, text) from authenticated;
  end if;
  -- The storefront reaches this with the service role key, never as a user.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.increment_pageview(date, text, text, text) to service_role;
  end if;
end $$;
