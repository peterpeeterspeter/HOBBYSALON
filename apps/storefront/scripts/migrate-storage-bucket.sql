-- Public media bucket for profile photos, project images, etc.
-- Run once against the platform Supabase project.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read access for media" on storage.objects;
create policy "Public read access for media"
on storage.objects for select
to public
using (bucket_id = 'media');

drop policy if exists "Authenticated users can upload media" on storage.objects;
create policy "Authenticated users can upload media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] in ('creators', 'projects', 'users')
);

drop policy if exists "Authenticated users can update own media" on storage.objects;
create policy "Authenticated users can update own media"
on storage.objects for update
to authenticated
using (bucket_id = 'media')
with check (bucket_id = 'media');
