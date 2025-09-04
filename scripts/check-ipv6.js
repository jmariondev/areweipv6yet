/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as dns } from 'dns';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import { URL } from 'url';
import https from 'https';
import http from 'http';

// Parse command line arguments
const args = process.argv.slice(2);
const verboseMode = args.includes('--verbose') || args.includes('-v');
const detailMode = args.includes('--detail') || args.includes('-d');

async function checkAAAARecord(hostname) {
  try {
    const addresses = await dns.resolve6(hostname);
    return { hasRecord: true, addresses };
  } catch (error) {
    return { hasRecord: false, addresses: [] };
  }
}

async function getARecord(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses;
  } catch (error) {
    return [];
  }
}

async function testHTTPConnectivity(url, forceIPv6 = false) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const module = isHttps ? https : http;
      const port = urlObj.port || (isHttps ? 443 : 80);
      
      const options = {
        hostname: urlObj.hostname,
        port: port,
        path: urlObj.pathname || '/',
        method: 'HEAD',
        timeout: 5000,
        family: forceIPv6 ? 6 : 0, // 6 = IPv6 only, 0 = any
        headers: {
          'User-Agent': 'areweipv6yet-checker/1.0'
        }
      };
      
      const req = module.request(options, (res) => {
        resolve({
          success: true,
          statusCode: res.statusCode,
          error: null
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          statusCode: null,
          error: error.code || error.message
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
      
      req.end();
    } catch (error) {
      resolve({
        success: false,
        statusCode: null,
        error: error.message
      });
    }
  });
}

async function checkWWWVariant(originalUrl) {
  try {
    const urlObj = new URL(originalUrl);
    const hostname = urlObj.hostname;
    
    // Determine the alternate hostname (add/remove www)
    // Skip www variant testing for subdomains that aren't just "www"
    let alternateHostname;
    if (hostname.startsWith('www.')) {
      alternateHostname = hostname.substring(4);
    } else {
      // Don't test www variant for complex subdomains like azure.microsoft.com
      const parts = hostname.split('.');
      if (parts.length > 2) {
        // Skip www testing for subdomains like store.steampowered.com, cloud.google.com, etc.
        return {
          hostname: 'N/A (subdomain)',
          hasAAAA: false,
          httpWorks: false,
          error: 'Skipped - not applicable for subdomains',
          addresses: [],
          skipped: true
        };
      }
      alternateHostname = 'www.' + hostname;
    }
    
    // Check DNS records for alternate hostname
    const [aaaa, connectTest] = await Promise.all([
      checkAAAARecord(alternateHostname),
      testHTTPConnectivity(`${urlObj.protocol}//${alternateHostname}${urlObj.pathname}`, true)
    ]);
    
    return {
      hostname: alternateHostname,
      hasAAAA: aaaa.hasRecord,
      httpWorks: connectTest.success,
      error: connectTest.error,
      addresses: aaaa.addresses.slice(0, 2), // First 2 addresses only
      skipped: false
    };
  } catch (error) {
    return {
      hostname: null,
      hasAAAA: false,
      httpWorks: false,
      error: error.message,
      addresses: [],
      skipped: false
    };
  }
}

async function getDNSInfo(hostname, originalUrl) {
  const [aaaa, a, wwwVariant, mainHTTP] = await Promise.all([
    checkAAAARecord(hostname),
    getARecord(hostname),
    checkWWWVariant(originalUrl),
    testHTTPConnectivity(originalUrl, true)
  ]);
  
  return {
    hasAAAA: aaaa.hasRecord,
    ipv6Addresses: aaaa.addresses,
    ipv4Addresses: a,
    dualStack: aaaa.hasRecord && a.length > 0,
    wwwVariant: wwwVariant,
    mainHTTP: mainHTTP
  };
}

