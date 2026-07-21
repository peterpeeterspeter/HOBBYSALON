import type { UserAccountRole } from "@/lib/platform/queries/user-registration";
import { ACCOUNT_ROLE_LABELS } from "@/lib/auth/account-roles";

export type PrivilegedRole = Extract<
  UserAccountRole,
  "merchant" | "workshop_host" | "organizer"
>;

export function creatorTypeToPrivilegedRole(
  creatorType: string
): PrivilegedRole | null {
  if (creatorType === "workshopgever") return "workshop_host";
  if (creatorType === "organizer") return "organizer";
  return null;
}

export function privilegedRoleLabel(role: PrivilegedRole): string {
  return ACCOUNT_ROLE_LABELS[role];
}

export function hasPendingRoleRequest(
  pendingRequests: Array<{ role: PrivilegedRole; status: string }>,
  role: PrivilegedRole
): boolean {
  return pendingRequests.some(
    (request) => request.role === role && request.status === "pending"
  );
}

export function creatorTypesRequiringApproval(
  creatorTypes: string[]
): PrivilegedRole[] {
  const roles = new Set<PrivilegedRole>();
  for (const type of creatorTypes) {
    const role = creatorTypeToPrivilegedRole(type);
    if (role) roles.add(role);
  }
  return Array.from(roles);
}
