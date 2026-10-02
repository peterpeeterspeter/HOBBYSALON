'use strict'
// Dependency-backed noEmit check, not a production build. Candidate package source
// and framework types are mounted read-only; installed third-party declarations
// come from the explicitly pinned audit image. Never starts the application.
const ts = require('typescript')
const fs = require('node:fs')
const crypto = require('node:crypto')
const base = '/app/apps/backend'
const kind = process.argv[2] || 'b2c'
const roots = { b2c: 'audit-src', requests: 'audit-requests', framework: 'audit-framework' }
if (!roots[kind]) throw new Error('Unknown package')
const root = `${base}/${roots[kind]}`
const config = ts.readConfigFile(`${base}/audit-${kind}-tsconfig.json`, ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
parsed.options.noEmit = true
parsed.options.rootDir = base
parsed.options.incremental = false
parsed.options.baseUrl = base
parsed.options.paths = {
  '@mercurjs/framework': [`${base}/audit-framework/index.ts`],
  '@mercurjs/b2c-core/workflows': [`${base}/audit-src/workflows/index.ts`],
}
if (kind === 'framework') parsed.fileNames = ts.sys.readDirectory(root, ['.ts', '.tsx'], ['**/node_modules/**'], ['**/*'])
console.log(JSON.stringify({ kind, compiler: ts.version, root_files: parsed.fileNames.length, start: true }))
const program = ts.createProgram(parsed.fileNames, parsed.options)
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].map(d => {
  const position = d.file && typeof d.start === 'number' ? d.file.getLineAndCharacterOfPosition(d.start) : null
  return { file: d.file?.fileName, line: position ? position.line + 1 : null, code: d.code,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }
})
const source_hashes = Object.fromEntries(program.getSourceFiles().filter(f => f.fileName.startsWith(`${base}/audit-`)).map(f => [f.fileName, crypto.createHash('sha256').update(fs.readFileSync(f.fileName)).digest('hex')]))
console.log('TYPECHECK_JSON=' + JSON.stringify({ kind, compiler: ts.version, roots: parsed.fileNames, diagnostics, source_hashes, memory: process.memoryUsage(), limitations: ['No emit or application startup', 'Third-party declarations from pinned dependency image', 'Candidate framework and b2c workflow aliases used explicitly', 'Not a storefront or all-monorepo production build'] }))
process.exitCode = diagnostics.length ? 1 : 0
