"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import {
  createProject,
  getProjectByIdForOwner,
  insertProjectSoughtMaterial,
  deleteProjectSoughtMaterial,
} from "@/lib/platform/queries/projects";
import { resolveUploadedOrExistingUrl, requireUploadedImageUrl } from "@/lib/storage/upload-image";

const DIFFICULTY_LEVELS = new Set(["beginner", "intermediate", "advanced"]);

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniqueProjectSlug(preferredSlug: string): Promise<string> {
  const supabase = createPlatformClient();
  const base = toSlug(preferredSlug) || `project-${Date.now()}`;

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", candidate)
      .limit(1);

    if (!data || data.length === 0) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

function parseOptionalString(formData: FormData, field: string): string | null {
  const raw = formData.get(field)?.toString().trim();
  return raw ? raw : null;
}

function parseRequiredString(formData: FormData, field: string): string {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) {
    throw new Error(`${field} is verplicht`);
  }
  return raw;
}

function parseOptionalInt(formData: FormData, field: string): number | null {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredUuid(formData: FormData, field: string): string {
  const value = parseRequiredString(formData, field);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new Error(`${field} is ongeldig.`);
  }
  return value;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function createProjectAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects/new");
    }

    const title = parseRequiredString(formData, "title");
    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueProjectSlug(preferredSlug);
    const shortDescription = parseOptionalString(formData, "short_description");
    const description = parseOptionalString(formData, "description");
    const difficultyLevel = parseOptionalString(formData, "difficulty_level") ?? "beginner";
    const estimatedDuration = parseOptionalInt(formData, "estimated_duration_minutes");
    const budgetMin = parseOptionalInt(formData, "budget_min_cents");
    const budgetMax = parseOptionalInt(formData, "budget_max_cents");
    const currencyCode = parseOptionalString(formData, "currency_code") ?? "EUR";
    const featuredImageUrl = await resolveUploadedOrExistingUrl(
      formData,
      "featured_image_file",
      null,
      `projects/${user.id}/featured`
    );

    if (!DIFFICULTY_LEVELS.has(difficultyLevel)) {
      fail("/profile/projects/new", "Ongeldige moeilijkheidsgraad.");
    }

    const project = await createProject({
      slug,
      title,
      short_description: shortDescription,
      description,
      difficulty_level: difficultyLevel,
      estimated_duration_minutes: estimatedDuration,
      budget_min_cents: budgetMin,
      budget_max_cents: budgetMax,
      currency_code: currencyCode,
      featured_image_url: featuredImageUrl,
      created_by_user_id: user.id,
    });

    if (!project) {
      fail("/profile/projects/new", "Project aanmaken mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath("/profile/projects");
    ok(
      `/profile/projects/${project.id}/edit`,
      "Project aangemaakt. Voeg nu materialen en foto's toe."
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/profile/projects/new",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateProjectAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const projectId = parseRequiredUuid(formData, "project_id");
    const project = await getProjectByIdForOwner(projectId, user.id);
    if (!project) {
      fail("/profile/projects", "Project niet gevonden of geen rechten.");
    }

    const title = parseRequiredString(formData, "title");
    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const candidateSlug = toSlug(preferredSlug) || `project-${Date.now()}`;
    const supabaseForSlug = createPlatformClient();
    const { data: slugConflict } = await supabaseForSlug
      .from("projects")
      .select("id")
      .eq("slug", candidateSlug)
      .neq("id", projectId)
      .limit(1);
    const finalSlug =
      !slugConflict || slugConflict.length === 0
        ? candidateSlug
        : await ensureUniqueProjectSlug(`${preferredSlug}-${Date.now()}`);

    const shortDescription = parseOptionalString(formData, "short_description");
    const description = parseOptionalString(formData, "description");
    const difficultyLevel = parseOptionalString(formData, "difficulty_level") ?? "beginner";
    const estimatedDuration = parseOptionalInt(formData, "estimated_duration_minutes");
    const budgetMin = parseOptionalInt(formData, "budget_min_cents");
    const budgetMax = parseOptionalInt(formData, "budget_max_cents");
    const currencyCode = parseOptionalString(formData, "currency_code") ?? "EUR";
    const featuredImageUrl = await resolveUploadedOrExistingUrl(
      formData,
      "featured_image_file",
      project.featured_image_url,
      `projects/${user.id}/${projectId}/featured`
    );

    if (!DIFFICULTY_LEVELS.has(difficultyLevel)) {
      fail(`/profile/projects/${projectId}/edit`, "Ongeldige moeilijkheidsgraad.");
    }

    const supabase = createPlatformClient();
    const { error } = await supabase
      .from("projects")
      .update({
        slug: finalSlug,
        title,
        short_description: shortDescription,
        description,
        difficulty_level: difficultyLevel,
        estimated_duration_minutes: estimatedDuration,
        budget_min_cents: budgetMin,
        budget_max_cents: budgetMax,
        currency_code: currencyCode,
        featured_image_url: featuredImageUrl,
      })
      .eq("id", projectId);

    if (error) {
      fail(`/profile/projects/${projectId}/edit`, "Project bijwerken mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${projectId}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${projectId}/edit`, "Project opgeslagen.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const projectId = formData.get("project_id")?.toString();
    fail(
      projectId ? `/profile/projects/${projectId}/edit` : "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProfileProjectProductLinkAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const projectId = parseRequiredUuid(formData, "project_id");
    const productId = parseRequiredUuid(formData, "product_id");
    const linkType = parseOptionalString(formData, "link_type") ?? "material";
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;

    const project = await getProjectByIdForOwner(projectId, user.id);
    if (!project) {
      fail("/profile/projects", "Project niet gevonden of geen rechten.");
    }

    const supabase = createPlatformClient();
    const { error } = await supabase.from("project_product_links").upsert(
      {
        project_id: projectId,
        product_id: productId,
        link_type: linkType,
        sort_order: sortOrder,
      },
      { onConflict: "project_id,product_id" }
    );

    if (error) {
      fail(
        `/profile/projects/${projectId}/edit`,
        "Product koppelen aan project mislukt."
      );
    }

    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${projectId}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${projectId}/edit`, "Materiaal gekoppeld.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const projectId = formData.get("project_id")?.toString();
    fail(
      projectId ? `/profile/projects/${projectId}/edit` : "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProfileProjectProductLinkAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const projectProductLinkId = parseRequiredUuid(formData, "project_product_link_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_product_links")
      .select("id, project_id")
      .eq("id", projectProductLinkId)
      .maybeSingle();

    if (!row?.project_id) {
      fail("/profile/projects", "Link niet gevonden.");
    }

    const project = await getProjectByIdForOwner(row.project_id, user.id);
    if (!project) {
      fail("/profile/projects", "Geen rechten op dit project.");
    }

    const { error } = await supabase
      .from("project_product_links")
      .delete()
      .eq("id", projectProductLinkId);

    if (error) {
      fail(
        `/profile/projects/${row.project_id}/edit`,
        "Verwijderen van materialink mislukt."
      );
    }

    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${row.project_id}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${row.project_id}/edit`, "Materialink verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProfileProjectSoughtMaterialAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const projectId = parseRequiredUuid(formData, "project_id");
    const title = parseRequiredString(formData, "title");
    const notes = parseOptionalString(formData, "notes");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;

    const project = await getProjectByIdForOwner(projectId, user.id);
    if (!project) {
      fail("/profile/projects", "Project niet gevonden of geen rechten.");
    }

    const material = await insertProjectSoughtMaterial(projectId, title, {
      notes,
      sort_order: sortOrder,
    });

    if (!material) {
      fail(
        `/profile/projects/${projectId}/edit`,
        "Gezocht materiaal toevoegen mislukt. Mogelijk bestaat het al."
      );
    }

    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${projectId}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${projectId}/edit`, "Materiaal gezocht toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const projectId = formData.get("project_id")?.toString();
    fail(
      projectId ? `/profile/projects/${projectId}/edit` : "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProfileProjectSoughtMaterialAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const soughtMaterialId = parseRequiredUuid(formData, "sought_material_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_sought_materials")
      .select("id, project_id")
      .eq("id", soughtMaterialId)
      .maybeSingle();

    if (!row?.project_id) {
      fail("/profile/projects", "Gezocht materiaal niet gevonden.");
    }

    const project = await getProjectByIdForOwner(row.project_id, user.id);
    if (!project) {
      fail("/profile/projects", "Geen rechten op dit project.");
    }

    const okDel = await deleteProjectSoughtMaterial(soughtMaterialId);
    if (!okDel) {
      fail(
        `/profile/projects/${row.project_id}/edit`,
        "Verwijderen mislukt."
      );
    }

    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${row.project_id}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${row.project_id}/edit`, "Gezocht materiaal verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProfileProjectGalleryImageAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const projectId = parseRequiredUuid(formData, "project_id");
    const altText = parseOptionalString(formData, "alt_text");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;

    const project = await getProjectByIdForOwner(projectId, user.id);
    if (!project) {
      fail("/profile/projects", "Project niet gevonden of geen rechten.");
    }

    const imageUrl = await requireUploadedImageUrl(
      formData,
      "image_file",
      `projects/${user.id}/${projectId}/gallery`
    );

    const supabase = createPlatformClient();
    const { error } = await supabase.from("project_gallery_images").insert({
      project_id: projectId,
      image_url: imageUrl,
      alt_text: altText,
      sort_order: sortOrder,
    });

    if (error) {
      fail(
        `/profile/projects/${projectId}/edit`,
        "Foto toevoegen mislukt."
      );
    }

    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${projectId}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${projectId}/edit`, "Foto toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const projectId = formData.get("project_id")?.toString();
    fail(
      projectId ? `/profile/projects/${projectId}/edit` : "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProfileProjectGalleryImageAction(
  formData: FormData
): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      redirect("/login?next=/profile/projects");
    }

    const galleryImageId = parseRequiredUuid(formData, "gallery_image_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_gallery_images")
      .select("id, project_id")
      .eq("id", galleryImageId)
      .maybeSingle();

    if (!row?.project_id) {
      fail("/profile/projects", "Foto niet gevonden.");
    }

    const project = await getProjectByIdForOwner(row.project_id, user.id);
    if (!project) {
      fail("/profile/projects", "Geen rechten op dit project.");
    }

    const { error } = await supabase
      .from("project_gallery_images")
      .delete()
      .eq("id", galleryImageId);

    if (error) {
      fail(
        `/profile/projects/${row.project_id}/edit`,
        "Foto verwijderen mislukt."
      );
    }

    revalidatePath("/profile/projects");
    revalidatePath(`/profile/projects/${row.project_id}/edit`);
    revalidatePath(`/project/${project.slug}`);
    ok(`/profile/projects/${row.project_id}/edit`, "Foto verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/profile/projects",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}
