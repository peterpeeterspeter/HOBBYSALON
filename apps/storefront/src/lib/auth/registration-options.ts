export const REGISTRATION_DEFAULT_COUNTRY = "BE";

export const REGISTRATION_ALLOWED_INTEREST_TYPES = [
  "workshop",
  "supply",
  "handmade",
  "event",
  "article",
] as const;

export type RegistrationInterestType =
  (typeof REGISTRATION_ALLOWED_INTEREST_TYPES)[number];

export const REGISTRATION_INTEREST_OPTIONS: Array<{
  value: RegistrationInterestType;
  label: string;
}> = [
  { value: "workshop", label: "Workshops" },
  { value: "supply", label: "Materialen" },
  { value: "handmade", label: "Handmade producten" },
  { value: "event", label: "Markten & events" },
  { value: "article", label: "Tutorials & inspiratie" },
];

export const REGISTRATION_COUNTRY_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "BE", label: "Belgie" },
  { value: "NL", label: "Nederland" },
];
