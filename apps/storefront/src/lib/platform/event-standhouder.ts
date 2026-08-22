export function isEligibleStandhouder(input: {
  creatorTypes: string[] | null | undefined;
  roles: string[];
}): boolean {
  const types = new Set(
    (input.creatorTypes ?? []).map((value) => value.trim().toLowerCase())
  );
  if (types.has("maker") || types.has("workshopgever")) return true;
  if (input.roles.includes("workshop_host")) return true;
  if (input.roles.includes("creator") && types.size === 0) return true;
  return false;
}

export const EVENT_STANDHOUDER_ROLE = "vendor";
export const EVENT_EXHIBITS_AT_RELATION = "exhibits_at";