async function main() {
  // Load current data
  const dataFile = await fs.readFile('data/services.yaml', 'utf8');
  const data = yaml.load(dataFile);
  
  let updated = false;
  
  console.log(`IPv6 Checker${verboseMode ? ' (verbose)' : ''}${detailMode ? ' (detailed)' : ''}`);
  
  for (const service of data.services) {
    const url = new URL(service.url);
    const hostname = url.hostname;
    
    console.log(`\n${service.name} (${service.url})`);
    
    if (detailMode) {
      console.log(`   Current Status: ${service.ipv6.status}`);
      if (service.description) {
        console.log(`   Description: ${service.description}`);
      }
      if (service.ipv6.notes) {
        console.log(`   Notes: ${service.ipv6.notes}`);
      }
    }
    
    const dnsInfo = await getDNSInfo(hostname, service.url);
    const now = new Date().toISOString();
    
    if (verboseMode || detailMode) {
      const wwwStatus = dnsInfo.wwwVariant.skipped ? 'N/A' : 
                       (dnsInfo.wwwVariant.hasAAAA && dnsInfo.wwwVariant.httpWorks ? '✓' : '✗');
      console.log(`  AAAA: ${dnsInfo.hasAAAA ? '✓' : '✗'}, HTTP: ${dnsInfo.mainHTTP.success ? '✓' : '✗'}, WWW: ${wwwStatus} (${dnsInfo.wwwVariant.hostname})${verboseMode && dnsInfo.ipv6Addresses.length > 0 ? ' [' + dnsInfo.ipv6Addresses.slice(0,2).join(', ') + ']' : ''}`);
    }
    
    
    // Update the data using tests array
    let serviceUpdated = false;
    
    // Find or create tests
    let aaaaTest = service.ipv6.tests.find(t => t.id === 'aaaa_record');
    let wwwTest = service.ipv6.tests.find(t => t.id === 'www_variant');
    
    if (!aaaaTest) {
      aaaaTest = {
        id: 'aaaa_record',
        name: 'IPv6 Address',
        description: 'Main domain works over IPv6 (both DNS and HTTP connectivity)',
        result: null
      };
      service.ipv6.tests.push(aaaaTest);
    }
    
    if (!wwwTest) {
      wwwTest = {
        id: 'www_variant',
        name: 'WWW Variant',
        description: 'Alternative www/non-www hostname works over IPv6 (both DNS and HTTP connectivity)',
        result: null
      };
      service.ipv6.tests.push(wwwTest);
    }
    
    // Update main test (both DNS and HTTP must work)
    const mainWorks = dnsInfo.hasAAAA && dnsInfo.mainHTTP.success;
    if (aaaaTest.result !== mainWorks) {
      aaaaTest.result = mainWorks;
      serviceUpdated = true;
      console.log(`  → Main: ${mainWorks} (DNS: ${dnsInfo.hasAAAA}, HTTP: ${dnsInfo.mainHTTP.success})`);
    }
    
    // Update WWW variant test (both DNS and HTTP must work, or null if skipped)
    const wwwWorks = dnsInfo.wwwVariant.skipped ? null : 
                     (dnsInfo.wwwVariant.hasAAAA && dnsInfo.wwwVariant.httpWorks);
    if (wwwTest.result !== wwwWorks) {
      wwwTest.result = wwwWorks;
      serviceUpdated = true;
      const status = wwwWorks === null ? 'skipped' : wwwWorks;
      console.log(`  → WWW: ${status} (${dnsInfo.wwwVariant.hostname})`);
    }
    
    if (serviceUpdated) {
      service.ipv6.last_checked = now;
      
      // Update status based on main connectivity (only if unknown)
      if (mainWorks && service.ipv6.status === 'unknown') {
        service.ipv6.status = 'partial'; // Conservative assumption
      } else if (!mainWorks && service.ipv6.status === 'unknown') {
        service.ipv6.status = 'none';
      }
      
      // Check for status mismatches (but don't auto-update)
      // Treat skipped WWW tests as neutral (don't affect status suggestion)
      const wwwForStatus = wwwWorks === null ? false : wwwWorks; // Treat null as false for status logic
      const suggestedStatus = (mainWorks && wwwForStatus) ? 'full' : 
                             (mainWorks || wwwForStatus) ? 'partial' : 'none';
      if (service.ipv6.status !== suggestedStatus && detailMode) {
        console.log(`  ⚠️  Status mismatch: currently "${service.ipv6.status}" but tests suggest "${suggestedStatus}"`);
      }
      
      updated = true;
    } else {
      service.ipv6.last_checked = now;
      if (!detailMode && !verboseMode) {
        const wwwDisplay = wwwWorks === null ? 'N/A' : (wwwWorks ? '✓' : '✗');
        console.log(`  No changes (Main: ${mainWorks ? '✓' : '✗'}, WWW: ${wwwDisplay})`);
      }
    }
  }
  
  
  // Summary statistics
  const stats = {
    total: data.services.length,
    withMain: data.services.filter(s => {
      const mainTest = s.ipv6.tests.find(t => t.id === 'aaaa_record');
      return mainTest && mainTest.result === true;
    }).length,
    withWWW: data.services.filter(s => {
      const wwwTest = s.ipv6.tests.find(t => t.id === 'www_variant');
      return wwwTest && wwwTest.result === true;
    }).length,
    full: data.services.filter(s => s.ipv6.status === 'full').length,
    partial: data.services.filter(s => s.ipv6.status === 'partial').length,
    none: data.services.filter(s => s.ipv6.status === 'none').length,
    unknown: data.services.filter(s => s.ipv6.status === 'unknown').length
  };
  
  console.log(`\nSummary: ${stats.total} services, ${stats.withMain} Main (${Math.round(stats.withMain/stats.total*100)}%), ${stats.withWWW} WWW (${Math.round(stats.withWWW/stats.total*100)}%) | ${stats.full}F ${stats.partial}P ${stats.none}N ${stats.unknown}U`);
  
  if (updated) {
    // Write updated data
    await fs.writeFile('data/services.yaml', yaml.dump(data), 'utf8');
    console.log('Updated data file');
  } else {
    console.log('No changes to data file');
  }
  
}

main().catch(console.error);