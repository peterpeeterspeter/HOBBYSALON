-- Launch cleanup: take 18 demo supply products + 2 test products offline.
-- Reversible: sets is_active=false only; nothing is deleted.
-- Snapshot of previous state is stored in launch_offline_backup_20261004.
--
-- Review, then run in Supabase SQL editor (project hobbysalon / urjpkzbjjqgwztcsnzys).
-- Rollback at the bottom.

begin;

create table if not exists public.launch_offline_backup_20261004 as
select id, slug, is_active, status, updated_at, now() as backed_up_at
from public.products
where false;

with targets(id) as (
  values
    -- 18 demo supply products (seed IDs, no Medusa link → "nog niet beschikbaar")
    ('44444444-4444-4444-4444-44444444441f'::uuid), -- breipatroon-vest
    ('44444444-4444-4444-4444-44444444441b'::uuid), -- decoratie-set-retro
    ('44444444-4444-4444-4444-44444444440c'::uuid), -- diy-starterset
    ('44444444-4444-4444-4444-444444444421'::uuid), -- draaischijf-cursus
    ('44444444-4444-4444-4444-444444444416'::uuid), -- haak-deken-patroon
    ('44444444-4444-4444-4444-444444444412'::uuid), -- haakpatroon-vogel
    ('44444444-4444-4444-4444-44444444441d'::uuid), -- houtbewerking-set
    ('44444444-4444-4444-4444-444444444415'::uuid), -- klei-starterset
    ('44444444-4444-4444-4444-44444444441a'::uuid), -- kralenpakket-edelstenen
    ('44444444-4444-4444-4444-444444444411'::uuid), -- naaimachine-accessoires
    ('44444444-4444-4444-4444-444444444419'::uuid), -- naaipatronen-set
    ('44444444-4444-4444-4444-444444444423'::uuid), -- patchwork-kit
    ('44444444-4444-4444-4444-444444444410'::uuid), -- scrapbook-set
    ('44444444-4444-4444-4444-444444444426'::uuid), -- stempel-set-letters
    ('44444444-4444-4444-4444-444444444408'::uuid), -- stoffenbundel-basics
    ('44444444-4444-4444-4444-444444444425'::uuid), -- verf-set-acryl
    ('44444444-4444-4444-4444-444444444428'::uuid), -- wol-alpaca-natur
    ('44444444-4444-4444-4444-444444444413'::uuid), -- wolpakket-merino
    -- 2 test products (buyable in cart today)
    ('ce64a31f-fc9b-43cd-8604-f700254b3873'::uuid), -- testproduct (Peter Peeters)
    ('f6a6f284-e710-4211-a5f4-6c9298b98315'::uuid)  -- card (HobbyPop, €0,10)
),
backup as (
  insert into public.launch_offline_backup_20261004 (id, slug, is_active, status, updated_at, backed_up_at)
  select p.id, p.slug, p.is_active, p.status, p.updated_at, now()
  from public.products p join targets t on t.id = p.id
  where p.is_active
  returning id
)
update public.products p
set is_active = false, updated_at = now()
from backup b
where p.id = b.id;

-- Expect exactly 20 rows; abort otherwise.
do $$
declare n int;
begin
  select count(*) into n from public.launch_offline_backup_20261004;
  if n <> 20 then
    raise exception 'Expected 20 products backed up, got %. Rolling back.', n;
  end if;
end $$;

commit;

-- Verify:
-- select slug, is_active from public.products p
--   join public.launch_offline_backup_20261004 b using (id) order by slug;

-- ROLLBACK (restore previous is_active):
-- update public.products p set is_active = b.is_active, updated_at = now()
--   from public.launch_offline_backup_20261004 b where p.id = b.id;
