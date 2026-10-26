import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile, mkdir, rm, symlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { spawn } from "node:child_process";
import vm from "node:vm";

const root = fileURLToPath(new URL("../../", import.meta.url));
const libraryPath = resolve(root, "apps/storefront/src/lib/content/article-metadata-sidecar.ts");
const script = resolve(root, "apps/storefront/scripts/check-article-metadata-sidecar.ts");
const resolver = resolve(root, "apps/storefront/scripts/test-resolver-register.mjs");
const hash = value => createHash("sha256").update(value).digest("hex");
const id = n => `aaaaaaaa-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, "0")}`;
const body = "Garen 🧶\r\n- Haaknaald 6 mm\n";
const plain = value => JSON.parse(JSON.stringify(value));

// Execute the actual TS module with only its three built-in dependencies.
// Any fetch/network/log attempt is a test failure, even if later swallowed.
let forbidden = [];
const context = vm.createContext({ TextDecoder, Uint8Array, console: new Proxy({}, { get: (_, key) => () => { forbidden.push(`log:${String(key)}`); throw new Error("Forbidden log"); } }), fetch: () => { forbidden.push("network"); throw new Error("Forbidden network"); } });
const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(libraryPath, "utf8")), { context, identifier: libraryPath });
await module.link(async specifier => {
  assert.ok(["node:crypto", "node:fs/promises", "node:path"].includes(specifier), `No arbitrary dependency: ${specifier}`);
  const builtin = await import(specifier);
  return new vm.SyntheticModule(Object.keys(builtin), function () {
    for (const [name, value] of Object.entries(builtin)) this.setExport(name, value);
  }, { context, identifier: specifier });
});
await module.evaluate();
const { articleBodySha256, createLocalSidecarReader, createStorageSidecarReader, loadArticleMetadataSidecar, auditArticleMetadataSidecar } = module.namespace;

function metadata(n = 1, patch = {}) {
  return {
    article_id: id(n), source_sha256: hash(body), metadata_version: "hobbysalon-semantic-v1", claim_scope: "article_asserted_not_externally_verified",
    summary: "Haakproject", content_kind: "pattern_overview",
    difficulty: { value: null, basis: "unknown", evidence: null },
    crafts: [{ label: "haken", evidence: "Haaknaald" }], techniques: [], themes: [], audience: [],
    projects: [{ label: "mandje", role: "primary", evidence: "Garen" }, { label: "tasje", role: "variation", evidence: "Garen" }],
    materials: [{ label: "garen", role: "example", specifications: "100 g", project_labels: ["mandje"], unverified_project_labels: ["tasje"], evidence: "Garen", concept_id: "semantic-hash-not-a-uuid" }],
    tools: [{ label: "haaknaald", role: "alternative", specifications: "6 mm", project_labels: [], evidence: "Haaknaald 6 mm" }],
    constraints: [{ kind: "dimension", value: "6 mm", evidence: "6 mm" }], safety: [], gaps: [], inferences: [],
    source: { is_published: true },
    quality_routing: { automatic_recommendation_blocked: false, automatic_publication_allowed: false, has_extraction_gaps: false, requires_gap_review_before_matching: false, reasons: [] }, ...patch,
  };
}
function fixture(rows = [metadata()], options = {}) {
  const schema = { type: "object", properties: {}, required: ["article_id", "source_sha256", "materials", "tools", "projects", "gaps"] };
  const files = new Map([
    ["article_metadata.schema.json", Buffer.from(JSON.stringify(schema))],
    ["article_metadata.jsonl", Buffer.from(options.text ?? rows.map(row => JSON.stringify(row)).join("\n") + "\n")],
    ["exports/concepts.jsonl", Buffer.from('{"concept_id":"content-hash-not-entity-uuid"}\n')],
  ]);
  const manifest = { dataset_version: "hobbysalon-semantic-v1", created_at: "2026-10-26T14:02:03Z", article_count: rows.length, automatic_publication_allowed: false,
    files: Object.fromEntries([...files].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: hash(bytes) }])) };
  files.set("manifest.json", Buffer.from(JSON.stringify(manifest)));
  const reads = [];
  return { files, manifest, reads, read: async path => { reads.push(path); if (!files.has(path)) throw new Error("private provider credentials must not escape"); return files.get(path); } };
}
const source = (n = 1, patch = {}) => ({ article_id: id(n), is_published: true, body_markdown: body, ...patch });
const audit = (bundle, articles, options = {}) => auditArticleMetadataSidecar(bundle, { kind: "exact_bodies", articles, ...options });

