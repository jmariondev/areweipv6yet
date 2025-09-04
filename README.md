# Are We IPv6 Yet?

A community-driven tracker for IPv6 adoption across popular services and applications.

## Overview

This project tracks which popular services support IPv6, helping users and organizations understand the current state of IPv6 adoption on the internet.

## Service Status Categories

- **Full Support** ✅ - Service fully works over IPv6
- **Partial Support** 🟨 - Some features work over IPv6
- **No Support** ❌ - No IPv6 support
- **Unknown** ❓ - Status needs verification

## Contributing

We welcome contributions! You can help by:

1. **Adding new services**: Edit `data/services.yaml` and submit a PR
2. **Updating service status**: Provide evidence of IPv6 support changes
3. **Improving documentation**: Help make the project more accessible

### Adding a Service

1. Fork the repository
2. Edit `data/services.yaml` following the existing format:
   ```yaml
   - id: service-id
     name: Service Name
     url: https://example.com
     category: category-name
     description: "Brief description"
     ipv6:
       status: unknown  # unknown/none/partial/full
       aaaa_record: false
       notes: ""
       last_checked: null
       last_manual_verification: null
   ```
3. Run validation: `npm run validate`
4. Submit a pull request

### Updating Service Status

When updating a service's IPv6 status, please provide:
- Evidence (screenshots, network traces, documentation links)
- Date of verification
- Any relevant notes about partial support

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Validate data
npm run validate

# Check IPv6 support (DNS AAAA records)
npm run check-ipv6

# Build site
npm run build

# Development with Cloudflare Workers
npm run dev
```

### Project Structure

```
areweipv6yet/
├── data/              # Service data files
│   ├── services.yaml  # Main service database
│   └── schema.json    # JSON Schema for validation
├── scripts/           # Node.js scripts
│   ├── check-ipv6.js  # Automated IPv6 checking
│   ├── validate.js    # Data validation
│   └── build-site.js  # Static site generation
├── site/              # Frontend files
│   ├── src/          # Source files
│   └── dist/         # Built files (gitignored)
├── workers/           # Cloudflare Workers
└── .github/workflows/ # GitHub Actions

```

## API

The service data is available as JSON at `/api.json`.

### Example Response

```json
{
  "services": [
    {
      "id": "discord",
      "name": "Discord",
      "url": "https://discord.com",
      "category": "communication",
      "ipv6": {
        "status": "none",
        "aaaa_record": false,
        "notes": "No IPv6 support as of 2024",
        "last_checked": "2024-01-15T00:00:00Z"
      }
    }
  ]
}
```

## Deployment

The site is automatically deployed to Cloudflare Pages when changes are pushed to the main branch.

## License

MIT

## Acknowledgments

Inspired by similar "Are We X Yet" trackers in various communities.