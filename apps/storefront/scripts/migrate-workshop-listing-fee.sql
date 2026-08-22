-- Workshop launch listing fee columns + backfill of up to 3 free slots per creator.
-- Apply through the established reviewed Supabase SQL workflow only.

alter table public.workshops
  add column if not exists listing_fee_status text not null default 'unpaid';

alter table public.workshops
  add column if not exists listing_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workshops_listing_fee_status_check'
  ) then
    alter table public.workshops
      add constraint workshops_listing_fee_status_check
      check (listing_fee_status in ('launch_free', 'paid', 'unpaid'));
  end if;
end $$;

comment on column public.workshops.listing_fee_status is
  'launch_free = gratis lanceringsslot (blijft gratis); paid = €9,99 / 2 maanden; unpaid = concept of wacht op betaling';

comment on column public.workshops.listing_expires_at is
  'Einde zichtbaarheid voor paid listings; null voor launch_free (geen verval).';

-- Backfill: per creator, oldest active workshops first, max 3 → launch_free.
with ranked as (
  select
    w.id,
    row_number() over (
      partition by w.creator_id
      order by w.created_at asc, w.id asc
    ) as rn
  from public.workshops w
  join public.creators c on c.id = w.creator_id
  where w.is_active = true
    and 'workshopgever' = any (c.creator_types)
    and w.listing_fee_status = 'unpaid'
)
update public.workshops w
set
  listing_fee_status = 'launch_free',
  listing_expires_at = null,
  updated_at = now()
from ranked r
where w.id = r.id
  and r.rn <= 3;
