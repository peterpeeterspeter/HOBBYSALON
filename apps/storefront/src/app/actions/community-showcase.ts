"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getProjectByIdForOwner } from "@/lib/platform/queries/projects";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import { createPlatformClient } from "@/lib/platform/client";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CommunitySubmissionActionState = {
  message: string | null;
  error: string | null;
};

function requiredUuid(formData: FormData, field: string): string {
  const value = formData.get(field)?.toString().trim() ?? "";
  if (!UUID_PATTERN.test(value)) throw new Error("Ongeldige inzending.");
  return value;
}

function actionError(error: unknown): CommunitySubmissionActionState {
  return {
    message: null,
    error: error instanceof Error ? error.message : "Er ging iets mis. Probeer later opnieuw.",
  };
}

async function requireCommunityModerator(): Promise<string> {
  const user = await getAuthUser();
  if (!user) throw new Error("Log in om te modereren.");
  if (!(await isModerator(user.id))) throw new Error("Je hebt geen moderatierechten.");
  return user.id;
}

export async function submitArticleCommunityProjectAction(
  _previousState: CommunitySubmissionActionState,
  formData: FormData
): Promise<CommunitySubmissionActionState> {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Log in om je project in te dienen.");

    const articleId = requiredUuid(formData, "article_id");
    const projectId = requiredUuid(formData, "project_id");
    const project = await getProjectByIdForOwner(projectId, user.id);
    if (!project) throw new Error("Je kunt alleen je eigen project indienen.");

    const supabase = createPlatformClient();
    const { data: existing, error: existingError } = await supabase
      .from("article_project_showcase_submissions")
      .select("status")
      .eq("article_id", articleId)
      .eq("project_id", projectId)
      .eq("submitted_by_user_id", user.id)
      .maybeSingle();
    if (existingError) throw new Error("Indienen mislukt. Probeer later opnieuw.");
    if (existing?.status === "pending" || existing?.status === "approved") {
      throw new Error("Dit project is al ingediend voor dit artikel.");
    }

    const { error } = await supabase.from("article_project_showcase_submissions").upsert(
      {
        article_id: articleId,
        project_id: projectId,
        submitted_by_user_id: user.id,
        status: "pending",
        consent_text_version: "community-showcase-v1",
        consented_at: new Date().toISOString(),
      },
      { onConflict: "article_id,project_id" }
    );
    if (error) throw new Error("Indienen mislukt. Probeer later opnieuw.");

    revalidatePath("/artikel", "layout");
    revalidatePath(`/project/${project.slug}`);
    return { message: "Je project is ingediend en wacht op beoordeling.", error: null };
  } catch (error) {
    return actionError(error);
  }
}

export async function withdrawArticleCommunityProjectAction(
  _previousState: CommunitySubmissionActionState,
  formData: FormData
): Promise<CommunitySubmissionActionState> {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Log in om je inzending in te trekken.");

    const articleId = requiredUuid(formData, "article_id");
    const projectId = requiredUuid(formData, "project_id");
    const project = await getProjectByIdForOwner(projectId, user.id);
    if (!project) throw new Error("Je kunt alleen je eigen inzending intrekken.");

    const supabase = createPlatformClient();
    const { data, error } = await supabase
      .from("article_project_showcase_submissions")
      .update({ status: "withdrawn" })
      .eq("article_id", articleId)
      .eq("project_id", projectId)
      .eq("submitted_by_user_id", user.id)
      .in("status", ["pending", "approved"])
      .select("id");
    if (error) throw new Error("Intrekken mislukt. Probeer later opnieuw.");
    if (!data?.length) throw new Error("Deze inzending kan niet worden ingetrokken.");

    revalidatePath("/artikel", "layout");
    revalidatePath(`/project/${project.slug}`);
    return { message: "Je inzending is ingetrokken.", error: null };
  } catch (error) {
    return actionError(error);
  }
}

export async function moderateArticleCommunityProjectAction(formData: FormData): Promise<void> {
  const moderatorId = await requireCommunityModerator();
  const submissionId = requiredUuid(formData, "submission_id");
  const status = formData.get("status")?.toString();
  if (status !== "approved" && status !== "rejected") {
    throw new Error("Ongeldige moderatiestatus.");
  }
  const note = formData.get("moderation_note")?.toString().trim() || null;
  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("article_project_showcase_submissions")
    .update({
      status,
      moderation_note: note,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by_user_id: moderatorId,
    })
    .eq("id", submissionId)
    .eq("status", "pending");
  if (error) throw new Error("Modereren mislukt. Probeer later opnieuw.");
  revalidatePath("/dashboard/moderatie/community");
  revalidatePath("/artikel", "layout");
}
