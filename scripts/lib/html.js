// HTML renderer for the single page. Template literals, no engine.
import { GROUP_ORDER, statusSince, verdict } from './derive.js';

const SITE_URL = 'https://areweipv6yet.com/';
const GITHUB_URL = 'https://github.com/jmariondev/areweipv6yet';
const TITLE = 'Are We IPv6 Yet? - Track IPv6 Adoption Across Popular Services';

const STATUS_LABEL = { full: 'full', partial: 'partial', none: 'none', unknown: 'unknown' };
const FILTER_LABEL = { full: 'Dual-stacked', partial: 'Partial', none: 'Holdouts', unknown: 'Unknown' };

// Group headers carry the snark so the rows don't have to.
const GROUP_META = {
  none: {
    title: 'The Holdouts',
    sub: 'Zero AAAA records on apex or www. World IPv6 Launch was June 2012; the invitation seems to have been lost.',
  },
  partial: {
    title: 'One AAAA Record Away',
    sub: "Half the DNS work is done. It's one record. We believe in you.",
  },
  full: {
    title: 'The Dual-Stacked',
    sub: "Proof it's possible. Some of these did it over a decade ago.",
  },
  unknown: {
    title: 'Unaccounted For',
    sub: 'Our probes came back empty. Make of that what you will.',
  },
};

export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const shortDate = (iso) => iso?.slice(0, 10) ?? '';

