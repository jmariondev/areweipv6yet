// HTML renderer for the single page. Template literals, no engine.
const SITE_URL = 'https://areweipv6yet.com/';
const GITHUB_URL = 'https://github.com/jmariondev/areweipv6yet';
const TITLE = 'Are We IPv6 Yet? - Track IPv6 Adoption Across Popular Services';
const DESCRIPTION =
  'Find out if Google, Netflix, GitHub, and 60+ other popular services support IPv6. ' +
  'Community-driven tracker with automated DNS verification and detailed test results.';

const STATUS_EMOJI = { full: '✅', partial: '🟨', none: '❌', unknown: '❓' };
const STATUS_LABEL = { full: 'Full Support', partial: 'Partial Support', none: 'No Support', unknown: 'Unknown' };

export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const shortDate = (iso) => iso?.slice(0, 10) ?? '';

function testItem(label, check, aux = false) {
  const cls = check.pass ? 'test-pass' : 'test-fail';
  const icon = check.pass ? '✅' : '❌';
  const title = `${check.pass ? 'Passing' : 'Failing'} since ${shortDate(check.since)} (${check.method})`;
  return `<div class="test-item ${cls}${aux ? ' aux' : ''}" title="${esc(title)}">
        <span class="test-icon">${icon}</span>
        <span class="test-label">${esc(label)}</span>
      </div>`;
}

function httpNote(service) {
  const http = service.checks.http;
  if (!http) return '';
  if (http.pass) {
    return `<p class="http-note">Reachability verified over IPv6 on ${shortDate(http.checked_at)}</p>`;
  }
  if (service.checks.web?.pass) {
    return `<p class="http-note http-warn">⚠️ Has AAAA records, but our IPv6 probe couldn't connect on ${shortDate(http.checked_at)}</p>`;
  }
  return '';
}

function card(service) {
  const { checks } = service;
  const applicable = (check) => check && check.pass !== null;

  const tests = [
    applicable(checks.web) ? testItem('Apex Domain', checks.web) : '',
    applicable(checks.www) ? testItem('WWW Domain', checks.www) : '',
    applicable(checks.mx) ? testItem('Mail (MX)', checks.mx, true) : '',
    applicable(checks.ns) ? testItem('DNS (NS)', checks.ns, true) : '',
  ].filter(Boolean);

  const manualBadge = service.override
    ? `<span class="manual-badge" title="${esc(service.override.reason)}">manual</span>`
    : '';

  return `<div class="service-card status-${service.status}" data-service-id="${esc(service.id)}">
    <div class="service-header">
      <h3>${esc(service.name)}</h3>
      <div class="status-badge">
        <span class="status-emoji">${STATUS_EMOJI[service.status]}</span>
        <span class="status-text">${service.status}</span>${manualBadge}
      </div>
    </div>
    <p class="service-url">${esc(service.url)}</p>
    ${service.description ? `<p class="service-description">${esc(service.description)}</p>` : ''}
    ${tests.length ? `<div class="service-tests">\n      ${tests.join('\n      ')}\n    </div>` : ''}
    ${httpNote(service)}
  </div>`;
}

function progressSegment(status, count, percent) {
  if (status === 'unknown' && count === 0) return '';
  return `<div class="progress-segment progress-${status}" style="width: ${percent}%" title="${STATUS_LABEL[status]}: ${count} services (${percent}%)">
        <span class="progress-label">${count}</span>
      </div>`;
}

function summary(stats) {
  const pct = {};
  for (const status of ['full', 'partial', 'none', 'unknown']) {
    pct[status] = Math.round((stats[status] / stats.total) * 100);
  }

  const legendItem = (status) =>
    status === 'unknown' && stats.unknown === 0
      ? ''
      : `<div class="legend-item">
        <span class="legend-color legend-${status}"></span>
        <span>${STATUS_LABEL[status].replace(' Support', '')} (${pct[status]}%)</span>
      </div>`;

  const stat = (status) =>
    status === 'unknown' && stats.unknown === 0
      ? ''
      : `<div class="stat stat-${status}">
      <span class="stat-number">${stats[status]}</span>
      <span class="stat-label">${STATUS_LABEL[status]}</span>
    </div>`;

  return `<section class="summary">
  <div class="progress-container">
    <h2 class="progress-title">IPv6 Adoption Progress</h2>
    <p class="progress-note">(among the services we track!)</p>
    <div class="progress-bar">
      ${['full', 'partial', 'none', 'unknown'].map((s) => progressSegment(s, stats[s], pct[s])).filter(Boolean).join('\n      ')}
    </div>
    <div class="progress-legend">
      ${['full', 'partial', 'none', 'unknown'].map(legendItem).filter(Boolean).join('\n      ')}
    </div>
  </div>
  <div class="stats">
    ${['full', 'partial', 'none', 'unknown'].map(stat).filter(Boolean).join('\n    ')}
  </div>
</section>`;
}

