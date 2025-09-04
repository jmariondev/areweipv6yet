# Are We IPv6 Yet - Implementation Plan

## Project Overview
Build a static site at areweipv6yet.com that tracks IPv6 support for popular services, with automated checking via GitHub Actions and community contributions via PRs. Deploy via Cloudflare Workers + KV.

**Repository**: `jmariondev/areweipv6yet`  
**Primary Domain**: `areweipv6yet.com`  
**Redirect Domains**: `areweipv6yet.net`, `areweipv6yet.org`, `arewev6yet.com`

## Phase 1: Project Foundation

### Step 1.1: Initialize Repository Structure
Create the following directory structure:
```
areweipv6yet/
├── data/
│   ├── services.yaml
│   └── schema.json
├── scripts/
│   ├── check-ipv6.js
│   ├── validate-data.js
│   └── build-site.js
├── site/
│   ├── src/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── dist/
├── workers/
│   └── site-worker.js
├── .github/
│   ├── workflows/
│   │   └── validate-pr.yml
│   └── pull_request_template.md
├── package.json
├── wrangler.toml
├── .gitignore
└── README.md
```

### Step 1.2: Create Initial Data Structure
Create `data/services.yaml` with our three initial services:
```yaml
services:
  - id: discord
    name: Discord
    url: https://discord.com
    category: communication
    description: "Voice, video, and text chat platform"
    ipv6:
      status: unknown  # unknown/none/partial/full
      aaaa_record: false
      notes: ""
      last_checked: null
      last_manual_verification: null
    
  - id: steam
    name: Steam
    url: https://store.steampowered.com
    category: gaming
    description: "Digital distribution platform for games"
    ipv6:
      status: unknown
      aaaa_record: false
      notes: ""
      last_checked: null
      last_manual_verification: null
    
  - id: duckduckgo
    name: DuckDuckGo
    url: https://duckduckgo.com
    category: search
    description: "Privacy-focused search engine"
    ipv6:
      status: unknown
      aaaa_record: false
      notes: ""
      last_checked: null
      last_manual_verification: null
```

### Step 1.3: Create Data Schema
Create `data/schema.json` for validation:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["services"],
  "properties": {
    "services": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "url", "category", "ipv6"],
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "name": { "type": "string" },
          "url": { "type": "string", "format": "uri" },
          "category": { "type": "string" },
          "description": { "type": "string" },
          "ipv6": {
            "type": "object",
            "required": ["status", "aaaa_record"],
            "properties": {
              "status": { "enum": ["unknown", "none", "partial", "full"] },
              "aaaa_record": { "type": "boolean" },
              "notes": { "type": "string" },
              "last_checked": { "type": ["string", "null"] },
              "last_manual_verification": { "type": ["string", "null"] }
            }
          }
        }
      }
    }
  }
}
```

### Step 1.4: Initialize package.json
```json
{
  "name": "areweipv6yet",
  "version": "1.0.0",
  "description": "Track IPv6 adoption across popular services",
  "scripts": {
    "build": "node scripts/build-site.js",
    "validate": "node scripts/validate-data.js",
    "check-ipv6": "node scripts/check-ipv6.js",
    "dev": "npm run build && wrangler dev",
    "deploy": "npm run build && wrangler deploy"
  },
  "devDependencies": {
    "js-yaml": "^4.1.0",
    "ajv": "^8.12.0",
    "wrangler": "^3.0.0"
  }
}
```

## Phase 2: Core Functionality

### Step 2.1: Create IPv6 Checker Script
Create `scripts/check-ipv6.js`:
```javascript
import { promises as dns } from 'dns';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import { URL } from 'url';

async function checkAAAARecord(hostname) {
  try {
    const addresses = await dns.resolve6(hostname);
    return addresses.length > 0;
  } catch (error) {
    return false;
  }
}

