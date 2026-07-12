import { createPlatformClient } from "../client";
import { listProductsByIds } from "./products";
import type {
  Domain,
  Product,
  Project,
  ProjectGalleryImage,
  ProjectProductLink,
  ProjectSoughtMaterial,
  ProjectStep,
} from "@/types/platform";
import {
  groupCommunityGalleryImages,
  type CommunityGalleryProject,
} from "@/lib/content/community-gallery";

export async function listApprovedCommunityGalleryForArticle(
  articleId: string
): Promise<CommunityGalleryProject[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("article_project_showcase_submissions")
    .select("project_id, projects!inner(title, slug, project_gallery_images(id, image_url, alt_text))")
    .eq("article_id", articleId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(12);

  if (error || !data) return [];

  const rows = (data as unknown as Array<{
    project_id: string;
    projects: Array<{
      title: string;
      slug: string;
      project_gallery_images: Array<{ id: string; image_url: string; alt_text: string | null }>;
    }>;
  }>).flatMap((submission) =>
    submission.projects.flatMap((project) =>
      project.project_gallery_images.map((image) => ({
        projectId: submission.project_id,
        projectTitle: project.title,
        projectSlug: project.slug,
        imageId: image.id,
        imageUrl: image.image_url,
        altText: image.alt_text,
      }))
    )
  );

  return groupCommunityGalleryImages(rows);
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Project;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Project;
}

export async function getProjectByIdForOwner(
  id: string,
  userId: string
): Promise<Project | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("created_by_user_id", userId)
    .single();

  if (error || !data) return null;
  return data as Project;
}

export async function listFeaturedProjects(limit = 6): Promise<Project[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Project[];
}

export async function listProjectsByIds(ids: string[]): Promise<Project[]> {
  if (!ids.length) return [];

  const uniqueIds = [...new Set(ids)];
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_active", true);

  if (error || !data) return [];

  const byId = new Map((data as Project[]).map((project) => [project.id, project]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((project): project is Project => !!project);
}

export async function listProjectsByDomain(domainId: string): Promise<Project[]> {
  const supabase = createPlatformClient();
  const { data: links, error: linksError } = await supabase
    .from("project_domains")
    .select("project_id")
    .eq("domain_id", domainId);

  if (linksError || !links?.length) return [];

  const projectIds = [...new Set((links ?? []).map((link) => link.project_id))];
  return listProjectsByIds(projectIds);
}

export async function listDomainsByProject(projectId: string): Promise<Domain[]> {
  const supabase = createPlatformClient();
  const { data: linkRows, error: linkError } = await supabase
    .from("project_domains")
    .select("domain_id, is_primary")
    .eq("project_id", projectId)
    .order("is_primary", { ascending: false });

  if (linkError || !linkRows?.length) return [];

  const orderedDomainIds = (linkRows ?? []).map((row) => row.domain_id);
  const uniqueDomainIds = [...new Set(orderedDomainIds)];

  const { data: domainRows, error: domainError } = await supabase
    .from("domains")
    .select("*")
    .in("id", uniqueDomainIds)
    .eq("is_active", true);

  if (domainError || !domainRows) return [];

  const byId = new Map((domainRows as Domain[]).map((domain) => [domain.id, domain]));
  return orderedDomainIds
    .map((id) => byId.get(id))
    .filter((domain): domain is Domain => !!domain);
}

export async function listProjectSteps(projectId: string): Promise<ProjectStep[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_steps")
    .select("*")
    .eq("project_id", projectId)
    .order("step_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as ProjectStep[];
}

export async function listProjectsByCreator(creatorId: string): Promise<Project[]> {
  const supabase = createPlatformClient();
  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("user_id")
    .eq("id", creatorId)
    .single();

  if (creatorError || !creator?.user_id) return [];

  return listProjectsByUserId(creator.user_id as string);
}

export async function listProjectGalleryImages(
  projectId: string
): Promise<ProjectGalleryImage[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_gallery_images")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as ProjectGalleryImage[];
}

export async function listProjectProductLinks(
  projectId: string
): Promise<ProjectProductLink[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_product_links")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as ProjectProductLink[];
}

export async function listLinkedProductsByProject(projectId: string): Promise<Product[]> {
  const links = await listProjectProductLinks(projectId);
  const productIds = links.map((link) => link.product_id);
  return listProductsByIds(productIds);
}

export async function listProjectsByUserId(userId: string): Promise<Project[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("created_by_user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Project[];
}

export type CreateProjectInput = {
  slug: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  difficulty_level?: string;
  estimated_duration_minutes?: number | null;
  budget_min_cents?: number | null;
  budget_max_cents?: number | null;
  currency_code?: string;
  featured_image_url?: string | null;
  created_by_user_id: string;
};

export async function createProject(input: CreateProjectInput): Promise<Project | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      slug: input.slug,
      title: input.title,
      short_description: input.short_description ?? null,
      description: input.description ?? null,
      difficulty_level: input.difficulty_level ?? "beginner",
      estimated_duration_minutes: input.estimated_duration_minutes ?? null,
      budget_min_cents: input.budget_min_cents ?? null,
      budget_max_cents: input.budget_max_cents ?? null,
      currency_code: input.currency_code ?? "EUR",
      featured_image_url: input.featured_image_url ?? null,
      created_by_user_id: input.created_by_user_id,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data as Project;
}

export async function updateProject(
  projectId: string,
  updates: Partial<{
    slug: string;
    title: string;
    short_description: string | null;
    description: string | null;
    difficulty_level: string;
    estimated_duration_minutes: number | null;
    budget_min_cents: number | null;
    budget_max_cents: number | null;
    currency_code: string;
    featured_image_url: string | null;
  }>
): Promise<Project | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error || !data) return null;
  return data as Project;
}

export async function listProjectSoughtMaterials(
  projectId: string
): Promise<ProjectSoughtMaterial[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_sought_materials")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as ProjectSoughtMaterial[];
}

export async function insertProjectSoughtMaterial(
  projectId: string,
  title: string,
  options?: { notes?: string | null; sort_order?: number }
): Promise<ProjectSoughtMaterial | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_sought_materials")
    .insert({
      project_id: projectId,
      title: title.trim(),
      notes: options?.notes ?? null,
      sort_order: options?.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) return null;
  return data as ProjectSoughtMaterial;
}

export async function deleteProjectSoughtMaterial(id: string): Promise<boolean> {
  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("project_sought_materials")
    .delete()
    .eq("id", id);

  return !error;
}

export async function listAllSoughtMaterials(): Promise<ProjectSoughtMaterial[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("project_sought_materials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ProjectSoughtMaterial[];
}

export type SoughtMaterialWithProject = ProjectSoughtMaterial & {
  project_title: string | null;
  project_slug: string | null;
};

export async function listAllSoughtMaterialsWithProjects(): Promise<
  SoughtMaterialWithProject[]
> {
  const materials = await listAllSoughtMaterials();
  if (materials.length === 0) return [];

  const projectIds = [...new Set(materials.map((m) => m.project_id))];
  const projects = await listProjectsByIds(projectIds);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return materials.map((m) => ({
    ...m,
    project_title: projectById.get(m.project_id)?.title ?? null,
    project_slug: projectById.get(m.project_id)?.slug ?? null,
  }));
}
