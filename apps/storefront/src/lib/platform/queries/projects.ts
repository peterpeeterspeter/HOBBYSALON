import { createPlatformClient } from "../client";
import type { Domain, Project, ProjectStep } from "@/types/platform";

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