function filters(stats) {
  return `<section class="filters">
  <input type="search" id="search" placeholder="Search services...">
  <div class="filter-buttons">
    <button class="filter-btn active" data-filter="all">All</button>
    <button class="filter-btn" data-filter="full">✅ Full</button>
    <button class="filter-btn" data-filter="partial">🟨 Partial</button>
    <button class="filter-btn" data-filter="none">❌ None</button>
    ${stats.unknown > 0 ? '<button class="filter-btn" data-filter="unknown">❓ Unknown</button>' : ''}
  </div>
</section>`;
}

const CONTRIBUTE = `<section class="contribute-section">
  <div class="contribute-card">
    <h2>🚀 Help Track IPv6 Adoption!</h2>
    <p>This project relies on community contributions to stay accurate and up-to-date.</p>
    <div class="contribute-actions">
      <div class="contribute-item">
        <h3>📝 Add Missing Services</h3>
        <p>Know a service that's not listed? Add it to our database!</p>
      </div>
      <div class="contribute-item">
        <h3>🔄 Update Status</h3>
        <p>Found incorrect IPv6 status? Help us fix it!</p>
      </div>
      <div class="contribute-item">
        <h3>🐛 Report Issues</h3>
        <p>Spotted a problem? Let us know!</p>
      </div>
    </div>
    <a href="${GITHUB_URL}" class="contribute-btn">
      <svg class="github-icon" viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      Contribute on GitHub
    </a>
    <p class="contribute-note">All contributions are welcome! Check our README for guidelines.</p>
  </div>
</section>`;

export function page({ services, stats, generated, runs }) {
  const checkedLine = [
    runs.dns ? `DNS checked ${shortDate(runs.dns.at)}` : '',
    runs.http ? `IPv6 reachability probed ${shortDate(runs.http.at)}` : '',
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(TITLE)}</title>
  <meta name="description" content="${esc(DESCRIPTION)}">
  <meta name="keywords" content="IPv6, IPv6 adoption, IPv6 support, IPv6 status, IPv6 checker, IPv6 test, network protocols, internet protocol">
  <link rel="canonical" href="${SITE_URL}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:title" content="Are We IPv6 Yet? - Track IPv6 Adoption">
  <meta property="og:description" content="${esc(DESCRIPTION)}">
  <meta property="og:site_name" content="Are We IPv6 Yet?">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${SITE_URL}">
  <meta name="twitter:title" content="Are We IPv6 Yet? - Track IPv6 Adoption">
  <meta name="twitter:description" content="${esc(DESCRIPTION)}">

  <link rel="stylesheet" href="style.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Are We IPv6 Yet?",
    "description": "Track IPv6 adoption across major websites and services with real-time status monitoring",
    "url": "${SITE_URL}",
    "author": {
      "@type": "Organization",
      "name": "Are We IPv6 Yet Community",
      "url": "${GITHUB_URL}"
    },
    "about": {
      "@type": "Thing",
      "name": "IPv6 Protocol Adoption",
      "description": "Internet Protocol version 6 adoption tracking"
    },
    "dateModified": "${generated}",
    "inLanguage": "en-US"
  }
  </script>
</head>
<body>
  <header>
    <h1>Are We IPv6 Yet?</h1>
    <p class="tagline">Track IPv6 adoption across major websites and services</p>
  </header>

  <main>
${summary(stats)}

${filters(stats)}

<section class="services" id="services">
  ${services.map(card).join('\n  ')}
</section>

${CONTRIBUTE}
  </main>

  <footer>
    <p>Last updated: <time datetime="${generated}">${generated}</time></p>
    ${checkedLine ? `<p class="checked-line">${checkedLine}</p>` : ''}
    <p>
      <a href="${GITHUB_URL}">Contribute on GitHub</a> |
      <a href="/api.json">Raw Data</a>
    </p>
    <div class="disclaimer">
      <p><strong>Disclaimer:</strong></p>
      <p>
        This data is provided "as is" for informational purposes only. IPv6 support status is based on
        automated DNS checks and community contributions. Actual IPv6 functionality may vary by region,
        ISP, and service configuration. We make no warranties about the accuracy, completeness, or
        currency of this information. Service names and trademarks belong to their respective owners.
        Always verify IPv6 support directly with service providers for critical applications.
      </p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>
`;
}
