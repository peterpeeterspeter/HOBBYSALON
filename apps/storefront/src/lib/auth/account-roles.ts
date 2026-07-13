import type { UserAccountRole } from "@/lib/platform/queries/user-registration";

export const ACCOUNT_ROLE_LABELS: Record<UserAccountRole, string> = {
  user: "Hobbyist",
  creator: "Maker / creator",
  merchant: "Winkel / verkoper",
  workshop_host: "Workshopgever",
  organizer: "Organisator",
};

export const ACCOUNT_ROLE_DESCRIPTIONS: Record<UserAccountRole, string> = {
  user: "Je ontdekt workshops, makers en inspiratie op Hobbysalon.",
  creator: "Je hebt een maker-profiel en kunt je creatieve aanbod beheren.",
  merchant: "Je kunt materiaalcatalogi importeren en verkopen via je winkel.",
  workshop_host: "Je kunt workshops aanbieden en aanvragen ontvangen.",
  organizer: "Je kunt events en beurzen organiseren.",
};

export function sortAccountRoles(roles: UserAccountRole[]): UserAccountRole[] {
  const order: UserAccountRole[] = [
    "user",
    "creator",
    "workshop_host",
    "organizer",
    "merchant",
  ];
  return order.filter((role) => roles.includes(role));
}
