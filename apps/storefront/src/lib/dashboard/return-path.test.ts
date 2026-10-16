import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveReturnPath,
  successPathAfterCreate,
  successPathAfterDelete,
  withFlash,
} from "./return-path.ts";

function form(returnTo?: string) {
  const data = new FormData();
  if (returnTo !== undefined) data.set("return_to", returnTo);
  return data;
}

const BASE = "/dashboard/workshops";
const ID = "9945e1ec-9310-4153-9047-bbcfe7037e7a";

test("keeps edit and new pages inside the same section", () => {
  assert.equal(resolveReturnPath(form(`${BASE}/${ID}`), BASE), `${BASE}/${ID}`);
  assert.equal(resolveReturnPath(form(`${BASE}/nieuw`), BASE), `${BASE}/nieuw`);
  assert.equal(resolveReturnPath(form(BASE), BASE), BASE);
});

test("falls back when return_to is missing or empty", () => {
  assert.equal(resolveReturnPath(form(), BASE), BASE);
  assert.equal(resolveReturnPath(form(""), BASE), BASE);
});

test("rejects anything that could leave the section or the site", () => {
  for (const evil of [
    "https://evil.example/dashboard/workshops",
    "//evil.example",
    "/dashboard/events/123",
    "/dashboard/workshopsX",
    `${BASE}evil`,
    `${BASE}/../../login`,
    `${BASE}/a/b/c`,
    `${BASE}/x?next=https://evil.example`,
    `${BASE}/x#frag`,
    `${BASE}/x y`,
    `${BASE}\\evil`,
    `${BASE}//evil.example`,
  ]) {
    assert.equal(resolveReturnPath(form(evil), BASE), BASE, evil);
  }
});

test("after create on the nieuw page, open the new item", () => {
  assert.equal(successPathAfterCreate(`${BASE}/nieuw`, BASE, ID), `${BASE}/${ID}`);
  assert.equal(successPathAfterCreate(BASE, BASE, ID), BASE);
  assert.equal(successPathAfterCreate(`${BASE}/nieuw`, BASE, null), `${BASE}/nieuw`);
});

test("after delete from an edit page, go to the filtered overview", () => {
  assert.equal(
    successPathAfterDelete(`${BASE}/${ID}`, BASE),
    "/dashboard/aanbod?soort=workshops"
  );
  assert.equal(
    successPathAfterDelete("/dashboard/products/abc", "/dashboard/products"),
    "/dashboard/aanbod?soort=creaties"
  );
  assert.equal(successPathAfterDelete(BASE, BASE), BASE);
});

test("flash messages respect an existing query and hash", () => {
  assert.equal(withFlash(BASE, "success", "Klaar"), `${BASE}?success=Klaar`);
  assert.equal(
    withFlash("/dashboard/aanbod?soort=events", "success", "Event verwijderd."),
    "/dashboard/aanbod?soort=events&success=Event%20verwijderd."
  );
  assert.equal(
    withFlash("/dashboard/instellingen#aanbieden", "error", "Fout"),
    "/dashboard/instellingen?error=Fout#aanbieden"
  );
});
