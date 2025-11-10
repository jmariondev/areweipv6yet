# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Essential Commands

### Development Commands
- `npm install` - Install dependencies
- `npm run build` - Build site with Eleventy
- `npm run dev` - Build and serve locally with Cloudflare Workers dev server
- `npm run eleventy:watch` - Watch mode for Eleventy (rebuilds on changes)
- `npm run eleventy:serve` - Serve with Eleventy's built-in dev server
- `npm run validate` - Validate service data against JSON schema
- `npm run check-ipv6` - Run automated IPv6 DNS and HTTP connectivity checks
- `npm run deploy` - Deploy to Cloudflare Workers/Pages

### IPv6 Checking Options
- `npm run check-ipv6 -- --verbose` - Show detailed output during checks
- `npm run check-ipv6 -- --detail` - Show comprehensive test results

## Architecture Overview

### Core Concept
This is an Eleventy-based static site that tracks IPv6 adoption across popular
web services. It uses a YAML database with automated DNS/HTTP checking and
manual verification status tracking.

### Data Structure
- **Services Database**: `data/services.yaml` - Main database of services and their IPv6 status
- **Schema Validation**: `data/schema.json` - JSON Schema for service data validation
- **Status Types**: `unknown`, `none`, `partial`, `full`
- **Service Types**: `service` (default), `cloud` (for cloud providers)
- **Test IDs**: `apex_domain`, `www_domain` (tests both DNS AAAA records AND HTTP connectivity)
- **Legacy Test IDs**: `aaaa_record`, `www_variant` (automatically migrated to new IDs)

### Build Process
1. Eleventy reads configuration from `eleventy.config.mjs`
2. Processes Nunjucks templates in `site/src/` using `data/services.yaml` as global data
3. Applies custom filters for sorting, statistics, status emojis, and formatting
4. Minifies HTML (html-minifier-terser), CSS (CSSO), and JS (Terser) automatically
5. Generates API JSON via Eleventy post-build hook
6. Outputs complete optimized static site to `site/dist/`

### Template System
- **Engine**: Eleventy with Nunjucks templating
- **Base Layout**: `site/src/_includes/base.njk` - shared HTML structure
- **Main Page**: `site/src/index.njk` - home page template
- **Additional Templates**: `sitemap.njk`, `og-image.svg.njk`
- **Custom Filters** (defined in `eleventy.config.mjs`):
  - `statusEmoji` - converts status to emoji representation
  - `testIcon` - converts test result to icon
  - `sortServices` - sorts by status then name
  - `countByStatus` - counts services by status
  - `visibleTests` - filters tests with non-null results
  - `isoDate`, `shortDate` - date formatting
  - `percent`, `getStats` - statistics calculations

### IPv6 Testing
- **Automated**: `scripts/check-ipv6.js` performs both DNS AAAA lookups AND HTTP connectivity tests
- **Test Framework**: Each service has multiple test types (apex_domain, www_domain)
- **Validation**: Tests both that DNS AAAA records exist AND that HTTP/HTTPS works over IPv6
- **Results Tracking**: Each test stores result (true/false/null), last_checked timestamp
- **Status Logic**: Overall status derived from individual test results
- **Special Handling**: Includes workarounds (e.g., Azure timeout handling)

### Deployment
- **Target**: Cloudflare Workers + Pages (hybrid approach)
- **Worker**: `workers/index.js` - handles HTTPS redirects, domain canonicalization, security headers
- **Configuration**: `wrangler.toml` with production environment
- **Domains**: areweipv6yet.com, .net, .org, arewev6yet.com
- **Security**: CSP headers, HSTS, X-Frame-Options, etc.

### GitHub Actions
- **Validation**: `.github/workflows/validate.yml` - runs on PRs to validate data changes
- **IPv6 Checks**: `.github/workflows/check-ipv6.yml` - daily automated IPv6 testing
- **Deployment**: `.github/workflows/deploy.yml` - deploys on main branch pushes

## Key File Locations

### Configuration & Data
- Eleventy config: `eleventy.config.mjs`
- Service data: `data/services.yaml`
- Schema: `data/schema.json`

### Build Scripts
- `scripts/check-ipv6.js` - Automated IPv6 DNS and HTTP connectivity tests
- `scripts/validate-data.js` - JSON Schema validation
- `scripts/analyze-status.js` - Compare service status with test results

### Site Source
- Templates: `site/src/*.njk`
- Base layout: `site/src/_includes/base.njk`
- Styles: `site/src/style.css` (minified during build)
- Scripts: `site/src/script.js` (minified during build)
- SEO files: `site/src/robots.txt`, `site/src/sitemap.njk`

### Output & Infrastructure
- Built site: `site/dist/`
- Cloudflare Worker: `workers/index.js`
- Deployment config: `wrangler.toml`

## Contributing Workflow

1. Edit `data/services.yaml` to add/update services
2. Run `npm run validate` to check schema compliance
3. Run `npm run build` to generate updated site
4. Test locally with `npm run dev` or `npm run eleventy:serve`
5. PRs trigger validation workflow automatically

## Important Notes

- Always validate data changes with `npm run validate` before committing
- The IPv6 checker script modifies `data/services.yaml` in-place
- Service IDs must be lowercase alphanumeric with hyphens only
- Each service requires at minimum: id, name, url, category, ipv6.status, ipv6.tests array
- Test IDs use new format (`apex_domain`, `www_domain`); legacy IDs are auto-migrated
- When writing quick hack scripts (e.g., migrations), use Node.js - Python is not available
