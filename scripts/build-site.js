/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyCss } from 'csso';
import { minify as minifyJs } from 'terser';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    <div class="service-card ${statusClass}" data-service-id="${service.id}">
      <div class="service-header">
        <h3>${service.name}</h3>
        <div class="status-badge">
          <span class="status-emoji">${statusEmoji}</span>
          <span class="status-text">${service.ipv6.status}</span>
        </div>
      </div>
      <p class="service-url">${service.url}</p>
      ${service.description ? `<p class="service-description">${service.description}</p>` : ''}
      
      ${service.ipv6.notes ? `<p class="service-notes">${service.ipv6.notes}</p>` : ''}
      
      <div class="service-tests">
        ${service.ipv6.tests.filter(test => test.result !== null).map(test => {
          const testClass = test.result === true ? 'test-pass' : test.result === false ? 'test-fail' : 'test-unknown';
          const isSecondary = (test.id === 'www_variant' || test.id === 'www_domain') ? 'test-secondary' : '';
          const icon = test.result === true ? '✅' : test.result === false ? '❌' : '❓';
          
          return `
            <div class="test-item ${testClass} ${isSecondary}" title="${test.description || ''}">
              <span class="test-icon">${icon}</span>
              <span class="test-label">${test.name}</span>
            </div>
          `;
        }).join('')}
      </div>
      
      ${service.ipv6.last_checked ? `<p class="last-checked">Last checked: ${new Date(service.ipv6.last_checked).toISOString().split('T')[0]}</p>` : ''}
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
    .replaceAll('{{LAST_UPDATED}}', new Date().toISOString());
  
  // Ensure dist directory exists
  await fs.mkdir('site/dist', { recursive: true });
  
  // Minify HTML
  const minifiedHtml = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true
  });
  
  // Minify CSS
  const cssContent = await fs.readFile('site/src/style.css', 'utf8');
  const minifiedCss = minifyCss(cssContent).css;
  
  // Minify JavaScript
  const jsContent = await fs.readFile('site/src/script.js', 'utf8');
  const minifiedJs = await minifyJs(jsContent, {
    compress: true,
    mangle: true
  });
  
  // Generate SRI hashes for CSS and JS
  const cssHash = crypto.createHash('sha384').update(minifiedCss).digest('base64');
  const jsHash = crypto.createHash('sha384').update(minifiedJs.code).digest('base64');
  
  // Add SRI attributes to HTML
  const htmlWithSri = minifiedHtml
    .replace(
      '<link rel="stylesheet" href="style.css">',
      `<link rel="stylesheet" href="style.css" integrity="sha384-${cssHash}" crossorigin="anonymous">`
    )
    .replace(
      '<script src="script.js"></script>',
      `<script src="script.js" integrity="sha384-${jsHash}" crossorigin="anonymous"></script>`
    );
  
  // Write minified output files with SRI
  await fs.writeFile('site/dist/index.html', htmlWithSri);
  await fs.writeFile('site/dist/style.css', minifiedCss);
  await fs.writeFile('site/dist/script.js', minifiedJs.code);
  
  // Copy robots.txt and humans.txt if they exist
  try {
    await fs.copyFile('site/src/robots.txt', 'site/dist/robots.txt');
  } catch (e) {
    // File doesn't exist, ignore
  }
  try {
    await fs.copyFile('site/src/humans.txt', 'site/dist/humans.txt');
  } catch (e) {
    // File doesn't exist, ignore
  }
  
  // Copy .well-known directory if it exists
  try {
    const wellKnownFiles = await fs.readdir('site/src/.well-known');
    await fs.mkdir('site/dist/.well-known', { recursive: true });
    for (const file of wellKnownFiles) {
      await fs.copyFile(
        path.join('site/src/.well-known', file),
        path.join('site/dist/.well-known', file)
      );
    }
  } catch (e) {
    // Directory doesn't exist, ignore
  }
  
  // Generate API JSON
  await fs.writeFile('site/dist/api.json', JSON.stringify(data, null, 2));
  
  // Generate sitemap with current date
  try {
    const sitemapTemplate = await fs.readFile('site/src/sitemap.xml', 'utf8');
    const sitemap = sitemapTemplate.replace(/{{LAST_UPDATED}}/g, new Date().toISOString().split('T')[0]);
    await fs.writeFile('site/dist/sitemap.xml', sitemap);
  } catch (e) {
    // Sitemap doesn't exist, ignore
  }
  
  // Calculate size reductions
  const originalSizes = {
    html: Buffer.byteLength(html),
    css: Buffer.byteLength(cssContent),
    js: Buffer.byteLength(jsContent)
  };
  
  const minifiedSizes = {
    html: Buffer.byteLength(htmlWithSri),
    css: Buffer.byteLength(minifiedCss),
    js: Buffer.byteLength(minifiedJs.code)
  };
  
  console.log('✅ Site built successfully');
  console.log('📦 Minification results:');
  console.log(`  HTML: ${originalSizes.html} → ${minifiedSizes.html} bytes (${Math.round((1 - minifiedSizes.html/originalSizes.html) * 100)}% reduction)`);
  console.log(`  CSS:  ${originalSizes.css} → ${minifiedSizes.css} bytes (${Math.round((1 - minifiedSizes.css/originalSizes.css) * 100)}% reduction)`);
  console.log(`  JS:   ${originalSizes.js} → ${minifiedSizes.js} bytes (${Math.round((1 - minifiedSizes.js/originalSizes.js) * 100)}% reduction)`);
  console.log('🔒 SRI hashes generated for security');
}

main().catch(console.error);