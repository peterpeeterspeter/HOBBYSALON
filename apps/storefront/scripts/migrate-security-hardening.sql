-- Security hardening follow-up:
-- 1) Fix mutable search_path warning on public.set_updated_at
-- 2) Tighten anon insert policies (remove WITH CHECK true)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'subscribers'
  ) then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'subscribers'
        and policyname = 'anon_insert'
    ) then
      drop policy anon_insert on public.subscribers;
    end if;

    create policy anon_insert
      on public.subscribers
      for insert
      to anon, authenticated
      with check (
        email is not null
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        and status = 'active'
        and source in ('site_form', 'legacy_import')
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workshop_booking_requests'
  ) then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'workshop_booking_requests'
        and policyname = 'anon_insert'
    ) then
      drop policy anon_insert on public.workshop_booking_requests;
    end if;

    create policy anon_insert
      on public.workshop_booking_requests
      for insert
      to anon, authenticated
      with check (
        workshop_id is not null
        and creator_id is not null
        and full_name is not null
        and char_length(trim(full_name)) between 2 and 120
        and email is not null
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        and status = 'new'
      );
  end if;
end $$;
