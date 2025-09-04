# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Commands
- `npm install` - Install dependencies  
- `npm run build` - Build static site to `site/dist/`
- `npm run dev` - Build and serve locally with Cloudflare Workers dev server
- `npm run validate` - Validate service data against JSON schema
- `npm run check-ipv6` - Run automated IPv6 DNS checks and update service data
- `npm run deploy` - Deploy to Cloudflare Workers/Pages

### IPv6 Checking Options
- `npm run check-ipv6 -- --verbose` - Show detailed output during checks
- `npm run check-ipv6 -- --detail` - Show comprehensive test results

## Architecture Overview

### Core Concept
This is a static site generator that tracks IPv6 adoption across popular web services. It uses a YAML database of services with automated DNS checking and manual verification status tracking.

### Data Structure
- **Services Database**: `data/services.yaml` - Main database of services and their IPv6 status
- **Schema Validation**: `data/schema.json` - JSON Schema for service data validation
- **Status Types**: `unknown`, `none`, `partial`, `full`
- **Test System**: Each service has an array of individual IPv6 tests (AAAA records, connectivity, etc.)

### Build Process
1. `scripts/build-site.js` reads `data/services.yaml`
2. Processes service data and generates statistics
3. Uses HTML template `site/src/index.html` with placeholder replacement
4. Outputs complete static site to `site/dist/`
5. Also generates `/api.json` endpoint with service data

### IPv6 Testing
- **Automated**: `scripts/check-ipv6.js` performs DNS AAAA record lookups
- **Test Framework**: Services contain multiple test types beyond just DNS
- **Results Tracking**: Each test stores result, last_checked timestamp
- **Status Logic**: Overall status derived from individual test results

### Deployment
- **Target**: Cloudflare Workers + Pages (hybrid approach)
- **Worker**: `workers/index.js` serves static files
- **Configuration**: `wrangler.toml` with staging/production environments
- **Domains**: Supports multiple domains (areweipv6yet.com, etc.)

### GitHub Actions
- **Validation**: `.github/workflows/validate.yml` runs on PRs to validate data changes
- **IPv6 Checks**: `.github/workflows/check-ipv6.yml` runs scheduled IPv6 testing
- **Deployment**: `.github/workflows/deploy.yml` deploys on main branch pushes

## Key File Locations

- Service data: `data/services.yaml`
- Build scripts: `scripts/`
- Frontend source: `site/src/`
- Built site: `site/dist/`
- Cloudflare Worker: `workers/index.js`

## Contributing Workflow

1. Edit `data/services.yaml` to add/update services
2. Run `npm run validate` to check schema compliance
3. Run `npm run build` to generate updated site
4. Test locally with `npm run dev`
5. PRs trigger validation workflow automatically

## Important Notes

- Always validate data changes with `npm run validate` before committing
- The IPv6 checker script modifies `data/services.yaml` in-place
- Service IDs must be lowercase alphanumeric with hyphens only
- Each service requires at minimum: id, name, url, category, ipv6.status, ipv6.tests array