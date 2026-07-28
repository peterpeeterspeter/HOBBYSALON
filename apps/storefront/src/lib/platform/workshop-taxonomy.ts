/** Controlled vocabularies for workshop taxonomy filters and forms. */

export const WORKSHOP_OFFER_TYPES = [
  "open_workshop",
  "private_group",
  "ongoing_course",
] as const;

export type WorkshopOfferType = (typeof WORKSHOP_OFFER_TYPES)[number];

export const WORKSHOP_OFFER_TYPE_LABELS: Record<WorkshopOfferType, string> = {
  open_workshop: "Open workshop",
  private_group: "Privé groep",
  ongoing_course: "Cursusreeks",
};

export const WORKSHOP_AUDIENCE_TYPES = [
  "kids",
  "parent_child",
  "adults",
  "team",
  "bachelorette",
] as const;

export type WorkshopAudienceType = (typeof WORKSHOP_AUDIENCE_TYPES)[number];

export const WORKSHOP_AUDIENCE_LABELS: Record<WorkshopAudienceType, string> = {
  kids: "Voor kinderen",
  parent_child: "Ouder & kind",
  adults: "Volwassenen",
  team: "Teams / teambuilding",
  bachelorette: "Vrijgezellenfeest",
};

export const WORKSHOP_AGE_GROUPS = [
  "kids_0_11",
  "kids_12_15",
  "teens_16_17",
  "adults_18_plus",
  "seniors_65_plus",
] as const;

export type WorkshopAgeGroup = (typeof WORKSHOP_AGE_GROUPS)[number];

export const WORKSHOP_AGE_GROUP_LABELS: Record<WorkshopAgeGroup, string> = {
  kids_0_11: "Kinderen 0–11",
  kids_12_15: "Kinderen 12–15",
  teens_16_17: "Jongeren 16–17",
  adults_18_plus: "Volwassenen (18+)",
  seniors_65_plus: "Senioren (65+)",
};

export const WORKSHOP_LANGUAGES = ["nl", "en", "fr"] as const;

export type WorkshopLanguage = (typeof WORKSHOP_LANGUAGES)[number];

export const WORKSHOP_LANGUAGE_LABELS: Record<WorkshopLanguage, string> = {
  nl: "Nederlands",
  en: "English",
  fr: "Français",
};

export type WorkshopCategory = {
  id: string;
  domain_id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export function isWorkshopOfferType(value: string): value is WorkshopOfferType {
  return (WORKSHOP_OFFER_TYPES as readonly string[]).includes(value);
}

export function isWorkshopAudienceType(
  value: string
): value is WorkshopAudienceType {
  return (WORKSHOP_AUDIENCE_TYPES as readonly string[]).includes(value);
}

export function isWorkshopAgeGroup(value: string): value is WorkshopAgeGroup {
  return (WORKSHOP_AGE_GROUPS as readonly string[]).includes(value);
}

export function isWorkshopLanguage(value: string): value is WorkshopLanguage {
  return (WORKSHOP_LANGUAGES as readonly string[]).includes(value);
}

export function parseWorkshopCodeList<T extends string>(
  values: string[],
  guard: (value: string) => value is T
): T[] {
  return [...new Set(values.map((value) => value.trim()).filter(guard))];
}

/** Calendar-day bounds in Europe/Brussels → UTC ISO for session queries. */
export function brusselsDayRangeToUtcIso(input: {
  fromDate?: string | null;
  toDate?: string | null;
}): { fromIso?: string; toIsoExclusive?: string } {
  const result: { fromIso?: string; toIsoExclusive?: string } = {};

  if (input.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(input.fromDate)) {
    result.fromIso = brusselsLocalMidnightToUtcIso(input.fromDate);
  }
  if (input.toDate && /^\d{4}-\d{2}-\d{2}$/.test(input.toDate)) {
    const nextDay = addCalendarDays(input.toDate, 1);
    result.toIsoExclusive = brusselsLocalMidnightToUtcIso(nextDay);
  }
  return result;
}

function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function brusselsLocalMidnightToUtcIso(ymd: string): string {
  // Approximate CET/CEST: use Intl to resolve offset for that civil date at 00:00 Brussels.
  const probe = new Date(`${ymd}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Brussels",
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(probe);
  const tzName = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+1";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  let offsetMinutes = 60;
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const mins = Number(match[3] ?? "0");
    offsetMinutes = sign * (hours * 60 + mins);
  }
  const [y, m, d] = ymd.split("-").map(Number);
  const utcMs =
    Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}
