# Are We IPv6 Yet?

A community-driven tracker for IPv6 adoption across popular services, live at
[areweipv6yet.com](https://areweipv6yet.com/).

## How it works

Statuses are **derived automatically** from DNS checks that run daily in CI —
nobody hand-edits a status. Humans curate *which* services are tracked; the
machines report *how* they're doing.

- `data/services.yaml` — human-curated: each service's id, name, URL, and
  description. This is the only file contributors normally touch.
- `data/results.json` — machine-owned: check results, written by
  `scripts/check.js` and committed by the daily workflow. Never edit it.

### Checks

| Check | What it means | Affects status? |
|---|---|---|
| **Apex Domain** | AAAA records on the service's main host | yes |
| **WWW Domain** | AAAA records on the `www.` variant (when one applies) | yes |
| **Mail (MX)** | at least one MX host has AAAA records | badge only |
| **DNS (NS)** | at least one NS host has AAAA records | badge only |
| **HTTP** | an actual HTTP request over an IPv6 socket succeeded | advisory note |

Status rules: both web checks pass → **Full** ✅ · one passes → **Partial** 🟨
· neither passes → **None** ❌ · no results yet → **Unknown** ❓

The HTTP check can't run on GitHub-hosted runners (they have no IPv6), so it's
contributed out-of-band: anyone on an IPv6-capable machine can run
`npm run check:http` and PR the updated `data/results.json`.

### Overrides

If automation gets a service wrong (regional CDN quirks, IPv6 published but
broken, …), add an `override` with a required `reason`:

```yaml
- id: example
  name: Example
  url: https://www.example.com
  description: An example service
  override:
    status: partial
    reason: AAAA records exist but video playback falls back to IPv4-only CDN.
```

The site shows a "manual" marker with the reason, and the API exposes both the
derived and the overridden status.

## Contributing

- **Add a service**: PR a new entry to `data/services.yaml` (id, name, url,
  description — that's all), or open an
  [Add Service issue](../../issues/new?template=01-add-service.yml).
  Run `npm run validate` before submitting. One service per PR, please.
- **Displayed status looks wrong?** Open a
  [status issue](../../issues/new?template=02-update-status.yml) or PR an
  `override` with evidence.
- **Contribute HTTP results**: from an IPv6-capable machine, run
  `npm run check:http` and PR the `data/results.json` change.

## Development

Requires Node.js 20+.

```bash
npm install
npm run validate     # check data/services.yaml (and results.json) for errors
npm run check        # DNS checks; writes data/results.json
npm run check:http   # HTTP-over-IPv6 checks (needs an IPv6-capable machine)
npm run build        # build the site into dist/
npm run dev          # rebuild on change and serve on http://localhost:8080
```

The site is a single page rendered by `scripts/build.js` — plain Node with
template literals, no framework. `scripts/lib/` holds the small modules shared
by the build, checker, and validator.

## API

The full dataset is published at
[`/api.json`](https://areweipv6yet.com/api.json): derived and effective status,
every check result with its method and the date it last changed, and any
override with its reason.

## Deployment

Cloudflare Workers static assets serve `dist/` on `areweipv6yet.com`
(security headers come from `public/_headers`); a tiny Worker
(`workers/redirect.js`) 301s the alternate domains to the canonical one.
Deploys run from GitHub Actions on pushes to `main` and after the daily check.
The zone's **Always Use HTTPS** setting must be enabled — HTTP→HTTPS is not
handled in code.

## License

Code is licensed under [MPL-2.0](LICENSE). The service data
(`data/services.yaml`, `data/results.json`) is dedicated to the public domain
under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
