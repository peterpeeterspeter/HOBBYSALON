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
  description: string;
}> = [
  {
    value: "workshop",
    label: "Workshops",
    description: "Leren met je handen bij makers in de buurt",
  },
  {
    value: "supply",
    label: "Materialen",
    description: "Wol, klei, papier en hobbybenodigdheden",
  },
  {
    value: "handmade",
    label: "Handmade producten",
    description: "Unieke stukken van makers",
  },
  {
    value: "event",
    label: "Markten & events",
    description: "Makers markets, beurzen en open ateliers",
  },
  {
    value: "article",
    label: "Tutorials & inspiratie",
    description: "Patronen, gidsen en tips om thuis te maken",
  },
];

/** Preferred hobby domains shown during hobbyist registration. */
export const REGISTRATION_HOBBY_DOMAIN_SLUGS = [
  "diy",
  "pottery",
  "card-making",
  "knitting",
  "scrapbooking",
  "jewelry-making",
  "crochet",
  "sewing",
] as const;

export const REGISTRATION_COUNTRY_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "BE", label: "Belgie" },
  { value: "NL", label: "Nederland" },
];