async function main() {
  // Load current data
  const dataFile = await fs.readFile('data/services.yaml', 'utf8');
  const data = yaml.load(dataFile);
  
  let updated = false;
  
  for (const service of data.services) {
    const url = new URL(service.url);
    const hostname = url.hostname;
    
    console.log(`Checking ${service.name} (${hostname})...`);
    
    const hasAAAA = await checkAAAARecord(hostname);
    const now = new Date().toISOString();
    
    if (service.ipv6.aaaa_record !== hasAAAA) {
      service.ipv6.aaaa_record = hasAAAA;
      service.ipv6.last_checked = now;
      
      // Update status based on AAAA record
      if (hasAAAA && service.ipv6.status === 'unknown') {
        service.ipv6.status = 'partial'; // Conservative assumption
      } else if (!hasAAAA && service.ipv6.status === 'unknown') {
        service.ipv6.status = 'none';
      }
      
      updated = true;
      console.log(`  → Updated: AAAA record = ${hasAAAA}`);
    } else {
      service.ipv6.last_checked = now;
      console.log(`  → No change: AAAA record = ${hasAAAA}`);
    }
  }
  
  if (updated) {
    // Write updated data
    await fs.writeFile('data/services.yaml', yaml.dump(data), 'utf8');
    console.log('\n✅ Data file updated');
  } else {
    console.log('\n✅ No changes detected');
  }
}

main().catch(console.error);
```

### Step 2.2: Create Data Validator
Create `scripts/validate-data.js`:
```javascript
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

