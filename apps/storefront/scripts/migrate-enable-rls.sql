-- Enable RLS across public platform tables and add baseline safe policies.
-- Goal:
-- 1) Resolve Supabase lint: rls_disabled_in_public
-- 2) Keep public discovery reads available
-- 3) Keep anonymous newsletter/workshop request submissions available

do $$
declare
  t text;
  all_tables text[] := array[
    'domains',
    'creators',
    'creator_domains',
    'product_categories',
    'products',
    'entity_links',
    'product_images',
    'product_attributes',
    'workshops',
    'workshop_sessions',
    'workshop_required_products',
    'events',
    'event_domains',
    'event_creators',
    'event_workshops',
    'articles',
    'article_domains',
    'favorites',
    'reviews',
    'subscribers',
    'survey_segments',
    'workshop_booking_requests',
    'user_preferences',
    'user_account_roles',
    'user_seller_links',
    'projects',
    'project_domains',
    'project_steps',
    'project_gallery_images',
    'project_product_links',
    'project_sought_materials'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table if exists public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare
  t text;
  public_read_tables text[] := array[
    'domains',
    'creators',
    'creator_domains',
    'product_categories',
    'products',
    'entity_links',
    'product_images',
    'product_attributes',
    'workshops',
    'workshop_sessions',
    'workshop_required_products',
    'events',
    'event_domains',
    'event_creators',
    'event_workshops',
    'articles',
    'article_domains',
    'projects',
    'project_domains',
    'project_steps',
    'project_gallery_images',
    'project_product_links',
    'project_sought_materials'
  ];
begin
  foreach t in array public_read_tables loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) then
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = t
          and policyname = 'public_read'
      ) then
        execute format(
          'create policy public_read on public.%I for select to anon, authenticated using (true)',
          t
        );
      end if;
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'subscribers'
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscribers' and policyname = 'anon_insert'
  ) then
    create policy anon_insert
      on public.subscribers
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workshop_booking_requests'
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workshop_booking_requests' and policyname = 'anon_insert'
  ) then
    create policy anon_insert
      on public.workshop_booking_requests
      for insert
      to anon, authenticated
      with check (true);
  end if;
end $$;
