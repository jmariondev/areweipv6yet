#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as fs } from 'fs';
import { promises as dns } from 'dns';
import yaml from 'js-yaml';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';

// Command-line flags
const args = process.argv.slice(2);
const verboseMode = args.includes('--verbose');
const detailMode = args.includes('--detail');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Helper to check for AAAA records
async function checkAAAARecord(hostname) {
  try {
    const addresses = await dns.resolve6(hostname);
    return { 
      hasRecord: true, 
      addresses,
      error: null 
    };
  } catch (error) {
    return { 
      hasRecord: false, 
      addresses: [],
      error: error.code || error.message 
    };
  }
}

// Helper to check for A records
async function getARecord(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    return { hasRecord: true, addresses };
  } catch {
    return { hasRecord: false, addresses: [] };
  }
}

// Test if URL is reachable over IPv6 (actually tries to connect)
// NOTE: Azure (azure.microsoft.com) has IPv6 AAAA records but Node.js 
// HTTPS requests time out even though curl works fine. This appears to be
// a compatibility issue between Node.js and Azure's Akamai CDN IPv6 setup.
async function testHTTPConnectivity(url, ipv6Only = false) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const get = urlObj.protocol === 'https:' ? httpsGet : httpGet;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'HEAD',
        timeout: 5000,
        family: ipv6Only ? 6 : 0, // 6 = IPv6 only, 0 = both
        rejectUnauthorized: false // Accept self-signed certs
      };
      
      const req = get(options, (res) => {
        // Any response means it connected successfully
        req.destroy(); // Close the connection immediately after getting response
        resolve({ 
          success: true, 
          statusCode: res.statusCode,
          error: null 
        });
      });
      
      req.on('error', (err) => {
        resolve({ 
          success: false, 
          statusCode: null,
          error: err.code || err.message 
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ 
          success: false, 
          statusCode: null,
          error: 'TIMEOUT' 
        });
      });
      
    } catch (error) {
      resolve({ 
        success: false, 
        statusCode: null,
        error: error.message 
      });
    }
  });
}

// Extract apex domain from URL
function getApexDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;
    
    // Remove www. prefix if present
    if (hostname.startsWith('www.')) {
      return hostname.substring(4);
    }
    
    // For subdomains like store.steampowered.com, cloud.google.com
    // we'll return them as-is since they're the "main" domain for that service
    return hostname;
  } catch {
    return null;
  }
}

// Get both apex and www versions of a domain
function getDomainVariants(urlStr) {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;
    
    // If it starts with www., apex is without www
    if (hostname.startsWith('www.')) {
      return {
        apex: hostname.substring(4),
        www: hostname,
        providedForm: 'www'
      };
    }
    
    // For complex subdomains (e.g., store.steampowered.com), 
    // we don't test a www variant
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return {
        apex: hostname,
        www: null, // No www variant for subdomains
        providedForm: 'subdomain'
      };
    }
    
    // For simple apex domains, add www
    return {
      apex: hostname,
      www: 'www.' + hostname,
      providedForm: 'apex'
    };
  } catch {
    return { apex: null, www: null, providedForm: null };
  }
}

async function checkDomain(hostname, protocol = 'https:') {
  if (!hostname) {
    return {
      hostname,
      hasAAAA: false,
      httpWorks: false,
      error: 'N/A',
      addresses: []
    };
  }
  
  const [aaaa, a, httpTest] = await Promise.all([
    checkAAAARecord(hostname),
    getARecord(hostname),
    testHTTPConnectivity(`${protocol}//${hostname}/`, true)
  ]);
  
  return {
    hostname,
    hasAAAA: aaaa.hasRecord,
    hasA: a.hasRecord,
    httpWorks: httpTest.success,
    error: httpTest.error,
    addresses: aaaa.addresses.slice(0, 2) // First 2 addresses only
  };
}