test("manifest verifies every declared file, metadata preserves roles/specs/projects/evidence, no publication or concept mapping", async () => {
  const f = fixture();
  const bundle = await loadArticleMetadataSidecar(f.read);
  assert.deepEqual(f.reads, ["manifest.json", ...Object.keys(f.manifest.files)]);
  const result = plain(audit(bundle, [source(1, { graph_fingerprint: "graph-md5-only" })]));
  assert.equal(result.corpusMatches, true);
  assert.equal(result.inputs[0].state, "ready_for_review");
  assert.deepEqual(result.inputs[0].metadata, metadata());
  assert.equal(result.inputs[0].graphFingerprint, "graph-md5-only");
  assert.equal(result.graphFingerprintIsBodySha256, false);
  assert.equal(result.automaticPublicationAllowed, false);
  assert.equal(result.automaticMatchingAllowed, false);
  assert.equal(result.inputs[0].conceptIdsAreEntityIds, false);
  assert.ok(!JSON.stringify(result).includes("target_entity_id"));
  assert.deepEqual(forbidden, []);
});

test("all file tampering, byte length mismatches, missing declared files and independent manifest pin mismatches fail closed", async () => {
  for (const path of ["article_metadata.schema.json", "article_metadata.jsonl", "exports/concepts.jsonl"]) {
    const f = fixture(); const bytes = f.files.get(path); const changed = Buffer.from(bytes); changed[0] ^= 1;
    f.files.set(path, changed);
    await assert.rejects(loadArticleMetadataSidecar(f.read), /integrity mismatch/);
  }
  const bytes = fixture(); bytes.files.set("article_metadata.jsonl", Buffer.concat([bytes.files.get("article_metadata.jsonl"), Buffer.from(" ")]));
  await assert.rejects(loadArticleMetadataSidecar(bytes.read), /integrity mismatch/);
  const missing = fixture(); missing.files.delete("exports/concepts.jsonl");
  await assert.rejects(loadArticleMetadataSidecar(missing.read), error => /Unable to read declared/.test(error.message) && !error.message.includes("credentials"));
  const f = fixture();
  await assert.rejects(loadArticleMetadataSidecar(f.read, { expectedManifestSha256: "0".repeat(64) }), /Manifest digest mismatch/);
  assert.equal((await loadArticleMetadataSidecar(f.read, { expectedManifestSha256: hash(f.files.get("manifest.json")) })).manifestTrust, "independently_pinned_digest");
});

test("exact UTF-8 hashing never normalizes Unicode, whitespace or null bodies; graph fingerprint cannot substitute", async () => {
  assert.equal(articleBodySha256(body), hash(body));
  assert.notEqual(articleBodySha256(body), hash(body.replaceAll("\r\n", "\n")));
  for (const value of [null, undefined, 1, {}, Buffer.from(body)]) assert.throws(() => articleBodySha256(value), /exact string/);
  const bundle = await loadArticleMetadataSidecar(fixture().read);
  for (const value of [null, undefined, 1, {}]) {
    const result = audit(bundle, [source(1, { body_markdown: value, source_sha256: hash(body), graph_fingerprint: hash(body) })]);
    assert.equal(result.inputs[0].state, "invalid_source");
    assert.equal(result.corpusMatches, false);
  }
  assert.equal(audit(bundle, [source(1, { body_markdown: body + " " })]).inputs[0].state, "stale");
});

test("full corpus finds deleted and new IDs, duplicate IDs, changed publication and missing publication", async () => {
  const bundle = await loadArticleMetadataSidecar(fixture([metadata(1), metadata(2)]).read);
  const result = audit(bundle, [source(1), source(3)]);
  assert.deepEqual(plain(result.inputs.map(row => [row.articleId, row.state])), [[id(1), "ready_for_review"], [id(2), "missing_source"], [id(3), "missing_metadata"]]);
  assert.equal(result.corpusMatches, false);
  assert.equal(audit(bundle, [source(1, { is_published: false }), source(2)]).inputs[0].state, "stale");
  assert.equal(audit(bundle, [source(1, { is_published: null }), source(2)]).inputs[0].state, "invalid_source");
  assert.throws(() => audit(bundle, [source(1), source(1)]), /Duplicate source/);
  assert.throws(() => audit(bundle, [source(1, { article_id: "not-a-uuid" })]), /Invalid source article ID/);
});

test("1,646 records are fully compared including change after the default 1,000-row database limit", async () => {
  const rows = Array.from({ length: 1646 }, (_, i) => metadata(i + 1));
  const bundle = await loadArticleMetadataSidecar(fixture(rows).read);
  const articles = rows.map((_, i) => source(i + 1));
  articles[1645].body_markdown += "changed";
  const result = audit(bundle, articles);
  assert.equal(result.metadataCount, 1646);
  assert.equal(result.sourceCount, 1646);
  assert.equal(result.inputs.length, 1646);
  assert.equal(result.counts.stale, 1);
  assert.equal(result.inputs[1645].state, "stale");
  assert.equal(audit(bundle, articles.slice(0, 1000)).counts.missing_source, 646);
});

