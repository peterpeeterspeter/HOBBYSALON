#!/usr/bin/env node
'use strict';
// Offline, dependency-free Yarn Classic audit. Metadata parity is not byte-level
// package provenance; the frozen registry install remains the acquisition gate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = m => { throw new Error(m); };
function lockEntries(text) {
  if (!text.includes('# yarn lockfile v1')) fail('Expected Yarn Classic v1 lock');
  const out = {}; let current = [];
  for (const line of text.split('\n')) {
    if (/^[^\s#].*:$/.test(line)) {
      current = (line.slice(0, -1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g) || [])
        .map(s => s.trim()).filter(Boolean).map(s => s.startsWith('"') ? JSON.parse(s) : s);
      for (const k of current) { if (out[k]) fail('Duplicate selector: ' + k); out[k] = {}; }
    } else {
      const m = line.match(/^  (version|resolved|integrity) (.+)$/);
      if (m) for (const k of current) out[k][m[1]] = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2];
    }
  }
  for (const [k, e] of Object.entries(out)) if (!e.version || !e.resolved) fail('Incomplete selector: ' + k);
  return out;
}
function workspaces(root) {
  const list = [];
  for (const parent of ['apps', 'packages', 'packages/modules']) {
    const dir = path.join(root, parent); if (!fs.existsSync(dir)) continue;
    for (const child of fs.readdirSync(dir).sort()) {
      const rel = parent + '/' + child + '/package.json';
      if (fs.existsSync(path.join(root, rel))) list.push([rel, json(path.join(root, rel))]);
    }
  }
  return list;
}
const excluded = new Set(['node_modules', '.git', '.medusa', 'dist', '.turbo', '.next', '.cache', 'out', 'build', 'coverage']);
function snapshot(root) {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, {withFileTypes: true}).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (excluded.has(e.name) || e.name.startsWith('.env') || e.name.endsWith('.tsbuildinfo')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push({path: path.relative(root, p), sha256: hash(fs.readFileSync(p))});
      else if (e.isSymbolicLink()) files.push({path: path.relative(root, p), symlink: fs.readlinkSync(p)});
    }
  }
  walk(root); return {schema: 2, files};
}
function audit(root, mode, metadataRoot = root) {
  const lockBytes = fs.readFileSync(path.join(root, 'yarn.lock'));
  const entries = lockEntries(lockBytes.toString()); const work = workspaces(root);
  const manifests = [['package.json', json(path.join(root, 'package.json'))], ...work];
  const internal = new Map(work.map(([rel,p]) => [p.name, {rel, version:p.version}]));
  const missing = []; const direct = [];
  for (const [rel,p] of manifests) for (const kind of ['dependencies','devDependencies','optionalDependencies']) {
    for (const [name,range] of Object.entries(p[kind] || {})) {
      if (internal.has(name)) {
        if (range !== '*' && range !== internal.get(name).version) missing.push({rel,name,range,reason:'Review workspace range'});
      } else {
        const selector = name + '@' + range;
        if (!entries[selector]) missing.push({rel,name,range,reason:'Missing root-lock selector'});
        direct.push({rel,name,selector,optional:kind === 'optionalDependencies'});
      }
    }
  }
  const backend = work.find(([rel]) => rel === 'apps/backend/package.json')?.[1];
  const required = ['@medusajs/payment', '@medusajs/notification', 'knex'];
  const undeclared = required.filter(n => !backend?.dependencies?.[n]);
  const tooling = [['turbo','package.json'],['ts-node','apps/backend/package.json'],['typescript','apps/backend/package.json']]
    .map(([name,rel]) => { const p = manifests.find(([r]) => r === rel)?.[1];
      const range = p?.devDependencies?.[name]; return {name,manifest:rel,range:range || null,locked:entries[name+'@'+range]?.version || null}; });
  const problems = [...missing.map(v => 'selector:'+v.name), ...undeclared.map(n => 'undeclared:'+n)];
  for (const t of tooling) if (!t.locked) problems.push('tooling:'+t.name);
  const rootPackage = manifests[0][1];
  if (rootPackage.packageManager !== 'yarn@1.22.21') problems.push('Review packageManager: pinned recipe expects yarn@1.22.21');
  const resolutionDrift = [];
  for (const [pattern, version] of Object.entries(rootPackage.resolutions || {})) {
    // Yarn glob path prefixes scope which subtree is overridden. The final
    // dependency's exact selector still must exist and retain the requested pin.
    const parts = pattern.split('/');
    const name = parts.length > 1 && parts[parts.length-2].startsWith('@')
      ? parts.slice(-2).join('/') : parts[parts.length-1];
    const entry = entries[name+'@'+version];
    if (!entry || entry.version !== version) resolutionDrift.push({pattern,version,actual:entry?.version || null});
  }
  for (const d of resolutionDrift) problems.push('resolution:'+d.pattern);
  const summary = {schema:2,mode,root_lock_sha256:hash(lockBytes),lock_selector_count:Object.keys(entries).length,
    manifests:manifests.map(([rel]) => ({path:rel,sha256:hash(fs.readFileSync(path.join(root,rel)))})),
    missing_selectors:missing,required_direct_dependencies_missing:undeclared,tooling,resolution_drift:resolutionDrift,problems};
  if (!['installed','installed-cache'].includes(mode)) return summary;
  const integrity = json(path.join(metadataRoot,'node_modules/.yarn-integrity'));
  const drift = [];
  if (!integrity.lockfileEntries || !Object.keys(integrity.lockfileEntries).length) drift.push({reason:'Empty Yarn lock evidence'});
  for (const [selector,resolved] of Object.entries(integrity.lockfileEntries || {})) {
    if (!entries[selector] || entries[selector].resolved !== resolved) drift.push({selector,installed_resolved:resolved,root_resolved:entries[selector]?.resolved || null});
  }
  const coverage = new Set(Object.entries(entries).map(([s,e]) => s.slice(0,s.lastIndexOf('@'))+'@'+e.version));
  const packages = []; const uncovered = []; const symlinks = []; const seen = new Set();
  function visitModules(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.startsWith('.')) continue;
      if (name.startsWith('@')) for (const sub of fs.readdirSync(path.join(dir,name)).sort()) visit(path.join(dir,name,sub));
      else visit(path.join(dir,name));
    }
  }
  function visit(dir) {
    if (fs.lstatSync(dir).isSymbolicLink()) {
      const target = path.resolve(path.dirname(dir),fs.readlinkSync(dir));
      if (!fs.existsSync(target) || !work.some(([rel]) => path.join(metadataRoot,path.dirname(rel)) === target)) symlinks.push({path:path.relative(metadataRoot,dir),target,reason:'Non-workspace or broken link'});
      return;
    }
    const file = path.join(dir,'package.json'); if (!fs.existsSync(file) || seen.has(dir)) return; seen.add(dir);
    const p = json(file); const key = p.name+'@'+p.version;
    if (!coverage.has(key)) uncovered.push({path:path.relative(metadataRoot,dir),package:key});
    packages.push({path:path.relative(metadataRoot,dir),name:p.name,version:p.version,package_json_sha256:hash(fs.readFileSync(file))});
    visitModules(path.join(dir,'node_modules'));
  }
  visitModules(path.join(metadataRoot,'node_modules'));
  for (const [rel] of work) visitModules(path.join(metadataRoot,path.dirname(rel),'node_modules'));
  const directDrift = [];
  for (const d of direct) {
    let dir = path.join(metadataRoot,path.dirname(d.rel)); let found;
    while (dir.startsWith(metadataRoot)) {
      const file = path.join(dir,'node_modules',d.name,'package.json');
      if (fs.existsSync(file)) { found = json(file); break; }
      if (dir === metadataRoot) break; dir = path.dirname(dir);
    }
    if (!found && d.optional) continue;
    const expected = entries[d.selector]?.version;
    if (!found || found.version !== expected || found.name !== d.name) directDrift.push({...d,expected,actual:found?.version || null});
    if (!integrity.lockfileEntries?.[d.selector]) directDrift.push({...d,reason:'Required selector absent from installed lock metadata'});
  }
  Object.assign(summary,{yarn_integrity_sha256:hash(fs.readFileSync(path.join(metadataRoot,'node_modules/.yarn-integrity'))),
    yarn_integrity_flags:integrity.flags,installed_package_count:packages.length,packages,
    installed_lock_drift:drift,direct_dependency_drift:directDrift,uncovered_installed_packages:uncovered,invalid_package_links:symlinks});
  summary.parity_pass = !problems.length && !drift.length && !directDrift.length && !uncovered.length && !symlinks.length;
  // Cache diagnostics must NEVER become release acceptance, even if metadata matches.
  summary.release_acceptance = mode === 'installed' && summary.parity_pass;
  return summary;
}
function main() {
  const mode = process.argv[2] || 'preflight'; const root = path.resolve(process.argv[3] || '/app');
  if (mode === 'snapshot') { console.log(JSON.stringify(snapshot(root),null,2)); return; }
  if (mode === 'unchanged') {
    const before = json(process.argv[4]); const after = snapshot(root);
    // Build output is ignored; additions elsewhere (including nested lockfiles) fail.
    if (JSON.stringify(before) !== JSON.stringify(after)) fail('Source/manifests/lock changed after frozen install or build');
    console.log(JSON.stringify({unchanged:true,source_sha256:hash(fs.readFileSync(process.argv[4]))})); return;
  }
  if (!['preflight','diagnose','installed','installed-cache'].includes(mode)) fail('Unknown mode: '+mode);
  const result = audit(root,mode,path.resolve(process.argv[4] || root)); console.log(JSON.stringify(result,null,2));
  if (mode !== 'diagnose' && mode !== 'installed-cache' && (result.problems.length || result.release_acceptance === false)) process.exitCode = 2;
}
module.exports = {lockEntries,workspaces,snapshot,audit};
if (require.main === module) try { main(); } catch (e) { console.error(JSON.stringify({error:e.message})); process.exitCode = 2; }