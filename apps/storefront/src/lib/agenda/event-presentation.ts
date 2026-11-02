/** Preserve unaudited legacy event display without changing stored instants.
 * New source-verified events use the agenda timezone. Remove an ID only after
 * checking its original source and saving real offset-aware timestamps.
 */
export const LEGACY_EVENT_UTC_IDS = new Set<string>([
  "e7777777-7777-7777-7777-777777777701",
  "e7777777-7777-7777-7777-777777777702",
  "e7777777-7777-7777-7777-777777777703",
  "e7777777-7777-7777-7777-777777777704",
  "e7777777-7777-7777-7777-777777777705",
  "e7777777-7777-7777-7777-777777777706",
  "e7777777-7777-7777-7777-777777777707",
  "e7777777-7777-7777-7777-777777777708",
  "e7777777-7777-7777-7777-777777777709",
  "5e483df1-5274-4e34-b32c-dc6dff92c928",
  "54f4add6-7ce1-41b5-a4ac-5a240c277687",
  "565620d3-c312-4e2c-a386-2a2227461a15",
  "89da4250-c9d2-40e0-a810-385217738cf2",
  "b6980889-8857-4fc1-a4ad-f3215c7e2869",
  "71de88c1-47c2-40e7-b4e3-bcd121a4e6f9",
  "a80f092f-c129-4e50-9392-54d5c03f3b70",
  "03eec349-e523-4a98-a098-6a0dfe2531e2",
  "afc6c4fa-59c0-4a17-9f13-d524f6a84002",
  "d06fa6f2-006b-4165-b898-f8ab9d4fb647",
  "29c0ee33-4821-48b9-b2f1-ab6c0b227178",
  "ff975246-831a-40c4-a6b8-ed98f2c7afb5",
  "9741cb6c-6a33-483d-857e-08d6a37531f7",
  "9a941aaf-68ea-4bfb-ab82-515d18fa1e95",
  "38f31f7e-9db0-4508-8b5d-11ca0e91186f",
  "b5973881-8ec9-47e6-889e-41f4d8f1ca51",
  "da4d528c-e8f7-41f5-b28d-c64a611dbed3",
  "be372b97-b1af-4cc0-9342-515b750368e2",
  "e61a632b-3b4d-4644-ba45-ef67a18182c0",
  "943e3f44-835d-4def-a224-88e4e8ca85f1",
  "fe08b819-95fd-4a08-b122-cfa6602c502a",
  "644a16f5-17b7-4931-afbc-022bf6ae12e3",
  "a7072e4d-a7e2-4931-b9e6-df952c35a285",
  "75efdd4e-90c0-49c0-9f70-e95c476c0637",
  "8cc7de58-35af-4077-a2f0-af097032049d",
  "bbd3bcd4-cd73-4873-8771-1ac01289ee63",
  "df782622-8131-48a9-b04a-ab0b2c968d92",
  "c4c09c11-208f-4d83-9e36-ecc87bb3e214",
  "582d0913-3862-49ee-8e08-32ebf7b7d649",
  "1bd7b9a7-dc1f-446d-8914-eee45ffdc7cd",
  "de16b0b5-4c87-41e7-8c06-f105884c9db5",
  "325dc589-326f-453d-8bd8-c71b4926d814",
  "ef9e69e7-42dc-4bc4-ad4d-753867db2b7c",
  "594dd546-298d-42af-b45d-223f45b3e8ce",
  "787d1f04-fd09-4263-8ae9-f6a164b9c761",
  "7cdcee5b-f2ca-4aa5-8aa3-7c51e7fba892",
  "32251fdd-aa99-4268-b42d-19493354638a",
  "14b2484f-e0f1-4dbf-b478-f1ecc71578c0"
]);
export const EVENT_TIMEZONE = "Europe/Brussels";
export function eventDisplayTimeZone(eventId: string): string {
  return LEGACY_EVENT_UTC_IDS.has(eventId) ? "UTC" : EVENT_TIMEZONE;
}
export function formatEventDateParts(eventId: string, startsAt: string, endsAt: string) {
  const timeZone = eventDisplayTimeZone(eventId);
  const start = new Date(startsAt), end = new Date(endsAt);
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const yearFmt = new Intl.DateTimeFormat("en", { timeZone, year: "numeric" });
  const fullDate = new Intl.DateTimeFormat("nl-NL", { timeZone, day: "numeric", month: "long", year: "numeric" });
  const dayMonth = new Intl.DateTimeFormat("nl-NL", { timeZone, day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("nl-NL", { timeZone, hour: "2-digit", minute: "2-digit" });
  const sameDay = dayKey.format(start) === dayKey.format(end);
  const sameYear = yearFmt.format(start) === yearFmt.format(end);
  return {
    dateLabel: sameDay ? fullDate.format(start) : `${sameYear ? dayMonth.format(start) : fullDate.format(start)} – ${fullDate.format(end)}`,
    timeLabel: `${time.format(start)} – ${time.format(end)}`,
    isMultiDay: !sameDay,
  };
}
export function eventPriceLabel(cents: number | null | undefined): string {
  if (cents == null) return "Entree niet vermeld";
  if (cents === 0) return "Gratis toegang";
  return `€${(cents / 100).toFixed(2)}`;
}
