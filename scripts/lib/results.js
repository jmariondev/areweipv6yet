import fs from 'node:fs';

const PATH = 'data/results.json';
const RUN_ORDER = ['dns', 'http'];
const CHECK_ORDER = ['web', 'www', 'mx', 'ns', 'http'];

// Outcome value meaning in mergeRun:
//   true/false  pass or fail
//   null        checked, not applicable (e.g. domain has no MX)
//   undefined   check errored — keep the previous result
//   REMOVE      check no longer applies — drop the key
export const REMOVE = Symbol('remove');

export function loadResults() {
  if (!fs.existsSync(PATH)) return { version: 2, runs: {}, services: {} };
  return JSON.parse(fs.readFileSync(PATH, 'utf8'));
}

// `since` moves only when `pass` changes, so an unchanged run diffs as the
// single runs.<method>.at line.
export function mergeRun(results, method, at, outcomes) {
  results.runs[method] = { at };
  for (const [id, checks] of Object.entries(outcomes)) {
    const service = (results.services[id] ??= {});
    for (const [key, pass] of Object.entries(checks)) {
      if (pass === undefined) continue;
      if (pass === REMOVE) {
        delete service[key];
        continue;
      }
      const prev = service[key];
      const entry = {
        pass,
        method,
        since: prev && prev.pass === pass ? prev.since : at,
      };
      if (method === 'http') entry.checked_at = at;
      service[key] = entry;
    }
  }
}

// Byte-stable output: alphabetical services, fixed check order.
export function saveResults(results, knownIds) {
  const out = { version: 2, runs: {}, services: {} };
  for (const run of RUN_ORDER) {
    if (results.runs[run]) out.runs[run] = results.runs[run];
  }
  for (const id of Object.keys(results.services).sort()) {
    if (knownIds && !knownIds.has(id)) continue; // prune removed services
    const checks = results.services[id];
    out.services[id] = {};
    for (const key of CHECK_ORDER) {
      if (key in checks) out.services[id][key] = checks[key];
    }
  }
  fs.writeFileSync(PATH, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}
