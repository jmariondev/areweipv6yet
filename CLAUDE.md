# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Commands

- `npm install` — install dependencies (js-yaml and wrangler only)
- `npm run validate` — validate `data/services.yaml` and `data/results.json`
- `npm run check` — DNS checks (AAAA on apex/www, MX hosts, NS hosts); writes `data/results.json`
- `npm run check:http` — HTTP-over-IPv6 checks; refuses to run without a global IPv6 address
- `npm run build` — build the site into `dist/`
- `npm run dev` — rebuild on change and serve on http://localhost:8080
- `npm run deploy` — build and deploy both Workers via wrangler

Checker flags: `--only id[,id]` to limit services, `--verbose` for per-service output.

## Architecture

One-page static site, no framework. Plain Node scripts render everything.

### Data ownership split (the core design decision)

- `data/services.yaml` — **human-curated only**: `id`, `name`, `url`,
  `description`, optional `override: {status, reason}`. CI never writes here.
- `data/results.json` — **machine-owned only**: check results keyed by service
  id. Humans never edit it. Designed for minimal diff churn: one timestamp per
  run method at the top, and each check's `since` only moves when its `pass`
  value flips. An unchanged daily run diffs as a single line.

### Status derivation (`scripts/lib/derive.js`)

Status (`full`/`partial`/`none`/`unknown`) is **derived at build time** from
the web DNS checks only: both apex and www pass → full; one → partial; none →
none; no results → unknown. Services without a www variant (deeper subdomains
like `store.steampowered.com`) are judged on apex alone. MX and NS results are
auxiliary badges; HTTP results are advisory notes. None of them affect the
headline status — so a probe quirk can annotate but never demote a service.
`override.status` (requires a `reason`) beats the derived status; the UI marks
it "manual" and `api.json` exposes both.

### Scripts

- `scripts/check.js` — checker CLI. Default mode is DNS-only (works anywhere,
  including GitHub-hosted runners, which have **no IPv6 connectivity**).
  `--http` mode does HEAD requests over IPv6 sockets and only runs on
  IPv6-capable machines. The two modes write disjoint keys in results.json.
  DNS query errors (timeouts, SERVFAIL) keep the previous result rather than
  recording a false. Checks only fail on v4-supported-but-no-v6: MX/NS hosts
  with no address records at all record `null` (not applicable), and a www
  that doesn't exist in DNS is dropped so the service is judged on apex alone.
- `scripts/build.js` — reads both data files, derives statuses, renders
  `dist/index.html` via template literals (`scripts/lib/html.js`), and emits
  `dist/api.json` + `dist/sitemap.xml`, copying `public/` into `dist/`.
  No minification anywhere — the CDN compresses on the wire.
- `scripts/validate.js` — zero-dep validator (no JSON Schema library).
  Rejects unknown keys, duplicate ids, non-https URLs, and overrides without
  reasons.
- `scripts/lib/domains.js` — derives hostnames to check from a service URL
  (www-stripping / www-adding / subdomain-no-www heuristic).

### Hosting

- Primary domain: assets-only Cloudflare Worker (`wrangler.toml`, no `main`),
  serving `dist/` with security headers from `public/_headers`.
- Alternate domains (.net/.org/typo + all www forms): `workers/redirect.js`
  via `wrangler.redirects.toml`, 301 to `https://areweipv6yet.com`.
- HTTP→HTTPS relies on the zone's "Always Use HTTPS" setting, not code.

### CI (`.github/workflows/`)

- `validate.yml` — PRs and main pushes: validate + build smoke test.
- `check.yml` — daily cron: DNS checks, commits `data/results.json`, then
  explicitly calls `deploy.yml` (`workflow_call` + `secrets: inherit`) because
  pushes made with `GITHUB_TOKEN` never trigger push-based workflows.
- `deploy.yml` — reusable; always checks out `main`'s tip (the calling
  workflow's SHA predates the results commit it just pushed).

## Important notes

- Service ids are lowercase alphanumeric with hyphens.
- Always run `npm run validate` after touching `data/services.yaml`.
- Never hardcode per-service exceptions in the checker; use an `override` in
  services.yaml with a reason instead.
- When writing quick hack scripts (e.g. migrations), use Node.js — Python is
  not available.