test("gap flags are conservative even with contradictory empty/nonempty gaps; explicit block stays blocked", async () => {
  for (const patch of [
    { gaps: ["Needs dimensions"] },
    { quality_routing: { ...metadata().quality_routing, has_extraction_gaps: true } },
    { quality_routing: { ...metadata().quality_routing, requires_gap_review_before_matching: true } },
  ]) {
    const result = audit(await loadArticleMetadataSidecar(fixture([metadata(1, patch)]).read), [source()]);
    assert.equal(result.inputs[0].state, "gap_review_required");
    assert.equal(result.inputs[0].automaticPublicationAllowed, false);
  }
  const blocked = metadata(1, { gaps: ["Unsafe eyes"], quality_routing: { ...metadata().quality_routing, automatic_recommendation_blocked: true, reasons: ["safety concern"] } });
  const result = audit(await loadArticleMetadataSidecar(fixture([blocked]).read), [source()]);
  assert.equal(result.inputs[0].state, "blocked");
  assert.ok(result.inputs[0].reasons.includes("safety concern"));
  assert.ok(result.inputs[0].reasons.includes("Unsafe eyes"));
});

test("critical safety flags, roles and provenance cannot be omitted or coerced; permissive schema cannot bypass contract", async () => {
  for (const change of [
    row => { delete row.quality_routing; },
    row => { delete row.quality_routing.automatic_publication_allowed; },
    row => { row.quality_routing.automatic_publication_allowed = true; },
    row => { row.quality_routing.automatic_recommendation_blocked = "false"; },
    row => { row.quality_routing.has_extraction_gaps = null; },
    row => { row.quality_routing.requires_gap_review_before_matching = "false"; },
    row => { row.automatic_publication_allowed = true; },
    row => { row.materials[0].role = "compatible"; },
    row => { delete row.materials[0].specifications; },
    row => { row.projects[0].role = "required"; },
    row => { row.materials[0].evidence = null; },
    row => { row.materials[0].unverified_project_labels = "mandje"; },
    row => { row.source.is_published = 1; },
    row => { row.claim_scope = "externally_verified"; },
  ]) {
    const row = metadata(); change(row);
    await assert.rejects(loadArticleMetadataSidecar(fixture([row]).read), /safety contract/);
  }
});

test("malformed JSONL lines, embedded blanks, duplicates and manifest count mismatch are rejected", async () => {
  for (const text of [JSON.stringify(metadata()) + "\n{broken}\n", JSON.stringify(metadata()) + "\n\n" ]) {
    await assert.rejects(loadArticleMetadataSidecar(fixture([metadata()], { text }).read), /Malformed metadata JSON at line 2/);
  }
  await assert.rejects(loadArticleMetadataSidecar(fixture([metadata(), metadata()]).read), /Duplicate sidecar article/);
  await assert.rejects(loadArticleMetadataSidecar(fixture([metadata()], { text: [metadata(1), metadata(2)].map(JSON.stringify).join("\n") }).read), /article count mismatch/);
});

test("snapshot freshness is explicitly limited to capture time and source SHA, never graph fingerprint", async () => {
  const bundle = await loadArticleMetadataSidecar(fixture().read);
  const result = audit(bundle, [{ article_id: id(1), is_published: true, source_sha256: hash(body), graph_fingerprint: "a".repeat(32) }], { kind: "hash_snapshot", capturedAt: "2026-10-26T15:24:00Z" });
  assert.equal(result.inputs[0].state, "ready_for_review");
  assert.equal(result.sourceCapturedAt, "2026-10-26T15:24:00Z");
  assert.match(result.freshnessLimitation, /Snapshot-only/);
  assert.match(result.freshnessLimitation, /Re-read exact current bodies/);
  assert.equal(audit(bundle, [source(1, { source_sha256: null, graph_fingerprint: hash(body) })], { kind: "hash_snapshot" }).inputs[0].state, "invalid_source");
});

