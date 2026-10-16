-- newsletter_issues: public archive of sent weekly newsletters
-- Apply via reviewed Supabase migration workflow. Do not run against prod from this PR alone.

begin;

create table if not exists public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subject text not null,
  theme text not null,
  published_at timestamptz,
  html text not null,
  excerpt text,
  created_at timestamptz not null default now()
);

create index if not exists idx_newsletter_issues_published_at
  on public.newsletter_issues (published_at desc nulls last);

alter table public.newsletter_issues enable row level security;

revoke all on public.newsletter_issues from public, anon, authenticated;
grant select on public.newsletter_issues to anon, authenticated;
grant all on public.newsletter_issues to service_role;

drop policy if exists newsletter_issues_public_read_published on public.newsletter_issues;
create policy newsletter_issues_public_read_published
  on public.newsletter_issues
  for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

insert into public.newsletter_issues (
  slug, title, subject, theme, published_at, html, excerpt
) values (
  'kaarten-maken-1',
  'Kaarten maken: warme herfstkaarten en workshops',
  'Hobbysalon: kaarten maken + workshops deze week',
  'kaarten',
  '2026-10-16T07:00:00+02:00',
  '<!DOCTYPE html><html lang="nl-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hobbysalon nieuwsbrief</title></head>
<body style="margin:0;padding:0;background:#f4f1ec">
<div style="display:none;max-height:0;overflow:hidden">Je wekelijkse portie creatieve inspiratie van Hobbysalon</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#9a3412;padding:24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:bold;color:#ffffff">Hobbysalon</td></tr>
<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.6;color:#222222">
<p style="margin:0 0 16px">Dag creatieveling,</p>
<p style="margin:0 0 16px">De dagen worden korter, en dat is het perfecte moment om binnen iets moois te maken. Deze week staan de kaarten centraal: de feestdagen komen eraan, en een zelfgemaakte kaart maakt altijd meer indruk dan een gekochte.</p>
<h2 style="font-size:24px;line-height:1.3;color:#111111;margin:32px 0 12px;border-top:2px solid #e5e5e5;padding-top:24px">Thema van de week: kaarten maken</h2>
<p style="margin:0 0 8px"><strong>Marmeren met scheerschuim: warme herfstkaarten maken</strong> (10 min lezen)</p>
<p style="margin:0 0 12px">Met scheerschuim en een paar druppels verf maak je in een handomdraai unieke gemarmerde kaarten. Ideaal om met de kleinkinderen te doen.</p>
<p style="margin:0 0 24px"><a href="https://www.hobbysalon.be/artikel/marmeren-met-scheerschuim-herfstkaarten-maken" style="color:#9a3412;font-weight:bold;font-size:18px;text-decoration:underline">Lees de stap-voor-stap uitleg →</a></p>
<p style="margin:0 0 24px">Ook leuk: <a href="https://www.hobbysalon.be/artikel/herfstkaart-waskrijt-aquarel-lichte-bladlijnen" style="color:#9a3412;font-weight:bold">Herfstkaart met waskrijt en aquarel: lichte bladlijnen</a></p>
<h2 style="font-size:24px;line-height:1.3;color:#111111;margin:32px 0 12px;border-top:2px solid #e5e5e5;padding-top:24px">Workshops in de buurt</h2>
<ul style="padding-left:20px;margin:0 0 16px"><li style="margin:0 0 12px"><a href="https://www.hobbysalon.be/workshop/masterclass-botanical-gelprint" style="color:#111111;font-weight:bold">za 24 okt – Masterclass Botanical Gelprint (3 × 3 uur)</a><br>Ingelmunster – €120</li><li style="margin:0 0 12px"><a href="https://www.hobbysalon.be/workshop/bisterse-botaniek" style="color:#111111;font-weight:bold">do 29 okt – Bisterse botaniek</a><br>Grobbendonk – €60</li><li style="margin:0 0 12px"><a href="https://www.hobbysalon.be/workshop/kunst-wens-kaartjes-maken" style="color:#111111;font-weight:bold">vr 30 okt – Kunst-wens-kaartjes maken</a><br>Ingelmunster – €45</li><li style="margin:0 0 12px"><a href="https://www.hobbysalon.be/workshop/kerstkaarten-handletteren-2" style="color:#111111;font-weight:bold">vr 30 okt – Kerstkaarten handletteren</a><br>Herentals – €60</li></ul>
<p style="margin:0 0 24px"><a href="https://www.hobbysalon.be/workshops" style="color:#9a3412;font-weight:bold;font-size:18px;text-decoration:underline">Alle workshops bekijken →</a></p>
<h2 style="font-size:24px;line-height:1.3;color:#111111;margin:32px 0 12px;border-top:2px solid #e5e5e5;padding-top:24px">Uit in de buurt</h2>
<ul style="padding-left:20px;margin:0 0 16px"><li style="margin:0 0 12px"><a href="https://www.hobbysalon.be/agenda/warme-wintermarkt-2" style="color:#111111;font-weight:bold">zo 13 dec – Warme Wintermarkt</a><br>Gistel – handmade markt, gratis toegang</li></ul>
<p style="margin:0 0 24px"><a href="https://www.hobbysalon.be/agenda" style="color:#9a3412;font-weight:bold;font-size:18px;text-decoration:underline">Naar de agenda →</a></p>
<h2 style="font-size:24px;line-height:1.3;color:#111111;margin:32px 0 12px;border-top:2px solid #e5e5e5;padding-top:24px">Patroon van de week</h2>
<p style="margin:0 0 8px"><strong>Piglet the Pig haken – gratis amigurumi-patroon</strong></p>
<p style="margin:0 0 12px">Een groot, knuffelbaar varkentje met worsted-garen en haaknaald 4,5 mm. Een fijn cadeautje voor een (klein)kind.</p>
<p style="margin:0 0 24px"><a href="https://www.hobbysalon.be/artikel/piglet-the-pig-haken-gratis-patroon" style="color:#9a3412;font-weight:bold;font-size:18px;text-decoration:underline">Naar het gratis patroon →</a></p>
<h2 style="font-size:24px;line-height:1.3;color:#111111;margin:32px 0 12px;border-top:2px solid #e5e5e5;padding-top:24px">Partner van de week <span style=''font-size:14px;color:#555555;font-weight:normal''>(gesponsord)</span></h2>
<p style="margin:0 0 24px;padding:16px;background:#fff7ed;border:1px dashed #9a3412;font-size:16px">[Sponsorvak – nog niet verkocht. Voorbeeld: een hobbywinkel met een wolpakket voor beginners. Weglaten als er geen sponsor is.]</p>
<h2 style="font-size:24px;line-height:1.3;color:#111111;margin:32px 0 12px;border-top:2px solid #e5e5e5;padding-top:24px">Uit de makersmarkt</h2>
<p style="margin:0 0 12px"><strong>Gebreide plaiddeken</strong> van Ingrid Peeters – €25</p>
<p style="margin:0 0 24px"><a href="https://www.hobbysalon.be/product/gebreide-deken" style="color:#9a3412;font-weight:bold;font-size:18px;text-decoration:underline">Bekijk in de makersmarkt →</a></p>
<p style="margin:32px 0 0">Veel creatief plezier deze week!<br>Het Hobbysalon-team</p>
</td></tr>
<tr><td style="padding:24px 32px;background:#eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#333333">
<p style="margin:0 0 12px">Je krijgt deze mail omdat je je hebt ingeschreven voor de nieuwsbrief van Hobbysalon.</p>
<p style="margin:0 0 12px"><a href="https://www.hobbysalon.be" style="color:#111111">hobbysalon.be</a></p>
<p style="margin:0">Hobbysalon – 11380 BV, Neerhof 16, 2200 Herentals</p>
</td></tr></table></td></tr></table></body></html>',
  'Deze week: kaarten maken, workshops in de buurt, een gratis haakpatroon en meer creatieve inspiratie.'
)
on conflict (slug) do update set
  title = excluded.title,
  subject = excluded.subject,
  theme = excluded.theme,
  published_at = excluded.published_at,
  html = excluded.html,
  excerpt = excluded.excerpt;

commit;
