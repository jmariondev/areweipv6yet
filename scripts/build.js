#!/usr/bin/env node
// Build the site: read data/services.yaml + data/results.json, derive
// statuses, and emit dist/. Pass --serve to preview on localhost:8080.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import yaml from 'js-yaml';
import { effectiveStatus, STATUS_ORDER } from './lib/derive.js';
import { loadResults } from './lib/results.js';
import { page } from './lib/html.js';

const SITE_URL = 'https://areweipv6yet.com/';
const DIST = 'dist';

const generated = new Date().toISOString();
const { services: curated } = yaml.load(fs.readFileSync('data/services.yaml', 'utf8'));
const results = loadResults();

const services = curated
  .map((service) => {
    const checks = results.services[service.id] ?? {};
    const { derived, status } = effectiveStatus(service, checks);
    return { ...service, checks, derived_status: derived, status };
  })
  .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));

const stats = { total: services.length, full: 0, partial: 0, none: 0, unknown: 0 };
for (const service of services) stats[service.status] += 1;

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync('public', DIST, { recursive: true });

// Progress-bar proportions depend on the data, but the CSP (style-src 'self')
// forbids inline style attributes — so append them to the stylesheet instead.
const barCss = ['full', 'partial', 'none', 'unknown']
  .filter((status) => stats[status] > 0)
  .map((status) => `.progress-bar .progress-${status} { flex: ${stats[status]}; }`)
  .join('\n');
fs.appendFileSync(path.join(DIST, 'style.css'), `\n/* generated: progress-bar segment proportions */\n${barCss}\n`);

fs.writeFileSync(path.join(DIST, 'index.html'), page({ services, stats, generated, runs: results.runs }));

fs.writeFileSync(
  path.join(DIST, 'api.json'),
  `${JSON.stringify(
    {
      version: 2,
      generated_at: generated,
      checked_at: { dns: results.runs.dns?.at ?? null, http: results.runs.http?.at ?? null },
      stats,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        description: s.description ?? null,
        status: s.status,
        derived_status: s.derived_status,
        override: s.override ?? null,
        checks: s.checks,
      })),
    },
    null,
    2
  )}\n`
);

fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${generated.slice(0, 10)}</lastmod>
    <changefreq>daily</changefreq>
  </url>
</urlset>
`
);

console.log(`Built ${stats.total} services -> ${DIST}/ (${stats.full} full, ${stats.partial} partial, ${stats.none} none, ${stats.unknown} unknown)`);

if (process.argv.includes('--serve')) {
  const TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain',
    '.svg': 'image/svg+xml', '.png': 'image/png',
  };
  http
    .createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://localhost').pathname;
      let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
      if (!path.resolve(file).startsWith(path.resolve(DIST)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    })
    .listen(8080, () => console.log('Serving on http://localhost:8080'));
}
