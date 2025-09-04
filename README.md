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

We welcome contributions! There are several ways to help improve this tracker:

### Quick Contribution Methods

#### 🆕 Report a New Service
Use our [New Service Issue Template](../../issues/new?template=01-add-service.yml) to request adding a service to the tracker. No technical knowledge required!

#### 🔄 Update IPv6 Status
Found a service with incorrect IPv6 status? Use the [Status Update Issue Template](../../issues/new?template=02-update-status.yml) to report changes.

#### ❌ Report Incorrect Information
Help us fix mistakes using the [Correction Issue Template](../../issues/new?template=03-report-incorrect.yml).

### Direct Contribution (Pull Requests)

For those comfortable with Git and YAML:

1. **Fork the repository**
2. **Edit `data/services.yaml`** following the format below
3. **Run validation**: `npm run validate`
4. **Submit a pull request**

#### Service Data Format

```yaml
- id: service-id          # lowercase, alphanumeric with hyphens
  name: Service Name       # Official service name
  url: https://example.com # Main service URL
  description: "Brief description of the service"  # Optional
  ipv6:
    status: unknown       # unknown/none/partial/full
    tests:
      - id: aaaa_record
        name: IPv6 Address
        description: "Main domain has IPv6 addresses (AAAA records)"
        result: null      # true/false/null
    notes: ""            # Optional notes about IPv6 support
    last_checked: null   # Optional, auto-updated by scripts
```

### Testing IPv6 Support

When reporting IPv6 status, please test:

1. **DNS AAAA Records**: 
   ```bash
   dig AAAA example.com
   nslookup -type=AAAA example.com
   ```

2. **IPv6 Connectivity**:
   - Test from an IPv6-enabled network
   - Use online tools like [test-ipv6.com](https://test-ipv6.com)
   - Check if the service loads and functions over IPv6

3. **What to Document**:
   - Which domains have AAAA records
   - Whether the service works on IPv6-only networks
   - Any features that don't work over IPv6 (partial support)
   - Regional differences in IPv6 support


### Contribution Guidelines

- **Accuracy**: Ensure information is current and verified
- **Evidence**: Provide test results or documentation for changes
- **Consistency**: Follow existing naming and formatting patterns
- **Validation**: Always run `npm run validate` before submitting
- **One Service Per PR**: Keep pull requests focused on single services

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
        "tests": [
          {
            "id": "aaaa_record",
            "name": "IPv6 Address",
            "result": false,
            "last_checked": "2024-01-15T00:00:00Z"
          }
        ],
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

- **Code**: Mozilla Public License 2.0 (MPL-2.0)
- **Data** (`data/services.yaml`): CC0 1.0 Universal (Public Domain)

The IPv6 adoption data in this repository is free to use, modify, and distribute for any purpose without attribution, though attribution is appreciated.

## Acknowledgments

Inspired by similar "Are We X Yet" trackers in various communities.