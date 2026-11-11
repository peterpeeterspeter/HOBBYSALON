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
import { ensureMerchantCreatorProfile } from "@/lib/platform/queries/merchant-creator";

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

/**
 * Grant a privileged role immediately (no admin review).
 * Merchant also provisions Medusa seller + platform links.
 */
export async function activatePrivilegedRoleImmediately(
  userId: string,
  role: PrivilegedRole,
  payload: RoleRequestPayload = {}
): Promise<{ ok: boolean; message: string }> {
  if (role === "merchant") {
    return activateMerchantImmediately(userId, payload);
  }

  const supabase = createPlatformClient();

  const { data: alreadyHasRole } = await supabase
    .from("user_account_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (!alreadyHasRole?.id) {
    const roleResult = await ensureUserRole(userId, role);
    if (!roleResult.ok) {
      return {
        ok: false,
        message: roleResult.errors[0] ?? "Rol kon niet worden toegekend.",
      };
    }
  }

  await supabase
    .from("role_requests")
    .update({
      status: "approved",
      reviewer_note:
        "Automatisch goedgekeurd — rolbevestiging door admin is uitgeschakeld.",
      reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("role", role)
    .eq("status", "pending");

  const label =
    role === "workshop_host"
      ? "workshopgever"
      : role === "organizer"
        ? "organisator"
        : role;

  return {
    ok: true,
    message: `Je ${label}-rol is actief. Je kan meteen verder.`,
  };
}

export async function createRoleRequest(
  userId: string,
  role: PrivilegedRole,
  payload: RoleRequestPayload = {}
): Promise<{ ok: boolean; requestId: string | null; created: boolean; errors: string[] }> {
  // All privileged roles activate immediately — never queue for admin review.
  const activate = await activatePrivilegedRoleImmediately(userId, role, payload);
  return {
    ok: activate.ok,
    requestId: null,
    created: activate.ok,
    errors: activate.ok ? [] : [activate.message],
  };
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

  const creatorResult = await ensureMerchantCreatorProfile({
    userId,
    sellerId: merchantResult.sellerId,
    displayName,
    businessName: payload.businessName?.trim() || displayName,
    city: payload.city,
    postalCode: payload.postalCode,
    countryCode: payload.countryCode,
    email,
  });

  if (!creatorResult.ok) {
    return {
      ok: false,
      message:
        creatorResult.errors[0] ??
        "Merchant-winkel gekoppeld, maar creator-profiel aanmaken mislukt.",
    };
  }

  return { ok: true, message: "" };
}

/**
 * Activate a merchant immediately (no admin review).
 * Provisions Medusa seller + platform links and grants the merchant role.
 * Any pending merchant role_requests for this user are closed as approved.
 */
export async function activateMerchantImmediately(
  userId: string,
  payload: RoleRequestPayload
): Promise<{ ok: boolean; message: string }> {
  const supabase = createPlatformClient();

  const { data: alreadyHasRole } = await supabase
    .from("user_account_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "merchant")
    .maybeSingle();

  if (alreadyHasRole?.id) {
    return { ok: true, message: "Je merchant-account is actief." };
  }

  const provisionResult = await provisionMerchantFromPayload(userId, payload);
  if (!provisionResult.ok) {
    return provisionResult;
  }

  const roleResult = await ensureUserRole(userId, "merchant");
  if (!roleResult.ok) {
    return {
      ok: false,
      message: roleResult.errors[0] ?? "Merchant-rol kon niet worden toegekend.",
    };
  }

  await supabase
    .from("role_requests")
    .update({
      status: "approved",
      reviewer_note:
        "Automatisch goedgekeurd — merchant-bevestiging door admin is uitgeschakeld.",
      reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("role", "merchant")
    .eq("status", "pending");

  return {
    ok: true,
    message: "Je winkel is klaar. Je kan meteen verder in het dashboard.",
  };
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

  const userEmail =
    payload.email?.trim() ||
    (await supabase.auth.admin.getUserById(userId)).data.user?.email ||
    null;
  if (userEmail) {
    const { sendRoleApprovedUserEmail } = await import(
      "@/lib/platform/notifications/role-request-email"
    );
    void sendRoleApprovedUserEmail({
      role,
      toEmail: userEmail,
      displayName: payload.displayName,
    }).catch((emailError) => {
      console.error("Failed to send role approved user email", {
        userId,
        role,
        error: emailError,
      });
    });
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
  options?: RoleRequestPayload & { source?: string }
): Promise<string | null> {
  const supabase = createPlatformClient();
  const wantsWorkshopHost = creatorTypes.includes("workshopgever");
  const wantsOrganizer = creatorTypes.includes("organizer");
  const payload: RoleRequestPayload = {
    displayName: options?.displayName,
    businessName: options?.businessName,
    email: options?.email,
    city: options?.city,
    countryCode: options?.countryCode,
    source: options?.source,
  };

  const { data: roleRows } = await supabase
    .from("user_account_roles")
    .select("role")
    .eq("user_id", userId);

  const activeRoles = new Set((roleRows ?? []).map((row) => row.role));

  if (wantsWorkshopHost && !activeRoles.has("workshop_host")) {
    const result = await createRoleRequest(userId, "workshop_host", {
      ...payload,
      creatorType: "workshopgever",
    });
    if (!result.ok) {
      return result.errors[0] ?? "Workshopgever-aanvraag mislukt.";
    }
  }

  if (wantsOrganizer && !activeRoles.has("organizer")) {
    const result = await createRoleRequest(userId, "organizer", {
      ...payload,
      creatorType: "organizer",
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

/** @deprecated Role approval queue is disabled; kept for legacy draft-gate errors. */
export const ROLE_REQUEST_PENDING_MESSAGE =
  "Deze rol is nog niet actief op je account. Kies de rol opnieuw onder Instellingen.";
