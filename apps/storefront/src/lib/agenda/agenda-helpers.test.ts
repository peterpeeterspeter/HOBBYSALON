import assert from "node:assert/strict";
import test from "node:test";
import {
  eventOverlapsRange,
  formatAgendaPlaceLabel,
  groupEventsByAgendaBucket,
  resolveAgendaCustomRange,
  resolveAgendaDatePreset,
  sanitizeAgendaSearchQuery,
  zonedDateTimeToUtcIso,
} from "./agenda-helpers";

test("sanitizeAgendaSearchQuery strips PostgREST-breaking punctuation", () => {
  assert.equal(sanitizeAgendaSearchQuery("a"), null);
  assert.equal(sanitizeAgendaSearchQuery("  "), null);
  assert.equal(sanitizeAgendaSearchQuery("haken"), "haken");
  assert.equal(sanitizeAgendaSearchQuery("haken%(or)"), "haken or");
  assert.equal(sanitizeAgendaSearchQuery("  beurs,  Gent  "), "beurs Gent");
});

test("formatAgendaPlaceLabel modes", () => {
  assert.equal(formatAgendaPlaceLabel({ place: "Herentals", mode: "in" }), "In Herentals");
  assert.equal(
    formatAgendaPlaceLabel({ place: "Herentals", mode: "around" }),
    "Rond Herentals"
  );
  assert.equal(
    formatAgendaPlaceLabel({ place: "Herentals", mode: "within_km", km: 30 }),
    "Binnen 30 km van Herentals"
  );
  assert.equal(formatAgendaPlaceLabel({ place: "  ", mode: "in" }), "");
});

test("resolveAgendaDatePreset weekend is Sat–Sun for a Wednesday", () => {
  // 2026-07-29 is Wednesday in Europe/Brussels
  const now = new Date("2026-07-29T12:00:00+02:00");
  const range = resolveAgendaDatePreset("weekend", now);
  assert.ok(range);
  assert.equal(range.from, zonedDateTimeToUtcIso(2026, 8, 1, 0, 0, 0));
  assert.equal(range.to, zonedDateTimeToUtcIso(2026, 8, 2, 23, 59, 59));
});

test("resolveAgendaDatePreset next_week is next Mon–Sun", () => {
  const now = new Date("2026-07-29T12:00:00+02:00");
  const range = resolveAgendaDatePreset("next_week", now);
  assert.ok(range);
  assert.equal(range.from, zonedDateTimeToUtcIso(2026, 8, 3, 0, 0, 0));
  assert.equal(range.to, zonedDateTimeToUtcIso(2026, 8, 9, 23, 59, 59));
});

test("resolveAgendaDatePreset month is rest of calendar month", () => {
  const now = new Date("2026-07-29T12:00:00+02:00");
  const range = resolveAgendaDatePreset("month", now);
  assert.ok(range);
  assert.equal(range.from, zonedDateTimeToUtcIso(2026, 7, 29, 0, 0, 0));
  assert.equal(range.to, zonedDateTimeToUtcIso(2026, 7, 31, 23, 59, 59));
});

test("resolveAgendaCustomRange builds inclusive day bounds", () => {
  const range = resolveAgendaCustomRange("2026-08-08", "2026-08-10");
  assert.ok(range);
  assert.equal(range.from, zonedDateTimeToUtcIso(2026, 8, 8, 0, 0, 0));
  assert.equal(range.to, zonedDateTimeToUtcIso(2026, 8, 10, 23, 59, 59));
});

test("eventOverlapsRange keeps multi-day events mid-run", () => {
  const event = {
    starts_at: "2026-08-01T10:00:00.000Z",
    ends_at: "2026-08-05T18:00:00.000Z",
  };
  assert.equal(
    eventOverlapsRange(event, "2026-08-03T00:00:00.000Z", "2026-08-03T23:59:59.000Z"),
    true
  );
  assert.equal(
    eventOverlapsRange(event, "2026-07-01T00:00:00.000Z", "2026-07-02T23:59:59.000Z"),
    false
  );
  assert.equal(
    eventOverlapsRange(
      { starts_at: "2026-08-03T12:00:00.000Z", ends_at: null },
      "2026-08-03T00:00:00.000Z",
      "2026-08-03T23:59:59.000Z"
    ),
    true
  );
});

test("groupEventsByAgendaBucket preset buckets", () => {
  const now = new Date("2026-07-29T12:00:00+02:00");
  const events = [
    {
      id: "1",
      starts_at: zonedDateTimeToUtcIso(2026, 8, 1, 10, 0, 0),
      ends_at: null,
    },
    {
      id: "2",
      starts_at: zonedDateTimeToUtcIso(2026, 8, 4, 10, 0, 0),
      ends_at: null,
    },
    {
      id: "3",
      starts_at: zonedDateTimeToUtcIso(2026, 7, 30, 10, 0, 0),
      ends_at: null,
    },
    {
      id: "4",
      starts_at: zonedDateTimeToUtcIso(2026, 9, 1, 10, 0, 0),
      ends_at: null,
    },
  ];
  const groups = groupEventsByAgendaBucket(events, { mode: "preset", now });
  assert.deepEqual(
    groups.map((g) => [g.key, g.events.map((e) => e.id)]),
    [
      ["weekend", ["1"]],
      ["next_week", ["2"]],
      ["month", ["3"]],
      ["later", ["4"]],
    ]
  );
});

test("groupEventsByAgendaBucket custom day headings", () => {
  const events = [
    {
      id: "a",
      starts_at: zonedDateTimeToUtcIso(2026, 8, 8, 10, 0, 0),
      ends_at: null,
    },
    {
      id: "b",
      starts_at: zonedDateTimeToUtcIso(2026, 8, 8, 15, 0, 0),
      ends_at: null,
    },
    {
      id: "c",
      starts_at: zonedDateTimeToUtcIso(2026, 8, 9, 10, 0, 0),
      ends_at: null,
    },
  ];
  const groups = groupEventsByAgendaBucket(events, { mode: "custom" });
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.key, "2026-08-08");
  assert.equal(groups[0]!.events.length, 2);
  assert.match(groups[0]!.label, /augustus/i);
  assert.equal(groups[1]!.key, "2026-08-09");
});
