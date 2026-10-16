"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import {
  approveRoleRequest,
  rejectRoleRequest,
} from "@/lib/platform/queries/role-requests";

async function requireRoleModerator(): Promise<string> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/beheer/rollen");
  }
  if (!(await isModerator(user.id))) {
    redirect("/dashboard");
  }
  return user.id;
}

export async function moderateRoleRequestAction(formData: FormData): Promise<void> {
  const moderatorId = await requireRoleModerator();
  const requestId = formData.get("request_id")?.toString().trim() ?? "";
  const status = formData.get("status")?.toString();
  const note = formData.get("reviewer_note")?.toString().trim() || null;

  if (!requestId) {
    redirect("/beheer/rollen?error=Aanvraag%20niet%20gevonden.");
  }

  const result =
    status === "approved"
      ? await approveRoleRequest(requestId, moderatorId, note)
      : status === "rejected"
        ? await rejectRoleRequest(requestId, moderatorId, note)
        : { ok: false, message: "Ongeldige moderatiestatus." };

  revalidatePath("/beheer/rollen");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard");

  if (!result.ok) {
    redirect(
      `/beheer/rollen?error=${encodeURIComponent(result.message)}`
    );
  }

  redirect(
    `/beheer/rollen?success=${encodeURIComponent(result.message)}`
  );
}
