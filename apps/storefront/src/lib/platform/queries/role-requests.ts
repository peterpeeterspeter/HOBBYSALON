import "server-only";

import { createPlatformClient } from "../client";
import {
  ensureUserRole,
  linkUserToSeller,
  removeUserRoles,
  type UserAccountRole,
} from "./user-registration";
import {
  formatMerchantProvisionError,
  provisionMerchantSeller,
} from "@/lib/commerce/medusa/merchant-registration";
import { sendRoleRequestAdminEmail } from "@/lib/platform/notifications/role-request-email";

export type PrivilegedRole = Extract<
  UserAccountRole,
  "merchant" | "workshop_host" | "organizer"
>;

export type RoleRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type RoleRequestPayload = {
  displayName?: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  creatorType?: string;
  source?: string;
};

export type RoleRequestRow = {
  id: string;
  user_id: string;
  role: PrivilegedRole;
  status: RoleRequestStatus;
  payload: RoleRequestPayload;
  reviewer_user_id: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type PendingRoleRequestSummary = {
  id: string;
  role: PrivilegedRole;
  status: RoleRequestStatus;
  createdAt: string;
};

const PRIVILEGED_ROLES = new Set<PrivilegedRole>([
  "merchant",
  "workshop_host",
  "organizer",
]);

export function isPrivilegedRole(role: string): role is PrivilegedRole {
  return PRIVILEGED_ROLES.has(role as PrivilegedRole);
}

export { creatorTypeToPrivilegedRole } from "@/lib/auth/role-request-status";

export async function createRoleRequest(
  userId: string,
  role: PrivilegedRole,
  payload: RoleRequestPayload = {}
): Promise<{ ok: boolean; requestId: string | null; created: boolean; errors: string[] }> {
  const supabase = createPlatformClient();

  const { data: existingPending, error: existingError } = await supabase
    .from("role_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) {
    return { ok: false, requestId: null, created: false, errors: [existingError.message] };
  }

  if (existingPending?.id) {
    return { ok: true, requestId: existingPending.id, created: false, errors: [] };
  }

  const { data: alreadyHasRole } = await supabase
    .from("user_account_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (alreadyHasRole?.id) {
    return { ok: true, requestId: null, created: false, errors: [] };
  }

  const { data, error } = await supabase
    .from("role_requests")
    .insert({
      user_id: userId,
      role,
      status: "pending",
      payload,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      requestId: null,
      created: false,
      errors: [error?.message ?? "Aanvraag kon niet worden opgeslagen."],
    };
  }

  void sendRoleRequestAdminEmail({
    role,
    userId,
    payload,
  }).catch((emailError) => {
    console.error("Failed to send role request admin email", {
      userId,
      role,
      error: emailError,
    });
  });

  return { ok: true, requestId: data.id, created: true, errors: [] };
}

export async function listRoleRequestsForUser(
  userId: string
): Promise<PendingRoleRequestSummary[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("role_requests")
    .select("id, role, status, created_at")
    .eq("user_id", userId)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    role: row.role as PrivilegedRole,
    status: row.status as RoleRequestStatus,
    createdAt: row.created_at,
  }));
}

export async function listPendingRoleRequests(): Promise<
  Array<
    RoleRequestRow & {
      userEmail: string | null;
    }
  >
> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("role_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const rows = data as RoleRequestRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const emailByUserId = new Map<string, string | null>();

  await Promise.all(
    userIds.map(async (userId) => {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      emailByUserId.set(userId, authUser.user?.email ?? null);
    })
  );

  return rows.map((row) => ({
    ...row,
    payload: (row.payload ?? {}) as RoleRequestPayload,
    userEmail: emailByUserId.get(row.user_id) ?? null,
  }));
}

async function provisionMerchantFromPayload(
  userId: string,
  payload: RoleRequestPayload
): Promise<{ ok: boolean; message: string }> {
  const displayName = payload.displayName?.trim();
  const email = payload.email?.trim().toLowerCase();

  if (!displayName || !email) {
    return {
      ok: false,
      message: "Merchant-aanvraag mist verplichte gegevens (naam of e-mail).",
    };
  }

  const merchantResult = await provisionMerchantSeller(
    {
      displayName,
      businessName: payload.businessName?.trim() || displayName,
      contactName: payload.contactName,
      email,
      phone: payload.phone,
      city: payload.city,
      postalCode: payload.postalCode,
      countryCode: payload.countryCode,
    },
    {}
  );

  if (!merchantResult.ok || !merchantResult.sellerId) {
    return {
      ok: false,
      message: formatMerchantProvisionError(merchantResult.error),
    };
  }

  const sellerLinkResult = await linkUserToSeller(
    userId,
    merchantResult.sellerId,
    "merchant"
  );

  if (!sellerLinkResult.ok) {
    return {
      ok: false,
      message:
        "Merchant-winkel werd aangemaakt maar koppelen aan het account mislukt.",
    };
  }

  return { ok: true, message: "" };
}