const hostOf = (url) => url.replace(/^https:\/\//, '').replace(/\/$/, '');

const pctOf = (part, total) => Math.round((part / total) * 100);

// RFC 1883 ("Internet Protocol, Version 6") was published December 1995.
const yearsSinceRfc1883 = (generated) =>
  Math.floor((Date.parse(generated) - Date.parse('1995-12-04')) / 31557600000);

// ---------------------------------------------------------------------------
// Scoreboard table

const CHECK_COLS = [
  { key: 'web', label: 'WEB', what: 'AAAA on apex domain', na: 'not checked yet' },
  { key: 'www', label: 'WWW', what: 'AAAA on www host', na: 'no separate www host' },
  { key: 'mx', label: 'MX', what: 'AAAA on MX hosts', aux: true, na: 'no MX records published' },
  { key: 'ns', label: 'NS', what: 'AAAA on NS hosts', aux: true, na: 'no NS host addresses' },
  { key: 'http', label: 'HTTP', what: 'HTTP over IPv6', aux: true, na: 'not probed yet' },
];

// One pip cell. All state is expressed as classes + title + hidden text; the
// stylesheet draws the glyphs (CSP forbids inline styles, and emoji are out).
function pipCell(col, service) {
  const check = service.checks[col.key];
  const aux = col.aux ? ' pip--aux' : '';
  let cls;
  let title;
  let hidden;

  if (!check || check.pass === null) {
    cls = `pip--na${aux}`;
    title = `${col.what}: not applicable (${col.na})`;
    hidden = `${col.label}: not applicable`;
  } else if (col.key === 'http') {
    const checked = shortDate(check.checked_at ?? check.since);
    if (check.pass) {
      cls = `pip--pass${aux}`;
      title = `HTTP over IPv6: reachable (checked ${checked})`;
      hidden = 'HTTP: pass';
    } else if (service.checks.web?.pass) {
      cls = `pip--fail pip--warn${aux}`;
      title = `Advertises AAAA records, but our IPv6 probe couldn't connect (checked ${checked})`;
      hidden = 'HTTP: fail despite AAAA records';
    } else {
      cls = `pip--fail${aux}`;
      title = `HTTP over IPv6: unreachable (checked ${checked})`;
      hidden = 'HTTP: fail';
    }
  } else {
    const state = check.pass ? 'passing' : 'failing';
    cls = `${check.pass ? 'pip--pass' : 'pip--fail'}${aux}`;
    title = `${col.what}: ${state} since ${shortDate(check.since)} (${check.method})`;
    hidden = `${col.label}: ${check.pass ? 'pass' : 'fail'}`;
  }

  return `<td class="cell-pip" data-label="${col.label}" role="cell"><span class="pip ${cls}" title="${esc(title)}"><span class="visually-hidden">${esc(hidden)}</span></span></td>`;
}

function serviceRow(service) {
  const manualBadge = service.override
    ? ` <span class="manual-badge" title="${esc(service.override.reason)}">manual</span>`
    : '';
  const since = statusSince(service.checks);
  const sinceCell = since ? `<time datetime="${esc(since)}">${shortDate(since)}</time>` : '';

  return `<tr class="service-row" data-status="${service.status}" data-service-id="${esc(service.id)}" role="row">
        <td class="cell-service" data-label="Service" role="cell">
          <span class="service-name">${esc(service.name)}</span>
          <a class="service-host" href="${esc(service.url)}" rel="noopener">${esc(hostOf(service.url))}</a>${service.description ? `
          <span class="visually-hidden">${esc(service.description)}</span>` : ''}
        </td>
        <td class="cell-status" data-label="Status" role="cell"><span class="status-badge status-${service.status}"><span class="pip pip--lg pip--${service.status}" aria-hidden="true"></span>${STATUS_LABEL[service.status]}</span>${manualBadge}</td>
        ${CHECK_COLS.map((col) => pipCell(col, service)).join('\n        ')}
        <td class="cell-since" data-label="Since" role="cell">${sinceCell}</td>
      </tr>`;
}

function groupBody(status, services) {
  const meta = GROUP_META[status];
  return `<tbody class="group" data-status="${status}" role="rowgroup">
      <tr class="group-row" role="row">
        <th class="group-header" colspan="8" scope="colgroup" role="cell">
          <span class="group-title">${esc(meta.title)}</span>
          <span class="group-count">(${services.length})</span>
          <span class="group-sub">${esc(meta.sub)}</span>
        </th>
      </tr>
      ${services.map(serviceRow).join('\n      ')}
    </tbody>`;
}

function scoreboard(services) {
  const groups = GROUP_ORDER
    .map((status) => [status, services.filter((s) => s.status === status)])
    .filter(([, list]) => list.length > 0)
    .map(([status, list]) => groupBody(status, [...list].sort((a, b) => a.name.localeCompare(b.name))));

  return `<section class="scoreboard" id="services" aria-label="Per-service IPv6 scoreboard">
  <h2 class="section-marker">Scoreboard</h2>
  <div class="table-scroll">
    <table class="scoreboard-table" role="table">
      <caption class="visually-hidden">IPv6 support per service: headline status, individual DNS and HTTP checks, and the date the current status was first observed.</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Service</th>
          <th scope="col" role="columnheader">Status</th>
          ${CHECK_COLS.map((col) => `<th scope="col" class="pip-col${col.aux ? ' aux' : ''}" role="columnheader">${col.label}</th>`).join('\n          ')}
          <th scope="col" class="since-col" role="columnheader">Since<a href="#since-note" class="footnote-ref" aria-label="See note about dates">*</a></th>
        </tr>
      </thead>
      ${groups.join('\n      ')}
    </table>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Hero + verdict

// Wrap a terminal period so the stylesheet can set it in the accent color.
function heroAnswer(answer) {
  return answer.endsWith('.')
    ? `${esc(answer.slice(0, -1))}<span class="hero-dot">.</span>`
    : esc(answer);
}

function hero(stats, theVerdict) {
  const holdoutLine = stats.none > 0
    ? ` The other ${stats.none} are holding out for IPv4 addresses that ran out in 2011.`
    : '';
  return `<section class="hero">
  <h1 class="hero-question">are we ipv6 yet?</h1>
  <p class="hero-answer verdict-${theVerdict.key}">${heroAnswer(theVerdict.answer)}</p>
  <p class="hero-subline">${stats.full} of the ${stats.total} services we track are fully reachable over IPv6.${holdoutLine}</p>
</section>`;
}

function progressSegment(status, count, percent) {
  if (count === 0) return '';
  return `<div class="progress-segment progress-${status}" title="${FILTER_LABEL[status]}: ${count} services (${percent}%)"></div>`;
}

function summary(stats, generated) {
  const pct = {};
  for (const status of ['full', 'partial', 'none', 'unknown']) {
    pct[status] = pctOf(stats[status], stats.total);
  }

  const legendItem = (status) =>
    stats[status] === 0
      ? ''
      : `<div class="legend-item"><span class="pip pip--${status}" aria-hidden="true"></span> ${stats[status]} ${STATUS_LABEL[status]} (${pct[status]}%)</div>`;

  return `<section class="verdict-data" aria-label="Adoption summary">
  <div class="progress-bar">
    ${['full', 'partial', 'none', 'unknown'].map((s) => progressSegment(s, stats[s], pct[s])).filter(Boolean).join('\n    ')}
  </div>
  <div class="progress-legend">
    ${['full', 'partial', 'none', 'unknown'].map(legendItem).filter(Boolean).join('\n    ')}
  </div>
  <div class="stats">
    <div class="stat stat-full">
      <span class="stat-number">${pct.full}%</span>
      <span class="stat-label">fully dual-stacked</span>
    </div>
    <div class="stat stat-none">
      <span class="stat-number">${stats.none}</span>
      <span class="stat-label">IPv4-only holdouts</span>
    </div>
    <div class="stat stat-partial">
      <span class="stat-number">${stats.partial}</span>
      <span class="stat-label">one AAAA record away</span>
    </div>
    <div class="stat stat-years">
      <span class="stat-number">${yearsSinceRfc1883(generated)}</span>
      <span class="stat-label">years since RFC 1883 said this was coming</span>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Filters, methodology, contribute

function filters(stats) {
  const button = (status) =>
    stats[status] === 0
      ? ''
      : `<button class="filter-btn" data-filter="${status}"><span class="pip pip--${status}" aria-hidden="true"></span>${FILTER_LABEL[status]}</button>`;

  return `<section class="filters" aria-label="Filter services">
  <input type="search" id="search" placeholder="grep services..." aria-label="Search services">
  <div class="filter-buttons">
    <button class="filter-btn active" data-filter="all">All</button>
    ${['full', 'partial', 'none', 'unknown'].map(button).filter(Boolean).join('\n    ')}
  </div>
  <p class="filter-count" aria-live="polite">${stats.total} services</p>
</section>`;
}

function methodology(services, aggregates) {
  const unreachable = aggregates.httpUnreachable > 0
    ? ` ${aggregates.httpUnreachable} ${aggregates.httpUnreachable === 1 ? 'service currently publishes' : 'services currently publish'} AAAA records our IPv6 probe couldn't actually connect to; ${aggregates.httpUnreachable === 1 ? "it's" : "they're"} flagged in the HTTP column.`
    : '';
  const githubSelfOwn = services.some((s) => s.id === 'github' && s.status === 'none')
    ? `\n  <p>Yes, GitHub &mdash; where this site&#39;s source lives &mdash; is on the holdout list. We checked. Twice.</p>`
    : '';

  return `<section class="methodology" id="methodology">
  <h2 class="section-marker">Methodology</h2>
  <p>Every day we check DNS AAAA records on each service&#39;s apex and www hosts; those two checks alone decide the verdict. AAAA records on MX and NS hosts, plus an actual HTTP connection over IPv6, are tracked as supporting signals but never change a service&#39;s status.${unreachable}</p>
  <p id="since-note"><span class="footnote-ref">*</span> Dates reflect when our monitoring first observed the current state. Services have typically been this way far longer; our probes are newer than their inertia.</p>${githubSelfOwn}
</section>`;
}

const CONTRIBUTE = `<section class="contribute-section">
  <div class="contribute-card">
    <h2>Public shame is a community effort.</h2>
    <p>Spot a missing service, a wrong verdict, or a holdout that finally flipped?
    The data is a YAML file and a pull request away.</p>
    <a href="${GITHUB_URL}" class="contribute-btn">
      <svg class="github-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      Contribute on GitHub
    </a>
  </div>
</section>`;

// ---------------------------------------------------------------------------
// Page

export function page({ services, stats, generated, runs, aggregates = {} }) {
  const theVerdict = verdict(stats);
  const description =
    `${theVerdict.answer} ${stats.full} of ${stats.total} popular services are checked daily ` +
    `for real IPv6 support. See who's dual-stacked and who's still IPv4-only.`;

  const checkedLine = [
    runs.dns ? `DNS checked ${shortDate(runs.dns.at)}` : '',
    runs.http ? `IPv6 reachability probed ${shortDate(runs.http.at)}` : '',
  ].filter(Boolean).join(' &middot; ');

  return `<!DOCTYPE html>
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(TITLE)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="IPv6, IPv6 adoption, IPv6 support, IPv6 status, IPv6 checker, IPv6 test, network protocols, internet protocol">
  <link rel="canonical" href="${SITE_URL}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:title" content="Are We IPv6 Yet? - Track IPv6 Adoption">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:site_name" content="Are We IPv6 Yet?">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${SITE_URL}">
  <meta name="twitter:title" content="Are We IPv6 Yet? - Track IPv6 Adoption">
  <meta name="twitter:description" content="${esc(description)}">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32">
  <link rel="stylesheet" href="style.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Are We IPv6 Yet?",
    "description": "Track IPv6 adoption across major websites and services with daily automated checks",
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
  <header class="site-header">
    <a class="wordmark" href="/">areweipv6yet<span class="wordmark-mark"> ::</span></a>
    <a class="site-header-link" href="${GITHUB_URL}">source</a>
  </header>

  <main>
${hero(stats, theVerdict)}

${summary(stats, generated)}

${filters(stats)}

${scoreboard(services)}

${methodology(services, aggregates)}

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
      <p>This data is provided &quot;as is&quot; &mdash; much like IPv4 was provided &quot;temporarily&quot;.</p>
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
