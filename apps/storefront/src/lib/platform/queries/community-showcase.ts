import "server-only";

import { createPlatformClient } from "../client";
import type { CommunitySubmissionStatus } from "@/lib/content/community-submission-status";

export type OwnerCommunitySubmission = {
  projectId: string;
  status: CommunitySubmissionStatus;
};

export async function isModerator(userId: string): Promise<boolean> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("platform_moderators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function listOwnerCommunitySubmissionsForArticle(
  articleId: string,
  userId: string
): Promise<OwnerCommunitySubmission[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("article_project_showcase_submissions")
    .select("project_id, status")
    .eq("article_id", articleId)
    .eq("submitted_by_user_id", userId);

  if (error || !data) return [];

  return (data as Array<{ project_id: string; status: CommunitySubmissionStatus }>).map(
    (submission) => ({
      projectId: submission.project_id,
      status: submission.status,
    })
  );
}