async function main() {
  const ajv = new Ajv();
  addFormats(ajv);
  
  // Load schema and data
  const schema = JSON.parse(await fs.readFile('data/schema.json', 'utf8'));
  const dataFile = await fs.readFile('data/services.yaml', 'utf8');
  const data = yaml.load(dataFile);
  
  // Validate
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (!valid) {
    console.error('❌ Validation failed:');
    console.error(validate.errors);
    process.exit(1);
  }
  
  // Check for duplicate IDs
  const ids = data.services.map(s => s.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  
  if (duplicates.length > 0) {
    console.error('❌ Duplicate IDs found:', duplicates);
    process.exit(1);
  }
  
  console.log('✅ Data validation passed');
}

main().catch(console.error);
```

### Step 2.3: Create Site Builder
Create `scripts/build-site.js`:
```javascript
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import path from 'path';

async function main() {
  // Load data
  const dataFile = await fs.readFile('data/services.yaml', 'utf8');
  const data = yaml.load(dataFile);
  
  // Sort services by status (full > partial > none > unknown) then by name
  const statusOrder = { full: 0, partial: 1, none: 2, unknown: 3 };
  data.services.sort((a, b) => {
    const statusDiff = statusOrder[a.ipv6.status] - statusOrder[b.ipv6.status];
    if (statusDiff !== 0) return statusDiff;
    return a.name.localeCompare(b.name);
  });
  
  // Calculate statistics
  const stats = {
    total: data.services.length,
    full: data.services.filter(s => s.ipv6.status === 'full').length,
    partial: data.services.filter(s => s.ipv6.status === 'partial').length,
    none: data.services.filter(s => s.ipv6.status === 'none').length,
    unknown: data.services.filter(s => s.ipv6.status === 'unknown').length
  };
  
  // Read template
  const template = await fs.readFile('site/src/index.html', 'utf8');
  
  // Generate service cards HTML
  const servicesHtml = data.services.map(service => {
    const statusClass = `status-${service.ipv6.status}`;
    const statusEmoji = {
      full: '✅',
      partial: '🟨',
      none: '❌',
      unknown: '❓'
    }[service.ipv6.status];
    
    return `
    <div class="service-card ${statusClass}">
      <div class="service-header">
        <h3>${service.name}</h3>
        <span class="status-emoji">${statusEmoji}</span>
      </div>
      <p class="service-url">${service.url}</p>
      ${service.description ? `<p class="service-description">${service.description}</p>` : ''}
      <div class="service-details">
        <p class="ipv6-status">IPv6 Status: <strong>${service.ipv6.status}</strong></p>
        <p class="aaaa-record">AAAA Record: ${service.ipv6.aaaa_record ? '✅ Yes' : '❌ No'}</p>
        ${service.ipv6.notes ? `<p class="notes">${service.ipv6.notes}</p>` : ''}
        ${service.ipv6.last_checked ? `<p class="last-checked">Last checked: ${new Date(service.ipv6.last_checked).toLocaleDateString()}</p>` : ''}
      </div>
    </div>`;
  }).join('\n');
  
  // Replace placeholders
  let html = template
    .replace('{{SERVICES}}', servicesHtml)
    .replace('{{STATS_TOTAL}}', stats.total)
    .replace('{{STATS_FULL}}', stats.full)
    .replace('{{STATS_PARTIAL}}', stats.partial)
    .replace('{{STATS_NONE}}', stats.none)
    .replace('{{STATS_UNKNOWN}}', stats.unknown)
    .replace('{{LAST_UPDATED}}', new Date().toISOString());
  
  // Ensure dist directory exists
  await fs.mkdir('site/dist', { recursive: true });
  
  // Write output files
  await fs.writeFile('site/dist/index.html', html);
  await fs.copyFile('site/src/style.css', 'site/dist/style.css');
  await fs.copyFile('site/src/script.js', 'site/dist/script.js');
  
  // Generate API JSON
  await fs.writeFile('site/dist/api.json', JSON.stringify(data, null, 2));
  
  console.log('✅ Site built successfully');
}

main().catch(console.error);
```

## Phase 3: Frontend

### Step 3.1: Create HTML Template
Create `site/src/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Are We IPv6 Yet?</title>
  <meta name="description" content="Track IPv6 adoption across popular services and applications">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>Are We IPv6 Yet?</h1>
    <p class="tagline">Tracking IPv6 adoption across popular services</p>
  </header>
  
  <main>
    <section class="summary">
      <h2>Quick Answer: <span class="answer">Kinda 🤷</span></h2>
      <div class="stats">
        <div class="stat">
          <span class="stat-number">{{STATS_FULL}}</span>
          <span class="stat-label">Full Support</span>
        </div>
        <div class="stat">
          <span class="stat-number">{{STATS_PARTIAL}}</span>
          <span class="stat-label">Partial Support</span>
        </div>
        <div class="stat">
          <span class="stat-number">{{STATS_NONE}}</span>
          <span class="stat-label">No Support</span>
        </div>
        <div class="stat">
          <span class="stat-number">{{STATS_UNKNOWN}}</span>
          <span class="stat-label">Unknown</span>
        </div>
      </div>
    </section>
    
    <section class="filters">
      <input type="search" id="search" placeholder="Search services...">
      <div class="filter-buttons">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="full">✅ Full</button>
        <button class="filter-btn" data-filter="partial">🟨 Partial</button>
        <button class="filter-btn" data-filter="none">❌ None</button>
        <button class="filter-btn" data-filter="unknown">❓ Unknown</button>
      </div>
    </section>
    
    <section class="services" id="services">
      {{SERVICES}}
    </section>
  </main>
  
  <footer>
    <p>Last updated: <time datetime="{{LAST_UPDATED}}">{{LAST_UPDATED}}</time></p>
    <p>
      <a href="https://github.com/jmariondev/areweipv6yet">Contribute on GitHub</a> | 
      <a href="/api.json">API</a>
    </p>
  </footer>
  
  <script src="script.js"></script>
</body>
</html>
```

### Step 3.2: Create CSS
Create `site/src/style.css`:
```css
:root {
  --color-full: #22c55e;
  --color-partial: #eab308;
  --color-none: #ef4444;
  --color-unknown: #6b7280;
  --bg: #ffffff;
  --text: #111827;
  --border: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111827;
    --text: #f3f4f6;
    --border: #374151;
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}

header {
  text-align: center;
  padding: 2rem 1rem;
  border-bottom: 1px solid var(--border);
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.tagline {
  color: var(--text);
  opacity: 0.8;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.summary {
  text-align: center;
  margin-bottom: 3rem;
}

.summary h2 {
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

.answer {
  color: var(--color-partial);
}

.stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.8;
}

.filters {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

#search {
  width: 100%;
  max-width: 400px;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg);
  color: var(--text);
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--border);
}

.filter-btn.active {
  background: var(--text);
  color: var(--bg);
}

.services {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.service-card {
  border: 2px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  transition: transform 0.2s;
}

.service-card:hover {
  transform: translateY(-2px);
}

.service-card.status-full {
  border-color: var(--color-full);
}

.service-card.status-partial {
  border-color: var(--color-partial);
}

.service-card.status-none {
  border-color: var(--color-none);
}

.service-card.status-unknown {
  border-color: var(--color-unknown);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.service-header h3 {
  font-size: 1.2rem;
}

.status-emoji {
  font-size: 1.5rem;
}

.service-url {
  font-size: 0.9rem;
  opacity: 0.7;
  margin-bottom: 0.5rem;
}

.service-description {
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.service-details {
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ipv6-status strong {
  text-transform: capitalize;
}

.last-checked {
  opacity: 0.6;
  font-size: 0.8rem;
}

footer {
  text-align: center;
  padding: 2rem 1rem;
  border-top: 1px solid var(--border);
  margin-top: 4rem;
}

footer a {
  color: var(--text);
  opacity: 0.8;
}

.hidden {
  display: none !important;
}
```

### Step 3.3: Create JavaScript
Create `site/src/script.js`:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const services = document.querySelectorAll('.service-card');
  
  let currentFilter = 'all';
  
  // Filter functionality
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });
  
  // Search functionality
  searchInput.addEventListener('input', applyFilters);
  
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    
    services.forEach(card => {
      const matchesFilter = currentFilter === 'all' || 
        card.classList.contains(`status-${currentFilter}`);
      
      const text = card.textContent.toLowerCase();
      const matchesSearch = searchTerm === '' || text.includes(searchTerm);
      
      if (matchesFilter && matchesSearch) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  }
});
```

## Phase 4: Cloudflare Workers Deployment

### Step 4.1: Create Worker
Create `workers/site-worker.js`:
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle redirects for alternate domains
    const redirectDomains = ['areweipv6yet.net', 'areweipv6yet.org', 'arewev6yet.com'];
    if (redirectDomains.includes(url.hostname)) {
      return Response.redirect(`https://areweipv6yet.com${url.pathname}`, 301);
    }
    
    // Map paths to files
    let path = url.pathname;
    if (path === '/') path = '/index.html';
    
    // Try to fetch from KV
    const content = await env.SITE_KV.get(path);
    
    if (!content) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Determine content type
    const ext = path.split('.').pop();
    const contentTypes = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json'
    };
    
    return new Response(content, {
      headers: {
        'content-type': contentTypes[ext] || 'text/plain',
        'cache-control': 'public, max-age=3600',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff'
      }
    });
  }
};
```

### Step 4.2: Create Wrangler Configuration
Create `wrangler.toml`:
```toml
name = "areweipv6yet"
main = "workers/site-worker.js"
compatibility_date = "2024-01-01"

[env.production]
routes = [
  { pattern = "areweipv6yet.com/*", zone_name = "areweipv6yet.com" },
  { pattern = "areweipv6yet.net/*", zone_name = "areweipv6yet.net" },
  { pattern = "areweipv6yet.org/*", zone_name = "areweipv6yet.org" },
  { pattern = "arewev6yet.com/*", zone_name = "arewev6yet.com" }
]

[[kv_namespaces]]
binding = "SITE_KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_KV_PREVIEW_ID"
```

### Step 4.3: Create KV Upload Script
Create `scripts/upload-to-kv.js`:
```javascript
import { promises as fs } from 'fs';
import path from 'path';

async function uploadDirectory(dir, prefix = '') {
  const files = await fs.readdir(dir);
  const uploads = [];
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      uploads.push(...await uploadDirectory(filePath, `${prefix}/${file}`));
    } else {
      const content = await fs.readFile(filePath, 'utf8');
      const key = `${prefix}/${file}`.replace(/^\//, '');
      uploads.push({ key, value: content });
    }
  }
  
  return uploads;
}

async function main() {
  const files = await uploadDirectory('site/dist');
  
  // Generate wrangler KV bulk upload commands
  console.log('Upload these files to KV:');
  for (const file of files) {
    console.log(`wrangler kv:key put --binding=SITE_KV "${file.key}" --path="site/dist/${file.key}"`);
  }
}

main().catch(console.error);
```

## Phase 5: GitHub Actions

### Step 5.1: Create PR Validation Workflow
Create `.github/workflows/validate-pr.yml`:
```yaml
name: Validate PR
on:
  pull_request:
    paths:
      - 'data/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate data
        run: npm run validate
      
      - name: Comment on PR
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const status = '${{ job.status }}' === 'success' ? '✅' : '❌';
            const message = status === '✅' 
              ? 'Data validation passed!' 
              : 'Data validation failed. Please check the logs.';
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `${status} ${message}`
            });
