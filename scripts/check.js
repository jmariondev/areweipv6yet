#!/usr/bin/env node
// IPv6 checker.
//
// Default (DNS mode, runs anywhere): AAAA on apex/www, plus whether any MX
// host and any NS host of the zone has an AAAA record.
//
// --http (only from an IPv6-capable machine): HEAD request over an IPv6
// socket to apex/www. Advisory — it annotates but never demotes a service.
//
// Flags: --only id[,id...]  --verbose
import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';
import yaml from 'js-yaml';
import { variantsOf } from './lib/domains.js';
import { hasAAAA, mxHosts, nsHosts } from './lib/dns.js';
import { loadResults, mergeRun, saveResults, REMOVE } from './lib/results.js';
import { deriveStatus } from './lib/derive.js';

const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const verbose = args.includes('--verbose');
const only = args.includes('--only')
  ? (args[args.indexOf('--only') + 1] ?? '').split(',').filter(Boolean)
  : null;

function log(...parts) {
  if (verbose) console.log(...parts);
}

function hasGlobalIPv6() {
  // Global unicast is 2000::/3 — link-local (fe80) and ULA (fd00) don't count.
  return Object.values(os.networkInterfaces()).flat().some(
    (a) => a.family === 'IPv6' && !a.internal && /^[23]/.test(a.address)
  );
}

// Any HTTP response over an IPv6 socket counts as reachable; certificates
// are not the question being asked (apex SNI mismatches are common).
function headOverIPv6(hostname) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, family: 6, method: 'HEAD', path: '/', timeout: 8000, rejectUnauthorized: false },
      (res) => {
        res.resume();
        resolve(true);
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => {
      log(`    ${hostname}: ${err.message}`);
      resolve(false);
    });
    req.end();
  });
}

async function anyHostHasAAAA(hosts) {
  for (const host of hosts) {
    if (await hasAAAA(host)) return true;
  }
  return false;
}

// Per-check errors (timeouts, SERVFAIL) yield undefined so mergeRun keeps
// the previous result instead of recording a false.
async function guarded(id, label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`⚠️  ${id}: ${label} check errored (${err.message}) — keeping previous result`);
    return undefined;
  }
}

async function checkDNS(service) {
  const { apex, www } = variantsOf(service.url);
  const checks = {
    web: await guarded(service.id, 'web', () => hasAAAA(apex)),
    www: www ? await guarded(service.id, 'www', () => hasAAAA(www)) : REMOVE,
    mx: await guarded(service.id, 'mx', async () => {
      const hosts = await mxHosts(apex);
      return hosts.length === 0 ? null : await anyHostHasAAAA(hosts);
    }),
    ns: await guarded(service.id, 'ns', async () => {
      const hosts = await nsHosts(apex);
      return hosts.length === 0 ? null : await anyHostHasAAAA(hosts);
    }),
  };
  log(`  ${service.id}: web=${checks.web} www=${String(checks.www)} mx=${checks.mx} ns=${checks.ns}`);
  return checks;
}

async function checkHTTP(service) {
  const { apex, www } = variantsOf(service.url);
  let pass = await headOverIPv6(apex);
  if (pass && www) pass = await headOverIPv6(www);
  log(`  ${service.id}: http=${pass}`);
  return { http: pass };
}

async function pool(items, size, worker) {
  const results = {};
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        results[item.id] = await worker(item);
      }
    })
  );
  return results;
}

const { services } = yaml.load(fs.readFileSync('data/services.yaml', 'utf8'));
const targets = only ? services.filter((s) => only.includes(s.id)) : services;

if (httpMode && !hasGlobalIPv6()) {
  console.error('❌ --http needs a machine with a global IPv6 address; this one has none.');
  process.exit(1);
}

console.log(`Checking ${targets.length} services (${httpMode ? 'HTTP over IPv6' : 'DNS'})...`);
const outcomes = await pool(targets, 8, httpMode ? checkHTTP : checkDNS);

const results = loadResults();
mergeRun(results, httpMode ? 'http' : 'dns', new Date().toISOString(), outcomes);
const saved = saveResults(results, new Set(services.map((s) => s.id)));

const counts = { full: 0, partial: 0, none: 0, unknown: 0 };
for (const service of services) {
  const derived = deriveStatus(saved.services[service.id]);
  counts[derived] += 1;
  if (service.override && service.override.status === derived) {
    console.warn(`⚠️  ${service.id}: override matches derived status "${derived}" — override may be stale`);
  }
}
console.log(
  `Done: ${counts.full} full, ${counts.partial} partial, ${counts.none} none, ${counts.unknown} unknown`
);