test("private Storage has a download-only capability, rejects traversal, sanitizes provider errors and never issues network mutations", async () => {
  const f = fixture(); const calls = [];
  const read = createStorageSidecarReader(async path => {
    calls.push(path);
    const bytes = f.files.get(path.replace("v1-2026-10-26/", ""));
    return { data: { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }, error: null };
  });
  const bundle = await loadArticleMetadataSidecar(read);
  assert.equal(bundle.articles.length, 1);
  assert.deepEqual(calls, ["manifest.json", ...Object.keys(f.manifest.files)].map(path => `v1-2026-10-26/${path}`));
  for (const path of ["../secret", "/secret", "exports/../../secret", "x?token=secret", "x\\secret"]) await assert.rejects(read(path), /Invalid sidecar file path/);
  assert.equal(calls.length, 4);
  const bad = createStorageSidecarReader(async () => { throw new Error("token=private-secret"); });
  await assert.rejects(bad("manifest.json"), error => error.message === "Private sidecar download failed");
  const malicious = fixture(); malicious.manifest.files["../secret"] = { bytes: 0, sha256: hash("") }; malicious.files.set("manifest.json", Buffer.from(JSON.stringify(malicious.manifest)));
  await assert.rejects(loadArticleMetadataSidecar(malicious.read), /Invalid sidecar file path/);
  assert.ok(!malicious.reads.includes("../secret"));
  assert.deepEqual(forbidden, []);
});

async function onDisk(fn) {
  const dir = await mkdtemp(resolve(tmpdir(), "graph-sidecar-"));
  const f = fixture(); const bundleDir = resolve(dir, "bundle"); await mkdir(bundleDir);
  for (const [name, bytes] of f.files) { await mkdir(dirname(resolve(bundleDir, name)), { recursive: true }); await writeFile(resolve(bundleDir, name), bytes); }
  const hashes = resolve(dir, "hashes.json"); await writeFile(hashes, JSON.stringify([source(1, { source_sha256: hash(body) })]));
  const run = (args, importOnly = false) => new Promise((done, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--import", resolver, ...(importOnly ? ["--input-type=module", "-e", `import ${JSON.stringify(new URL(`file://${script}`).href)}`] : [script, ...args])], { cwd: dir, env: { PATH: process.env.PATH, NODE_NO_WARNINGS: "1" } });
    let stdout = "", stderr = ""; child.stdout.on("data", data => stdout += data); child.stderr.on("data", data => stderr += data); child.on("error", reject); child.on("exit", code => done({ code, stdout, stderr }));
  });
  try { await fn({ dir, bundleDir, hashes, run }); } finally { await rm(dir, { recursive: true, force: true }); }
}
test("local reader rejects a symlink escape", async () => onDisk(async ({ dir, bundleDir }) => {
  await writeFile(resolve(dir, "secret"), "private"); await symlink(resolve(dir, "secret"), resolve(bundleDir, "escape.json"));
  await assert.rejects(createLocalSidecarReader(bundleDir)("escape.json"), /escapes bundle root/);
}));
test("real CLI import is inert, strict arguments reject --write, detailed report is optional and cannot overwrite inputs", async () => onDisk(async ({ dir, bundleDir, hashes, run }) => {
  assert.deepEqual(await run([], true), { code: 0, stdout: "", stderr: "" });
  assert.equal((await run(["--help"])).code, 0);
  for (const args of [["--write"], ["--approve"], ["--bundle-dir"], ["--bundle-dir", bundleDir, "--article-hashes", hashes, "--write"], ["--bundle-dir", bundleDir, "--bundle-dir", bundleDir]]) {
    const r = await run(args); assert.equal(r.code, 1); assert.equal(r.stdout, "");
  }
  const args = ["--bundle-dir", bundleDir, "--article-hashes", hashes];
  const r = await run(args); assert.equal(r.code, 0, r.stderr); const summary = JSON.parse(r.stdout); assert.equal(summary.reviewInputCount, 1); assert.equal(summary.sourceCapturedAt, null); assert.equal(summary.reportWritten, false); assert.equal(summary.inputs, undefined);
  const out = resolve(dir, "review.json"); const detailed = await run([...args, "--out", out]); assert.equal(detailed.code, 0, detailed.stderr);
  const saved = JSON.parse(await readFile(out, "utf8")); assert.equal(saved.inputs[0].automaticPublicationAllowed, false); assert.deepEqual(saved.inputs[0].metadata.materials, metadata().materials);
  assert.equal((await run([...args, "--out", out])).code, 1, "Existing files cannot be overwritten");
  assert.equal((await run([...args, "--out", hashes])).code, 1);
  await writeFile(hashes, JSON.stringify({ captured_at: "2026-10-26T15:24:00Z", articles: [source(1, { source_sha256: hash(body) })] }));
  const captured = await run(args); assert.equal(captured.code, 0, captured.stderr); assert.equal(JSON.parse(captured.stdout).sourceCapturedAt, "2026-10-26T15:24:00Z");
  await writeFile(hashes, JSON.stringify({ captured_at: "invalid", articles: [source(1, { source_sha256: hash(body) })] }));
  assert.equal((await run(args)).code, 1, "Invalid caller capture time fails closed");
  await writeFile(hashes, JSON.stringify([{ ...source(), source_sha256: hash("stale") }]));
  const stale = await run(args); assert.equal(stale.code, 1); assert.equal(JSON.parse(stale.stdout).counts.stale, 1);
}));