```

### Step 5.2: Create Automated Check Workflow
Create `.github/workflows/check-ipv6.yml`:
```yaml
name: Automated IPv6 Check
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:  # Allow manual trigger

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run IPv6 checks
        run: npm run check-ipv6
      
      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: '🤖 Automated IPv6 status update'
          title: '🤖 Automated IPv6 status update - ${{ steps.date.outputs.date }}'
          body: |
            This PR contains automated updates to IPv6 status based on DNS checks.
            
            Please review the changes and merge if they look correct.
          branch: automated-ipv6-check-${{ github.run_number }}
          delete-branch: true
```

### Step 5.3: Create Deploy Workflow
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build site
        run: npm run build
      
      - name: Deploy to Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
      
      - name: Upload to KV
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: kv:bulk put --binding=SITE_KV ./site/dist
```

### Step 5.4: Create PR Template
Create `.github/pull_request_template.md`:
```markdown
## Service Update

**Service Name:** 
**Current Status:** 
**New Status:** 

### Verification Method
- [ ] Automated DNS check
- [ ] Manual testing
- [ ] Official documentation

### Evidence
<!-- Provide links, screenshots, or other evidence -->

### Notes
<!-- Any additional context -->

---
- [ ] Data validates against schema
- [ ] No duplicate service IDs
- [ ] Status change is justified
```