export async function approveRoleRequest(
  requestId: string,
  moderatorId: string,
  reviewerNote?: string | null
): Promise<{ ok: boolean; message: string }> {
  const supabase = createPlatformClient();

  const { data: request, error: fetchError } = await supabase
    .from("role_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !request) {
    return { ok: false, message: "Aanvraag niet gevonden of al behandeld." };
  }

  const role = request.role as PrivilegedRole;
  const payload = (request.payload ?? {}) as RoleRequestPayload;
  const userId = request.user_id as string;

  if (role === "merchant") {
    const provisionResult = await provisionMerchantFromPayload(userId, payload);
    if (!provisionResult.ok) {
      return provisionResult;
    }
  }

  const roleResult = await ensureUserRole(userId, role);
  if (!roleResult.ok) {
    return {
      ok: false,
      message: roleResult.errors[0] ?? "Rol kon niet worden toegekend.",
    };
  }

  const { error: updateError } = await supabase
    .from("role_requests")
    .update({
      status: "approved",
      reviewer_user_id: moderatorId,
      reviewer_note: reviewerNote?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (updateError) {
    return { ok: false, message: "Goedkeuren mislukt. Probeer opnieuw." };
  }

  return { ok: true, message: "Aanvraag goedgekeurd." };
}

export async function rejectRoleRequest(
  requestId: string,
  moderatorId: string,
  reviewerNote?: string | null
): Promise<{ ok: boolean; message: string }> {
  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("role_requests")
    .update({
      status: "rejected",
      reviewer_user_id: moderatorId,
      reviewer_note: reviewerNote?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    return { ok: false, message: "Afwijzen mislukt. Probeer opnieuw." };
  }

  return { ok: true, message: "Aanvraag afgewezen." };
}

export async function withdrawPendingRoleRequest(
  userId: string,
  role: PrivilegedRole
): Promise<void> {
  const supabase = createPlatformClient();
  await supabase
    .from("role_requests")
    .update({ status: "withdrawn" })
    .eq("user_id", userId)
    .eq("role", role)
    .eq("status", "pending");
}

export async function syncPrivilegedRolesFromCreatorTypes(
  userId: string,
  creatorTypes: string[],
  options?: { source?: string }
): Promise<string | null> {
  const supabase = createPlatformClient();
  const wantsWorkshopHost = creatorTypes.includes("workshopgever");
  const wantsOrganizer = creatorTypes.includes("organizer");

  const { data: roleRows } = await supabase
    .from("user_account_roles")
    .select("role")
    .eq("user_id", userId);

  const activeRoles = new Set((roleRows ?? []).map((row) => row.role));

  if (wantsWorkshopHost && !activeRoles.has("workshop_host")) {
    const result = await createRoleRequest(userId, "workshop_host", {
      creatorType: "workshopgever",
      source: options?.source,
    });
    if (!result.ok) {
      return result.errors[0] ?? "Workshopgever-aanvraag mislukt.";
    }
  }

  if (wantsOrganizer && !activeRoles.has("organizer")) {
    const result = await createRoleRequest(userId, "organizer", {
      creatorType: "organizer",
      source: options?.source,
    });
    if (!result.ok) {
      return result.errors[0] ?? "Organisator-aanvraag mislukt.";
    }
  }

  if (!wantsWorkshopHost) {
    await withdrawPendingRoleRequest(userId, "workshop_host");
    const removeResult = await removeUserRoles(userId, ["workshop_host"]);
    if (!removeResult.ok) {
      return removeResult.errors[0] ?? "Workshopgever-rol verwijderen mislukt.";
    }
  }

  if (!wantsOrganizer) {
    await withdrawPendingRoleRequest(userId, "organizer");
    const removeResult = await removeUserRoles(userId, ["organizer"]);
    if (!removeResult.ok) {
      return removeResult.errors[0] ?? "Organisator-rol verwijderen mislukt.";
    }
  }

  return null;
}

export const ROLE_REQUEST_PENDING_MESSAGE =
  "Je aanvraag staat klaar voor beoordeling. Je krijgt toegang zodra we die goedkeuren.";
