'use strict'
// Public failed-case fields are finite enums and one fixture file/line, never error text.
const path = require('node:path')
const names = new Set(require('./inventory.json').cases)
const CODE_CLASSES = Object.freeze({
  ERR_ASSERTION: 'ASSERTION',
  MODULE_NOT_FOUND: 'NODE_ERROR', ERR_PACKAGE_PATH_NOT_EXPORTED: 'NODE_ERROR',
  ENOENT: 'NODE_ERROR', EACCES: 'NODE_ERROR', ECONNREFUSED: 'NODE_ERROR', ETIMEDOUT: 'NODE_ERROR',
  '23503': 'POSTGRES_CONSTRAINT', '23505': 'POSTGRES_CONSTRAINT', '23514': 'POSTGRES_CONSTRAINT',
  '40001': 'POSTGRES_CONCURRENCY', '40P01': 'POSTGRES_CONCURRENCY', '57014': 'POSTGRES_CANCELLED',
  UNCLASSIFIED: 'UNCLASSIFIED'
})
const OPERATORS = Object.freeze(['strictEqual', 'notStrictEqual', 'deepStrictEqual', '==', 'rejects', 'throws'])
const escapedFile = path.join(__dirname, 'acceptance.cjs').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const frame = new RegExp('^\\s+at (?:.* \\()?'+escapedFile+':([1-9][0-9]*):[1-9][0-9]*\\)?$')
function failedCase(name, error) {
  if (!names.has(name)) throw Error('failed-case inventory mismatch')
  const code = typeof error?.code === 'string' && Object.hasOwn(CODE_CLASSES, error.code) ? error.code : 'UNCLASSIFIED'
  const operator = code === 'ERR_ASSERTION' && OPERATORS.includes(error?.operator) ? error.operator : null
  let stack = null
  // Ignore the message (first line), candidate/dependency paths, values, and columns.
  if (typeof error?.stack === 'string') for (const line of error.stack.split('\n').slice(1)) {
    const match = frame.exec(line)
    if (match && Number.isSafeInteger(Number(match[1]))) {
      stack = {file: 'acceptance.cjs', line: Number(match[1])}; break
    }
  }
  return {name, status: 'failed', classification: CODE_CLASSES[code], code, operator, stack}
}
module.exports = {failedCase, CODE_CLASSES, OPERATORS}