## Phase 6: Documentation

### Step 6.1: Create README
Create `README.md`:
```markdown
# Are We IPv6 Yet?

Track IPv6 adoption across popular services and applications.

## 🌐 Live Site
Visit [areweipv6yet.com](https://areweipv6yet.com)

## 📊 Current Status
- ✅ Full Support: X services
- 🟨 Partial Support: Y services  
- ❌ No Support: Z services
- ❓ Unknown: W services

## 🤝 Contributing

### Adding/Updating a Service
1. Fork this repository
2. Edit `data/services.yaml`
3. Run `npm run validate` to check your changes
4. Submit a PR with evidence of IPv6 status

### Status Definitions
- **full**: Service works completely over IPv6
- **partial**: Service has AAAA records but may have limitations
- **none**: No IPv6 support detected
- **unknown**: Not yet verified

### Manual Verification
For services beyond simple AAAA checking:
1. Test from IPv6-only network if possible
2. Document any limitations in notes
3. Include verification date

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Cloudflare account (for deployment)

### Setup
\`\`\`bash
npm install
npm run build
npm run dev  # Local development with Wrangler
\`\`\`

### Scripts
- `npm run check-ipv6` - Run automated IPv6 checks
- `npm run validate` - Validate data against schema
- `npm run build` - Build static site
- `npm run deploy` - Deploy to Cloudflare Workers

## 📝 License
MIT

## 🙏 Acknowledgments
Inspired by other "Are We X Yet" sites tracking technology adoption.
```

## Implementation Order

1. **Start with Phase 1**: Set up basic structure and initial data
2. **Test locally**: Run check-ipv6 script to populate initial AAAA data
3. **Build Phase 2-3**: Get core functionality and basic site working
4. **Test site locally**: Use `wrangler dev` to preview
5. **Set up Cloudflare**: Create KV namespace, add API token to GitHub secrets
6. **Deploy Phase 4-5**: Get CI/CD pipeline working
7. **Launch MVP**: Announce and start accepting contributions
8. **Iterate**: Add more services, improve detection, add features

## Next Steps After MVP

1. Add more services (gradually expand from 3 to 100+)
2. Implement IPv6-only connectivity testing (not just AAAA)
3. Add historical tracking and graphs
4. Create embeddable badges for sites
5. Add categories and better filtering
6. Implement user reports/corrections
7. Add regional ISP tracking
8. Create automated alerts for status changes

## Required Secrets in GitHub
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers and KV permissions

## Commands for Claude Code to Run

```bash
# Initial setup
npm install

# First data check
npm run check-ipv6

# Validate and build
npm run validate
npm run build

# Test locally
npm run dev

# When ready to deploy
npm run deploy
```

This plan provides a complete, incremental path from zero to deployed MVP, with clear extension points for future development.