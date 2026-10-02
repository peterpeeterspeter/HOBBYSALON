import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

// Real, lockfile-pinned numeric code only. No arithmetic substitutes and no downloads.
// With no installed dependencies, point MEDUSA_NUMERIC_REFERENCE_DIR at the extracted
// @medusajs/utils@2.11.3 package root; bignumber.js@9.3.1 must resolve from that root.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const tryResolve = (require, name) => {
  try { return require.resolve(name) } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error
  }
}
function installedUtilsRoot() {
  for (const workspace of ['', 'apps/backend', 'packages/framework',
    'packages/modules/b2c-core', 'packages/modules/payment-stripe-connect']) {
    const require = createRequire(resolve(repoRoot, workspace, 'package.json'))
    const framework = tryResolve(require, '@medusajs/framework/utils')
    const resolvers = framework ? [createRequire(framework), require] : [require]
    for (const resolver of resolvers) {
      const entry = tryResolve(resolver, '@medusajs/utils')
      if (entry) return resolve(dirname(entry), '..') // pinned main: dist/index.js
    }
  }
  throw new Error('No installed @medusajs/utils found in the commerce workspaces')
}

export function loadMedusaNumeric(referenceDir = process.env.MEDUSA_NUMERIC_REFERENCE_DIR) {
  try {
    // An explicit reference is authoritative; a broken reference must fail, not fall back.
    const root = referenceDir ? resolve(referenceDir) : installedUtilsRoot()
    const require = createRequire(resolve(root, 'package.json'))
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    const bnPkg = require('bignumber.js/package.json')
    if (pkg.name !== '@medusajs/utils' || pkg.version !== '2.11.3' || bnPkg.version !== '9.3.1') {
      throw new Error(`Expected @medusajs/utils@2.11.3 and bignumber.js@9.3.1; got ${pkg.name}@${pkg.version} and ${bnPkg.version}`)
    }
    const bigNumberModule = require('./dist/totals/big-number.js')
    const bigNumberJSModule = require('bignumber.js')
    const isDefinedModule = require('./dist/common/is-defined.js')
    const filename = resolve(root, 'dist/totals/math.js')
    const module = { exports: {} }
    // Execute the unchanged MathBN CommonJS source. Its only common-barrel use is
    // isDefined: route that exact import to the real leaf, not unrelated ORM deps.
    const imports = new Map([
      ['bignumber.js', bigNumberJSModule],
      ['./big-number', bigNumberModule],
      ['../common', isDefinedModule],
    ])
    vm.runInNewContext(readFileSync(filename, 'utf8'), {
      module, exports: module.exports,
      require: (id) => {
        if (!imports.has(id)) throw new Error(`Unexpected MathBN import: ${id}`)
        return imports.get(id)
      },
    }, { filename })
    const { BigNumber } = bigNumberModule
    const { MathBN } = module.exports
    if (typeof BigNumber !== 'function' || typeof MathBN?.eq !== 'function') {
      throw new Error('Real BigNumber/MathBN exports are missing')
    }
    return {
      BigNumber, MathBN, BigNumberJS: bigNumberJSModule.BigNumber,
      numericSource: { root, medusaVersion: pkg.version, bigNumberJSVersion: bnPkg.version },
    }
  } catch (cause) {
    throw new Error('Real Medusa numeric dependency required. Install the lockfile dependencies or set MEDUSA_NUMERIC_REFERENCE_DIR to an @medusajs/utils@2.11.3 package root with bignumber.js@9.3.1 resolvable. No mock fallback is permitted.', { cause })
  }
}
