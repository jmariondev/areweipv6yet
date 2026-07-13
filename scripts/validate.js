#!/usr/bin/env node
// Validate data/services.yaml (curated, human-edited) and lightly check
// data/results.json (machine-owned). Zero dependencies beyond js-yaml.
import fs from 'node:fs';
import yaml from 'js-yaml';
import { STATUSES } from './lib/derive.js';

const SERVICE_KEYS = new Set(['id', 'name', 'url', 'description', 'override']);
const OVERRIDE_KEYS = new Set(['status', 'reason']);
const CHECK_KEYS = new Set(['web', 'www', 'mx', 'ns', 'http']);

const errors = [];
const warnings = [];

function validateServices() {
  const doc = yaml.load(fs.readFileSync('data/services.yaml', 'utf8'));

  if (!doc || !Array.isArray(doc.services)) {
    errors.push('services.yaml: top level must be { services: [...] }');
    return null;
  }

  const seen = new Set();
  for (const service of doc.services) {
    const label = service?.id ?? JSON.stringify(service)?.slice(0, 60);

    if (typeof service !== 'object' || service === null) {
      errors.push(`services.yaml: entry ${label} is not a mapping`);
      continue;
    }

    for (const key of Object.keys(service)) {
      if (!SERVICE_KEYS.has(key)) {
        errors.push(`${label}: unknown key "${key}"`);
      }
    }

    for (const key of ['id', 'name', 'url', 'description']) {
      if (typeof service[key] !== 'string' || service[key].trim() === '') {
        errors.push(`${label}: "${key}" must be a non-empty string`);
      }
    }

    if (typeof service.id === 'string' && !/^[a-z0-9-]+$/.test(service.id)) {
      errors.push(`${label}: id must match ^[a-z0-9-]+$`);
    }

    if (seen.has(service.id)) {
      errors.push(`${label}: duplicate id`);
    }
    seen.add(service.id);

    if (typeof service.url === 'string') {
      try {
        const url = new URL(service.url);
        if (url.protocol !== 'https:') {
          errors.push(`${label}: url must be https`);
        }
      } catch {
        errors.push(`${label}: url does not parse`);
      }
    }

    if ('override' in service) {
      const override = service.override;
      if (typeof override !== 'object' || override === null) {
        errors.push(`${label}: override must be a mapping`);
        continue;
      }
      for (const key of Object.keys(override)) {
        if (!OVERRIDE_KEYS.has(key)) {
          errors.push(`${label}: unknown override key "${key}"`);
        }
      }
      if (!STATUSES.includes(override.status)) {
        errors.push(`${label}: override.status must be one of ${STATUSES.join(', ')}`);
      }
      if (typeof override.reason !== 'string' || override.reason.trim() === '') {
        errors.push(`${label}: override requires a non-empty reason`);
      }
    }
  }

  return seen;
}

function validateResults(serviceIds) {
  if (!fs.existsSync('data/results.json')) {
    warnings.push('results.json missing — run "npm run check" to create it');
    return;
  }

  let results;
  try {
    results = JSON.parse(fs.readFileSync('data/results.json', 'utf8'));
  } catch (err) {
    errors.push(`results.json: invalid JSON (${err.message})`);
    return;
  }

  if (results.version !== 2) {
    errors.push('results.json: version must be 2');
  }

  for (const [id, checks] of Object.entries(results.services ?? {})) {
    if (serviceIds && !serviceIds.has(id)) {
      warnings.push(`results.json: "${id}" has results but is not in services.yaml`);
    }
    for (const [key, check] of Object.entries(checks)) {
      if (!CHECK_KEYS.has(key)) {
        errors.push(`results.json: ${id} has unknown check "${key}"`);
      }
      if (![true, false, null].includes(check?.pass)) {
        errors.push(`results.json: ${id}.${key}.pass must be true, false, or null`);
      }
    }
  }
}

const serviceIds = validateServices();
validateResults(serviceIds);

for (const warning of warnings) console.warn(`⚠️  ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`❌ ${error}`);
  console.error(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log(`✅ ${serviceIds?.size ?? 0} services valid`);
