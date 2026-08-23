#!/usr/bin/env node
/**
 * legacy-seller-member-diff.mjs — read-only comparison of two exported datasets.
 *
 * Purpose (re-audit R-2 / P1-2 follow-up): after the exchange bridge started
 * requiring an exact email match between Supabase auth users and Medusa
 * members, any user_seller_links row whose Supabase email has no exact
 * case-insensitive match among the seller's members will get NOT_FOUND at
 * exchange time. This script reports those rows BEFORE deploy so lockouts
 * can be fixed proactively.
 *
 * NO DATABASE CONNECTIVITY — you provide two JSON exports:
 *
 * 1. supabase-export.json — array of { user_id, email } from:
 *      select id as user_id, email from auth.users;
 *
 * 2. medusa-export.json — array of
 *      { member_id, member_email, seller_id, seller_deleted_at }
 *    from (Medusa Postgres):
 *      select m.id as member_id, m.email as member_email,
 *             m.seller_id, m.deleted_at as seller_member_deleted_at -- n/a
 *      from member m where m.deleted_at is null;
 *
 * 3. links-export.json — array of { user_id, seller_id, seller_type } from
 *    (Supabase platform DB): select user_id, seller_id, seller_type
 *    from user_seller_links;
 *
 * Usage:
 *   node legacy-seller-member-diff.mjs supabase-export.json \
 *        medusa-export.json links-export.json [--json]
 *
 * Exit codes: 0 = no mismatches, 1 = mismatches found, 2 = usage/IO error.
 */

import fs from "node:fs";

function loadJson(path, label) {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.error(`ERROR: ${label} (${path}) is not a JSON array`);
      process.exit(2);
    }
    return data;
  } catch (error) {
    console.error(`ERROR: cannot read ${label}: ${error.message}`);
    process.exit(2);
  }
}

const [supaPath, medusaPath, linksPath] = process.argv.slice(2);
if (!supaPath || !medusaPath || !linksPath) {
  console.error(
    "Usage: node legacy-seller-member-diff.mjs <supabase-users.json> <medusa-members.json> <seller-links.json> [--json]"
  );
  process.exit(2);
}
const asJson = process.argv.includes("--json");

const users = loadJson(supaPath, "Supabase export");
const members = loadJson(medusaPath, "Medusa export");
const links = loadJson(linksPath, "Seller-links export");

// Index: email -> [{ member_id, seller_id }]
const lowerEmail = (v) => String(v ?? "").trim().toLowerCase();
const membersByEmail = new Map();
for (const m of members) {
  const key = lowerEmail(m.member_email);
  if (!key) continue;
  if (!membersByEmail.has(key)) membersByEmail.set(key, []);
  membersByEmail.get(key).push({
    member_id: m.member_id,
    seller_id: m.seller_id,
  });
}

// Index: user_id -> email
const emailByUser = new Map();
for (const u of users) {
  if (u.user_id && u.email) emailByUser.set(u.user_id, u.email);
}

const findings = [];
for (const link of links) {
  const userEmail = emailByUser.get(link.user_id);
  if (!userEmail) {
    findings.push({
      kind: "no_supabase_user",
      ...link,
      detail:
        "user_seller_links row points to a user_id absent from the auth.users export.",
    });
    continue;
  }

  const key = lowerEmail(userEmail);
  const candidates = membersByEmail.get(key) ?? [];
  const match = candidates.find((m) => m.seller_id === link.seller_id);

  if (!match) {
    const sameSellerOtherEmail = members.filter(
      (m) => m.seller_id === link.seller_id
    );
    findings.push({
      kind: "email_mismatch",
      user_id: link.user_id,
      supabase_email: userEmail,
      seller_id: link.seller_id,
      seller_type: link.seller_type,
      member_count_on_seller: sameSellerOtherEmail.length,
      detail:
        "Exchange will return NOT_FOUND for this link after commit 70e3e595. Fix by updating the Medusa member's email to match, or removing the stale link.",
    });
  }
}

if (asJson) {
  console.log(JSON.stringify({ total_links: links.length, findings }, null, 2));
} else {
  console.log(`Checked ${links.length} seller links.`);
  if (findings.length === 0) {
    console.log("No mismatches found. Safe to deploy the exact-email gate.");
  } else {
    console.log(`\n${findings.length} problem link(s):\n`);
    for (const f of findings) {
      console.log(
        `- [${f.kind}] user=${f.user_id} seller=${f.seller_id} email=${
          f.supabase_email ?? "(unknown)"
        }`
      );
      console.log(`  ${f.detail}`);
    }
  }
}
process.exit(findings.length > 0 ? 1 : 0);
