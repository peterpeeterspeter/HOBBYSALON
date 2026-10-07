'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
(async () => {
  for (const loggedError of [false, true]) {
    const messages = [];
    class Service {
      get logger_() { return { error() {} }; }
      async onApplicationStart_() { if (loggedError) this.logger_.error('native caught failure'); return 42; }
    }
    const exports = { IndexModuleService: Service };
    const Module = { _load() { return exports; }, _resolveFilename() { return '/app/node_modules/@medusajs/index/dist/services/index-module-service.js'; } };
    const fakeFs = { statSync() { return { isDirectory: () => true }; }, readdirSync() { return ['index.d.ts']; } };
    vm.runInNewContext(fs.readFileSync(__dirname + '/init-observer.cjs', 'utf8'), {
      require(n) { return n === 'node:module' ? Module : fakeFs; }, process: { pid: 7 }, console: { log(s) { messages.push(s); }, error() {} }
    });
    Module._load('native');
    if (loggedError) {
      await assert.rejects(new Service().onApplicationStart_(), { message: 'CI_INDEX_LOGGED_STARTUP_ERROR' });
      assert.equal(messages.length, 0);
    } else {
      assert.equal(await new Service().onApplicationStart_(), 42);
      assert.equal(JSON.parse(messages[0]).marker, 'CI_INDEX_INIT_COMPLETE');
      assert.equal(JSON.parse(messages[0]).kind, 'native');
    }
  }
  let barrier = false;
  await assert.rejects((async () => { barrier = true; throw Error('intentional fixture rollback'); })(), { message: 'intentional fixture rollback' });
  assert.equal(barrier, true);
  await assert.rejects(assert.rejects(Promise.reject(Error('wrong earlier failure')), { message: 'intentional fixture rollback' }));
  console.log('PASS: observer completion, caught-error refusal, exact rollback error/barrier (offline mocks only)');
})().catch(e => { console.error(e); process.exitCode = 1; });
