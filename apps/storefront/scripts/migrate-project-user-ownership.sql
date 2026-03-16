-- Adds user-created projects support and producten gezocht:
-- 1) projects.created_by_user_id for attributing user-created projects
-- 2) project_sought_materials for materials not in the product catalog
--
-- Run: yarn migrate:project-ownership (requires DATABASE_URL in .env.local)
-- Or paste in Supabase Dashboard > SQL Editor > New query

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_projects_created_by_user
  ON public.projects(created_by_user_id);

CREATE TABLE IF NOT EXISTS public.project_sought_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, title)
);

CREATE INDEX IF NOT EXISTS idx_project_sought_materials_project_id
  ON public.project_sought_materials(project_id);
