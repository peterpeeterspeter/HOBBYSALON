-- Post-migration verification for tutorial learning, lead-magnet and community-showcase schema.
-- Read-only: safe to execute repeatedly in the Supabase SQL Editor.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'newsletter_lead_magnets',
    'newsletter_opt_in_events',
    'article_project_showcase_submissions'
  )
order by table_name;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'articles'
  and column_name = 'difficulty_level';

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'newsletter_lead_magnets',
    'newsletter_opt_in_events',
    'article_project_showcase_submissions',
    'project_gallery_images',
    'projects'
  )
order by tablename, policyname;
