'use strict';
// Deny-only API observer, NOT a sandbox. The shared network=none namespace is
// the transport fence. Native addons/child processes are not exhaustively traced.
// No redirects, mocks, credentials, or replacement success responses.
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const dgram = require('node:dgram');
const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const trace = process.env.HS_GATE_TRACE || '/tmp/gate-egress.jsonl';
const local = new Set(['127.0.0.1', '::1', 'localhost']);
const ports = new Set([5432, 6379, 9000]);
function emit(event, kind) {
  // Do not record URLs, hosts, paths, query strings, credentials or other inputs.
  const row = JSON.stringify({event, kind, pid: process.pid, at: new Date().toISOString()}) + '\n';
  const fd = fs.openSync(trace, fs.constants.O_WRONLY | fs.constants.O_CREAT |
    fs.constants.O_APPEND | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeSync(fd, row); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (event === 'denied') process.stderr.write('GATE_EGRESS_DENIED ' + row);
}
function deny(kind) {
  emit('denied', kind);
  throw Object.assign(new Error('Gate denies transport: ' + kind), {code: 'GATE_EGRESS_DENIED'});
}
function hostOf(host) { return String(host == null ? 'localhost' : host).replace(/^\[([^\]]+)\]$/, '$1'); }
function check(kind, host, port, path) {
  if (path !== undefined && path !== null) deny(kind + '.unix');
  if (!local.has(hostOf(host)) || !ports.has(Number(port))) deny(kind);
}
function socketArgs(args) {
  let a = args;
  // Node internally passes the normalized [options, callback] tuple.
  if (Array.isArray(a[0])) a = a[0];
  const first = a[0];
  if (first && typeof first === 'object') return first;
  if (typeof first === 'string' && !/^\d+$/.test(first)) return {path: first};
  return {port: first, host: typeof a[1] === 'string' ? a[1] : 'localhost'};
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const o = socketArgs(args); check('net.connect', o.host, o.port, o.path);
  return connect.apply(this, args);
};
const tlsConnect = tls.connect;
tls.connect = function (...args) {
  const o = Object.assign({}, socketArgs(args));
  for (const a of args.slice(1)) if (a && typeof a === 'object') Object.assign(o, a);
  if (o.socket) check('tls.socket', o.socket.remoteAddress, o.socket.remotePort);
  else check('tls.connect', o.host || o.servername, o.port, o.path);
  return tlsConnect.apply(this, args);
};
function requestOptions(args, scheme) {
  const a = args[0]; let o;
  if (typeof a === 'string' || a instanceof URL) {
    const u = a instanceof URL ? a : new URL(a);
    if (!['http:', 'https:'].includes(u.protocol)) deny('http.protocol');
    o = {hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80)};
    if (args[1] && typeof args[1] === 'object') Object.assign(o, args[1]);
  } else o = Object.assign({}, a);
  if (o.socketPath != null) deny('http.unix');
  // http.request's "path" is a URL path, not a Unix socket path.
  check('http.request', o.hostname || o.host, o.port || (scheme === 'https:' ? 443 : 80));
}
for (const [mod, scheme] of [[http, 'http:'], [https, 'https:']]) {
  for (const name of ['request', 'get']) {
    const original = mod[name];
    mod[name] = function (...args) { requestOptions(args, scheme); return original.apply(this, args); };
  }
}
const h2connect = http2.connect;
http2.connect = function (authority, options, ...args) {
  const u = authority instanceof URL ? authority : new URL(authority);
  if (!['http:', 'https:'].includes(u.protocol) || options && options.createConnection) deny('http2.custom');
  check('http2.connect', u.hostname, u.port || (u.protocol === 'https:' ? 443 : 80));
  return h2connect.call(this, authority, options, ...args);
};
if (globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = function (input, ...args) {
    // Preserve native URL/string/Request behavior for permitted loopback URLs.
    const value = input instanceof URL ? input : typeof input === 'string' ? input : input && input.url;
    const u = value instanceof URL ? value : new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) deny('fetch.protocol');
    check('fetch', u.hostname, u.port || (u.protocol === 'https:' ? 443 : 80));
    return original.call(this, input, ...args);
  };
}
// Cover callback, promise and Resolver-instance APIs. Only OS lookup of exact
// local hosts is permitted; DNS wire queries (even localhost resolve) are denied.
const names = ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny',
  'resolveCname', 'resolveMx', 'resolveNs', 'resolveTxt', 'resolveSrv', 'resolvePtr',
  'resolveNaptr', 'resolveSoa', 'resolveCaa', 'reverse', 'setServers'];
function guardDNS(target, prefix) {
  if (!target) return;
  for (const name of names) {
    if (typeof target[name] !== 'function') continue;
    const original = target[name];
    target[name] = function (host, ...args) {
      if (name !== 'lookup' || !local.has(hostOf(host))) deny(prefix + '.' + name);
      return original.call(this, host, ...args);
    };
  }
}
guardDNS(dns, 'dns');
guardDNS(dns.promises, 'dns.promises');
guardDNS(dns.Resolver && dns.Resolver.prototype, 'dns.Resolver');
guardDNS(dns.promises && dns.promises.Resolver && dns.promises.Resolver.prototype, 'dns.promises.Resolver');
for (const name of ['send', 'connect']) dgram.Socket.prototype[name] = function () { return deny('udp.' + name); };
// Update ESM named builtin exports too; no assertion of complete native coverage.
require('node:module').syncBuiltinESMExports();
emit('active', 'deny-only-observer');
process.stderr.write('GATE_DENY_ONLY_ACTIVE\n');
