import assert from "node:assert/strict";
import test from "node:test";
import {
  pickNextMatchingSession,
  pickNextSessionByWorkshop,
  resolveHobbyChipDomainIds,
  sessionDurationMinutes,
  workshopPassesPlaceAndFormat,
} from "./workshop-discovery-helpers";
import { zonedDateTimeToUtcIso } from "../agenda/agenda-helpers";

test("sessionDurationMinutes from endsAt − startsAt", () => {
  assert.equal(
    sessionDurationMinutes({
      startsAt: "2026-08-08T10:00:00.000Z",
      endsAt: "2026-08-08T13:00:00.000Z",
    }),
    180
  );
  assert.equal(
    sessionDurationMinutes({
      startsAt: "2026-08-08T10:00:00.000Z",
      endsAt: "2026-08-08T09:00:00.000Z",
    }),
    null
  );
});

test("pickNextMatchingSession without range picks first future session", () => {
  const nowIso = "2026-07-28T12:00:00.000Z";
  const next = pickNextMatchingSession(
    [
      {
        id: "past",
        workshop_id: "w1",
        starts_at: "2026-07-01T10:00:00.000Z",
        ends_at: "2026-07-01T12:00:00.000Z",
      },
      {
        id: "soon",
        workshop_id: "w1",
        starts_at: "2026-08-01T10:00:00.000Z",
        ends_at: "2026-08-01T13:00:00.000Z",
      },
      {
        id: "later",
        workshop_id: "w1",
        starts_at: "2026-09-01T10:00:00.000Z",
        ends_at: "2026-09-01T13:00:00.000Z",
      },
    ],
    { nowIso }
  );
  assert.equal(next?.id, "soon");
});

test("pickNextMatchingSession with range picks in-range session not earlier future", () => {
  const nowIso = "2026-07-28T12:00:00.000Z";
  const weekendFrom = zonedDateTimeToUtcIso(2026, 8, 1, 0, 0, 0);
  const weekendTo = zonedDateTimeToUtcIso(2026, 8, 2, 23, 59, 59);
  const next = pickNextMatchingSession(
    [
      {
        id: "next-week",
        workshop_id: "w1",
        starts_at: zonedDateTimeToUtcIso(2026, 8, 4, 10, 0, 0),
        ends_at: zonedDateTimeToUtcIso(2026, 8, 4, 13, 0, 0),
      },
      {
        id: "weekend",
        workshop_id: "w1",
        starts_at: zonedDateTimeToUtcIso(2026, 8, 1, 10, 0, 0),
        ends_at: zonedDateTimeToUtcIso(2026, 8, 1, 13, 0, 0),
      },
    ],
    { nowIso, range: { from: weekendFrom, to: weekendTo } }
  );
  assert.equal(next?.id, "weekend");
});

test("pickNextSessionByWorkshop dedupes to one session per workshop", () => {
  const map = pickNextSessionByWorkshop(
    [
      {
        id: "a1",
        workshop_id: "w1",
        starts_at: "2026-08-01T10:00:00.000Z",
        ends_at: "2026-08-01T12:00:00.000Z",
      },
      {
        id: "a2",
        workshop_id: "w1",
        starts_at: "2026-08-15T10:00:00.000Z",
        ends_at: "2026-08-15T12:00:00.000Z",
      },
      {
        id: "b1",
        workshop_id: "w2",
        starts_at: "2026-08-02T10:00:00.000Z",
        ends_at: "2026-08-02T12:00:00.000Z",
      },
    ],
    { nowIso: "2026-07-28T00:00:00.000Z" }
  );
  assert.equal(map.size, 2);
  assert.equal(map.get("w1")?.id, "a1");
  assert.equal(map.get("w2")?.id, "b1");
});

test("place excludes online unless online format selected", () => {
  const online = {
    format_type: "online",
    city: null,
    location_name: null,
  };
  const physical = {
    format_type: "physical",
    city: "Herentals",
    location_name: "Atelier",
  };
  const hybrid = {
    format_type: "hybrid",
    city: "Herentals",
    location_name: null,
  };

  assert.equal(
    workshopPassesPlaceAndFormat({
      workshop: online,
      place: "Herentals",
      formatFilter: null,
    }),
    false
  );
  assert.equal(
    workshopPassesPlaceAndFormat({
      workshop: physical,
      place: "Herentals",
      formatFilter: null,
    }),
    true
  );
  assert.equal(
    workshopPassesPlaceAndFormat({
      workshop: hybrid,
      place: "Herentals",
      formatFilter: null,
    }),
    true
  );
  assert.equal(
    workshopPassesPlaceAndFormat({
      workshop: online,
      place: "Herentals",
      formatFilter: "online",
    }),
    true
  );
  assert.equal(
    workshopPassesPlaceAndFormat({
      workshop: physical,
      place: "Herentals",
      formatFilter: "online",
    }),
    true
  );
});

test("resolveHobbyChipDomainIds keeps selected domain sticky", () => {
  assert.deepEqual(
    resolveHobbyChipDomainIds({
      resultDomainIds: ["d2"],
      selectedDomainId: "d1",
      allDomainIdsOrdered: ["d1", "d2", "d3"],
    }),
    ["d1", "d2"]
  );
});
