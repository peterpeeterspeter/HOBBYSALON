-- Role-driven onboarding: persist offer intent + marketing consent on user_preferences
-- Run via Supabase SQL editor or:
-- psql "${DATABASE_URL}" -f apps/storefront/scripts/migrate-onboarding-intent-consent.sql

alter table public.user_preferences
  add column if not exists offer_roles text[] not null default '{}',
  add column if not exists primary_offer_role text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opted_in_at timestamptz,
  add column if not exists marketing_opted_out_at timestamptz,
  add column if not exists marketing_consent_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_offer_roles_check'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_offer_roles_check check (
        offer_roles <@ array['workshopgever','maker','organizer','merchant']::text[]
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_primary_offer_role_check'
  ) then
    alter table public.user_preferences
      add constraint user_preferences_primary_offer_role_check check (
        primary_offer_role is null
        or primary_offer_role in ('workshopgever','maker','organizer','merchant')
      );
  end if;
end $$;

create index if not exists idx_user_preferences_primary_offer_role
  on public.user_preferences(primary_offer_role)
  where primary_offer_role is not null;
