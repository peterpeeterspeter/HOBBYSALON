'use strict';
// Observe actual awaited native/index hooks in the application process; no product edits.
const Module = require('node:module');
const fs = require('node:fs');
const load = Module._load;
const wrapped = Symbol('ciIndexObserved');
Module._load = function (request, parent, main) {
  const result = load.apply(this, arguments);
  let filename;
  try { filename = Module._resolveFilename(request, parent); } catch { return result; }
  if (!/index-runtime-readonly\/service\.js$|@medusajs\/index\/dist\/services\/index-module-service\.js$/.test(filename)) return result;
  for (const Service of [result, result.default, result.IndexModuleService]) {
    const proto = Service?.prototype;
    if (!proto || !Object.hasOwn(proto, 'onApplicationStart_') || Object.hasOwn(proto, wrapped)) continue;
    Object.defineProperty(proto, wrapped, { value: true });
    const original = proto.onApplicationStart_;
    proto.onApplicationStart_ = async function (...args) {
      let loggedError = false;
      const descriptor = Object.getOwnPropertyDescriptor(this, 'logger_');
      const logger = this.logger_;
      Object.defineProperty(this, 'logger_', { configurable: true, get: () => new Proxy(logger, {
        get(target, key) {
          if (key === 'error') return (...values) => { loggedError = true; return target.error(...values); };
          return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
        }
      }) });
      try {
        const value = await original.apply(this, args);
        if (loggedError) throw new Error('CI_INDEX_LOGGED_STARTUP_ERROR');
        const dir = '/app/apps/backend/.medusa/server/.medusa/types';
        if (!fs.statSync(dir).isDirectory() || fs.readdirSync(dir).length === 0) throw new Error('CI_INDEX_TYPES_OUTPUT_MISSING');
        const kind = /index-runtime-readonly/.test(filename) ? 'readonly' : 'native';
        console.log(JSON.stringify({ marker: 'CI_INDEX_INIT_COMPLETE', kind, pid: process.pid, at: new Date().toISOString() }));
        return value;
      } catch (error) {
        console.error('CI_INDEX_INIT_FAILED');
        throw error;
      } finally {
        if (descriptor) Object.defineProperty(this, 'logger_', descriptor); else delete this.logger_;
      }
    };
  }
  return result;
};
