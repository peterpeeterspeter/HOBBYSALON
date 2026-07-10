-- Allow authenticated users to create and maintain their own creator profile.
-- Public discovery remains read-only through the existing public_read policies.

alter table public.creators enable row level security;
alter table public.creator_domains enable row level security;
alter table public.user_account_roles enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists creator_owner_insert on public.creators;
create policy creator_owner_insert
  on public.creators
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists creator_owner_update on public.creators;
create policy creator_owner_update
  on public.creators
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists creator_domain_owner_insert on public.creator_domains;
create policy creator_domain_owner_insert
  on public.creator_domains
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.creators
      where creators.id = creator_domains.creator_id
        and creators.user_id = auth.uid()
    )
  );

drop policy if exists creator_domain_owner_delete on public.creator_domains;
create policy creator_domain_owner_delete
  on public.creator_domains
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.creators
      where creators.id = creator_domains.creator_id
        and creators.user_id = auth.uid()
    )
  );

drop policy if exists account_role_owner_insert on public.user_account_roles;
create policy account_role_owner_insert
  on public.user_account_roles
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role in ('user', 'creator', 'merchant', 'workshop_host', 'organizer')
  );

drop policy if exists account_role_owner_select on public.user_account_roles;
create policy account_role_owner_select
  on public.user_account_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists account_role_owner_update on public.user_account_roles;
create policy account_role_owner_update
  on public.user_account_roles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and role in ('user', 'creator', 'merchant', 'workshop_host', 'organizer')
  );

drop policy if exists user_preferences_owner_select on public.user_preferences;
create policy user_preferences_owner_select
  on public.user_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_preferences_owner_insert on public.user_preferences;
create policy user_preferences_owner_insert
  on public.user_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_preferences_owner_update on public.user_preferences;
create policy user_preferences_owner_update
  on public.user_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
