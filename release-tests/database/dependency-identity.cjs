'use strict'
// Explicit exported entry, not a root-entry fallback or version/identity waiver.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const specifier = name => name === '@medusajs/deps' ? '@medusajs/deps/mikro-orm/core' : name
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
function identity(dep, name, expectedVersion) {
  const entry = fs.realpathSync(dep.resolve(specifier(name)))
  let dir = path.dirname(entry)
  while (dir !== path.dirname(dir)) {
    const file = path.join(dir, 'package.json')
    if (fs.existsSync(file)) {
      const bytes = fs.readFileSync(file), manifest = JSON.parse(bytes)
      if (manifest.name === name) {
        assert.equal(manifest.version, expectedVersion, 'native package version: ' + name)
        return {version: manifest.version, package_json: fs.realpathSync(file), package_sha256: hash(bytes),
          entry, entry_sha256: hash(fs.readFileSync(entry))}
      }
    }
    dir = path.dirname(dir)
  }
  throw Error('native package root unavailable: ' + name)
}
const STAGES = Object.freeze(['PG_DEPENDENCY_IDENTITIES', 'PG_NATIVE_INVENTORY', 'PG_IDENTITY_EDGES',
  'PG_NATIVE_CONSTRUCTORS', 'PG_CANDIDATE_HELPERS', 'PG_CANDIDATE_MIGRATIONS', 'PG_CASE_INVENTORY',
  'PG_OBSERVER_CONNECT', 'PG_RUNTIME_METADATA', 'PG_TEST_EXECUTION', 'PG_PREFLIGHT_COMPLETE', 'PG_NODE_COMPLETE'])
const errorCode = error => ['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_ASSERTION', 'ENOENT',
  'EACCES', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code) ? error.code : 'UNCLASSIFIED'
module.exports = {specifier, identity, STAGES, errorCode}
