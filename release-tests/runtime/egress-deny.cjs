'use strict';
// Integration fixture sandbox, NOT Stripe verification. Docker internal network
// supplies the independent kernel-level boundary, including native addons.
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const allowed = new Set(['localhost', '127.0.0.1', '::1', 'pg', 'redis', 'app']);
function check(host) {
  const h = String(host || 'localhost').toLowerCase().replace(/^\[|\]$/g, '');
  if (!allowed.has(h)) throw new Error('CI_EGRESS_DENIED');
}
function inspect(args) {
  const a = args[0];
  if (typeof a === 'object') {
    if (a.path) throw new Error('CI_UNIX_SOCKET_DENIED');
    check(a.host || a.hostname);
  } else if (typeof a === 'string' && !/^\d+$/.test(a)) {
    throw new Error('CI_UNIX_SOCKET_DENIED');
  } else check(typeof args[1] === 'string' ? args[1] : 'localhost');
}
for (const key of ['connect', 'createConnection']) {
  const original = net[key];
  net[key] = function (...args) { inspect(args); return original.apply(this, args); };
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  if (Array.isArray(args[0])) inspect(args[0]); else inspect(args);
  return connect.apply(this, args);
};
const tlsConnect = tls.connect;
tls.connect = function (...args) { inspect(args); return tlsConnect.apply(this, args); };
for (const key of ['lookup', 'resolve', 'resolve4', 'resolve6']) {
  const original = dns[key];
  dns[key] = function (host, ...args) { check(host); return original.call(this, host, ...args); };
}
for (const key of ['lookup', 'resolve', 'resolve4', 'resolve6']) {
  const original = dns.promises[key];
  dns.promises[key] = async function (host, ...args) { check(host); return original.call(this, host, ...args); };
}
const http = require('node:http'), https = require('node:https');
for (const mod of [http, https]) for (const key of ['request', 'get']) {
  const original = mod[key];
  mod[key] = function (...args) {
    const a = args[0];
    check(typeof a === 'string' || a instanceof URL ? new URL(a).hostname : a.hostname || a.host);
    return original.apply(this, args);
  };
}
if (globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = function (input, ...args) { check(new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname); return original.call(this, input, ...args); };
}
module.exports = { check, inspect };
