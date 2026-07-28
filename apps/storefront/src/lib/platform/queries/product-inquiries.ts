import "server-only";

import { createPlatformClient } from "@/lib/platform/client";

export async function countNewProductInquiries(
  creatorId: string
): Promise<number> {
  const supabase = createPlatformClient();
  const { count, error } = await supabase
    .from("product_inquiries")
    .select("id", { head: true, count: "exact" })
    .eq("creator_id", creatorId)
    .eq("status", "new");

  if (error) {
    console.error("Failed to count product inquiries", {
      creatorId,
      message: error.message,
    });
    return 0;
  }

  return count ?? 0;
}

/** Resolve the best email to notify a creator (profile email, then auth email). */
export async function resolveCreatorNotifyEmail(input: {
  creatorId: string;
  userId?: string | null;
  profileEmail?: string | null;
}): Promise<string | null> {
  const profile = input.profileEmail?.trim();
  if (profile) return profile;

  const supabase = createPlatformClient();
  let userId = input.userId ?? null;

  if (!userId) {
    const { data } = await supabase
      .from("creators")
      .select("user_id, email")
      .eq("id", input.creatorId)
      .maybeSingle();
    const rowEmail = (data as { email?: string | null } | null)?.email?.trim();
    if (rowEmail) return rowEmail;
    userId = (data as { user_id?: string | null } | null)?.user_id ?? null;
  }

  if (!userId) return null;

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  return authUser.user?.email?.trim() ?? null;
}
