import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { getCommunitySubmissionStatusCopy } from "./community-submission-status.ts";

test("returns owner-facing copy and withdrawal availability for pending submissions", () => {
  assert.deepEqual(getCommunitySubmissionStatusCopy("pending"), {
    label: "In afwachting van beoordeling",
    detail: "Je project is ingediend en wacht op beoordeling.",
    canWithdraw: true,
  });
});

test("lets owners withdraw approved submissions", () => {
  assert.equal(getCommunitySubmissionStatusCopy("approved").canWithdraw, true);
});

test("keeps rejected and withdrawn submissions out of the withdrawal flow", () => {
  assert.deepEqual(getCommunitySubmissionStatusCopy("rejected"), {
    label: "Niet goedgekeurd",
    detail: "Je project is niet opgenomen in deze communitygalerij.",
    canWithdraw: false,
  });
  assert.deepEqual(getCommunitySubmissionStatusCopy("withdrawn"), {
    label: "Inzending ingetrokken",
    detail: "Je project wordt niet meer getoond bij dit artikel.",
    canWithdraw: false,
  });
});