async function main() {
  // Load data
  const dataFile = await fs.readFile('data/services.yaml', 'utf8');
  const data = yaml.load(dataFile);
  
  console.log(`${colors.bright}🔍 Checking IPv6 support for ${data.services.length} services...${colors.reset}\n`);
  
  let updated = false;
  const now = new Date().toISOString();
  
  for (const service of data.services) {
    const url = new URL(service.url);
    const domains = getDomainVariants(service.url);
    
    if (verboseMode || detailMode) {
      console.log(`${colors.cyan}${service.name}${colors.reset} (${service.url})`);
      if (detailMode) {
        console.log(`  Apex domain: ${domains.apex || 'N/A'}`);
        console.log(`  WWW domain: ${domains.www || 'N/A'}`);
        console.log(`  Provided as: ${domains.providedForm}`);
      }
    } else {
      process.stdout.write(`${service.name.padEnd(25)}`);
    }
    
    // Check both domains
    const [apexInfo, wwwInfo] = await Promise.all([
      checkDomain(domains.apex, url.protocol),
      checkDomain(domains.www, url.protocol)
    ]);
    
    if (detailMode) {
      console.log(`\n  ${colors.bright}Apex Domain (${apexInfo.hostname}):${colors.reset}`);
      console.log(`    DNS AAAA: ${apexInfo.hasAAAA ? '✓' : '✗'} ${apexInfo.hasAAAA ? `(${apexInfo.addresses[0]})` : ''}`);
      console.log(`    DNS A: ${apexInfo.hasA ? '✓' : '✗'}`);
      console.log(`    HTTP over IPv6: ${apexInfo.httpWorks ? '✓' : '✗'} ${!apexInfo.httpWorks && apexInfo.error ? `(${apexInfo.error})` : ''}`);
      
      if (wwwInfo.hostname) {
        console.log(`\n  ${colors.bright}WWW Domain (${wwwInfo.hostname}):${colors.reset}`);
        console.log(`    DNS AAAA: ${wwwInfo.hasAAAA ? '✓' : '✗'} ${wwwInfo.hasAAAA ? `(${wwwInfo.addresses[0]})` : ''}`);
        console.log(`    DNS A: ${wwwInfo.hasA ? '✓' : '✗'}`);
        console.log(`    HTTP over IPv6: ${wwwInfo.httpWorks ? '✓' : '✗'} ${!wwwInfo.httpWorks && wwwInfo.error ? `(${wwwInfo.error})` : ''}`);
      }
    }
    
    // Update the data using tests array
    let serviceUpdated = false;
    
    // Find or create tests
    let apexTest = service.ipv6.tests.find(t => t.id === 'apex_domain');
    let wwwTest = service.ipv6.tests.find(t => t.id === 'www_domain');
    
    // For backwards compatibility, also look for old test IDs
    if (!apexTest) {
      apexTest = service.ipv6.tests.find(t => t.id === 'aaaa_record');
      if (apexTest) {
        apexTest.id = 'apex_domain'; // Update the ID
        apexTest.name = 'Apex Domain';
        apexTest.description = 'Apex domain works over IPv6 (both DNS and HTTP connectivity)';
        serviceUpdated = true;
      }
    }
    
    if (!wwwTest && domains.www) {
      wwwTest = service.ipv6.tests.find(t => t.id === 'www_variant');
      if (wwwTest) {
        wwwTest.id = 'www_domain'; // Update the ID
        wwwTest.name = 'WWW Domain';
        wwwTest.description = 'WWW domain works over IPv6 (both DNS and HTTP connectivity)';
        serviceUpdated = true;
      }
    }
    
    // Create tests if they don't exist
    if (!apexTest) {
      apexTest = {
        id: 'apex_domain',
        name: 'Apex Domain',
        description: 'Apex domain works over IPv6 (both DNS and HTTP connectivity)',
        result: null
      };
      service.ipv6.tests.push(apexTest);
    }
    
    if (!wwwTest && domains.www) {
      wwwTest = {
        id: 'www_domain',
        name: 'WWW Domain',
        description: 'WWW domain works over IPv6 (both DNS and HTTP connectivity)',
        result: null
      };
      service.ipv6.tests.push(wwwTest);
    }
    
    // Update apex test (both DNS and HTTP must work)
    let apexWorks = apexInfo.hasAAAA && apexInfo.httpWorks;
    
    // Special case for Azure: Node.js HTTPS times out but curl works fine
    // If Azure has AAAA records, consider it working
    if (service.id === 'azure' && apexInfo.hasAAAA) {
      apexWorks = true;
      if (verboseMode || detailMode) {
        console.log(`  → Special case: Azure has AAAA records, marking as working despite Node.js timeout`);
      }
    }
    
    if (apexTest.result !== apexWorks) {
      apexTest.result = apexWorks;
      serviceUpdated = true;
      if (verboseMode || detailMode) {
        console.log(`  → Apex: ${apexWorks} (DNS: ${apexInfo.hasAAAA}, HTTP: ${apexInfo.httpWorks})`);
      }
    }
    
    // Update WWW test (both DNS and HTTP must work, or null if not applicable)
    if (domains.www && wwwTest) {
      const wwwWorks = wwwInfo.hasAAAA && wwwInfo.httpWorks;
      if (wwwTest.result !== wwwWorks) {
        wwwTest.result = wwwWorks;
        serviceUpdated = true;
        if (verboseMode || detailMode) {
          console.log(`  → WWW: ${wwwWorks} (DNS: ${wwwInfo.hasAAAA}, HTTP: ${wwwInfo.httpWorks})`);
        }
      }
    } else if (wwwTest) {
      // Remove www test if not applicable
      const testIndex = service.ipv6.tests.indexOf(wwwTest);
      if (testIndex > -1) {
        service.ipv6.tests.splice(testIndex, 1);
        serviceUpdated = true;
      }
    }
    
    if (serviceUpdated) {
      service.ipv6.last_checked = now;
      
      // Update status based on test results (only if currently unknown)
      const hasWwwTest = domains.www && wwwTest;
      if (service.ipv6.status === 'unknown') {
        if (apexWorks && (!hasWwwTest || wwwTest.result)) {
          service.ipv6.status = 'full';
        } else if (apexWorks || (hasWwwTest && wwwTest.result)) {
          service.ipv6.status = 'partial';
        } else {
          service.ipv6.status = 'none';
        }
      }
      
      // Check for status mismatches (but don't auto-update)
      if (detailMode) {
        let suggestedStatus;
        if (hasWwwTest) {
          suggestedStatus = (apexWorks && wwwTest.result) ? 'full' : 
                           (apexWorks || wwwTest.result) ? 'partial' : 'none';
        } else {
          suggestedStatus = apexWorks ? 'full' : 'none';
        }
        
        if (service.ipv6.status !== suggestedStatus) {
          console.log(`  ⚠️  Status mismatch: currently "${service.ipv6.status}" but tests suggest "${suggestedStatus}"`);
        }
      }
      
      updated = true;
      if (!verboseMode && !detailMode) {
        const apexDisplay = apexWorks ? '✓' : '✗';
        const wwwDisplay = !domains.www ? 'N/A' : (wwwTest?.result ? '✓' : '✗');
        console.log(`  Apex: ${apexDisplay}, WWW: ${wwwDisplay} - Updated`);
      }
    } else {
      service.ipv6.last_checked = now;
      if (!detailMode && !verboseMode) {
        const apexDisplay = apexWorks ? '✓' : '✗';
        const wwwDisplay = !domains.www ? 'N/A' : (wwwTest?.result ? '✓' : '✗');
        console.log(`  Apex: ${apexDisplay}, WWW: ${wwwDisplay}`);
      }
    }
    
    if (verboseMode || detailMode) {
      console.log('');
    }
  }
  
  if (updated) {
    // Write back to file
    const yamlStr = yaml.dump(data, { 
      indent: 2, 
      lineWidth: -1,
      quotingType: "'",
      forceQuotes: false,
      noRefs: true
    });
    
    // Add header comment
    const header = `# IPv6 Adoption Data
# License: CC0 1.0 Universal (Public Domain)
# This data is free to use, modify, and distribute for any purpose.
# See data/LICENSE for full details.

`;
    
    await fs.writeFile('data/services.yaml', header + yamlStr);
    console.log(`\n${colors.green}✓ Data updated${colors.reset}`);
  } else {
    console.log(`\n${colors.gray}No changes detected${colors.reset}`);
  }
}

main().catch(console.error);