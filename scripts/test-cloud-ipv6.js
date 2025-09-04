/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as dns } from 'dns';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';

// Cloud service endpoint patterns
const CLOUD_ENDPOINTS = {
  aws: {
    api: [
      'amazonaws.com',
      'aws.amazon.com',
      'console.aws.amazon.com'
    ],
    services: {
      s3: [
        's3.amazonaws.com',
        's3.us-east-1.amazonaws.com',
        's3.dualstack.us-east-1.amazonaws.com',
        's3-accelerate.amazonaws.com',
        's3-accelerate.dualstack.amazonaws.com'
      ],
      ec2: [
        'ec2.amazonaws.com',
        'ec2.us-east-1.amazonaws.com'
      ],
      cloudfront: [
        'cloudfront.amazonaws.com',
        'd111111abcdef8.cloudfront.net' // Example distribution
      ],
      rds: [
        'rds.amazonaws.com',
        'rds.us-east-1.amazonaws.com'
      ],
      lambda: [
        'lambda.amazonaws.com',
        'lambda.us-east-1.amazonaws.com'
      ],
      dynamodb: [
        'dynamodb.amazonaws.com',
        'dynamodb.us-east-1.amazonaws.com',
        'dynamodb.dualstack.us-east-1.amazonaws.com'
      ]
    }
  },
  gcp: {
    api: [
      'cloud.google.com',
      'console.cloud.google.com',
      'googleapis.com'
    ],
    services: {
      compute: [
        'compute.googleapis.com',
        'www.googleapis.com'
      ],
      storage: [
        'storage.googleapis.com',
        'storage.cloud.google.com'
      ],
      'cloud-cdn': [
        'cdn.googleapis.com'
      ]
    }
  },
  azure: {
    api: [
      'azure.microsoft.com',
      'portal.azure.com',
      'management.azure.com'
    ],
    services: {
      compute: [
        'management.azure.com'
      ],
      storage: [
        'blob.core.windows.net',
        'file.core.windows.net',
        'queue.core.windows.net',
        'table.core.windows.net'
      ],
      cdn: [
        'azureedge.net'
      ]
    }
  },
  cloudflare: {
    api: [
      'cloudflare.com',
      'dash.cloudflare.com',
      'api.cloudflare.com'
    ],
    services: {
      cdn: [
        'cloudflare.com',
        'cloudflare-dns.com'
      ],
      workers: [
        'workers.dev',
        'workers.cloudflare.com'
      ],
      pages: [
        'pages.dev',
        'cloudflare.com'
      ],
      r2: [
        'r2.cloudflarestorage.com'
      ]
    }
  }
};

async function checkEndpointIPv6(endpoint) {
  try {
    const addresses = await dns.resolve6(endpoint);
    return {
      hasIPv6: addresses.length > 0,
      addresses: addresses.slice(0, 2), // Just first 2 for brevity
      error: null
    };
  } catch (error) {
    // Try to resolve IPv4 to see if endpoint exists
    try {
      await dns.resolve4(endpoint);
      return {
        hasIPv6: false,
        addresses: [],
        error: null
      };
    } catch {
      return {
        hasIPv6: false,
        addresses: [],
        error: 'NXDOMAIN'
      };
    }
  }
}

async function testCloudProvider(providerId) {
  const provider = CLOUD_ENDPOINTS[providerId];
  if (!provider) {
    console.log(`Unknown provider: ${providerId}`);
    return null;
  }

  console.log(`\n🌩️  Testing ${providerId.toUpperCase()} IPv6 Support\n${'='.repeat(50)}\n`);

  const results = {
    provider: providerId,
    api_endpoints: {},
    service_endpoints: {},
    summary: {
      total: 0,
      ipv6_enabled: 0,
      ipv6_percentage: 0
    }
  };

  // Test main API endpoints
  console.log('📍 API Endpoints:');
  for (const endpoint of provider.api) {
    process.stdout.write(`   ${endpoint.padEnd(40)}`);
    const result = await checkEndpointIPv6(endpoint);
    
    if (result.error === 'NXDOMAIN') {
      console.log('⚠️  Not found');
    } else if (result.hasIPv6) {
      console.log(`✅ IPv6 (${result.addresses[0]})`);
      results.summary.ipv6_enabled++;
    } else {
      console.log('❌ No IPv6');
    }
    
    results.api_endpoints[endpoint] = result;
    results.summary.total++;
  }

  // Test service-specific endpoints
  console.log('\n📍 Service Endpoints:');
  for (const [service, endpoints] of Object.entries(provider.services)) {
    console.log(`   ${service.toUpperCase()}:`);
    results.service_endpoints[service] = {};
    
    for (const endpoint of endpoints) {
      process.stdout.write(`     ${endpoint.padEnd(45)}`);
      const result = await checkEndpointIPv6(endpoint);
      
      if (result.error === 'NXDOMAIN') {
        console.log('⚠️  DNS not found');
      } else if (result.hasIPv6) {
        console.log('✅ IPv6');
        results.summary.ipv6_enabled++;
      } else {
        console.log('❌ No IPv6');
      }
      
      results.service_endpoints[service][endpoint] = result;
      results.summary.total++;
    }
  }

  // Calculate percentage
  results.summary.ipv6_percentage = Math.round(
    (results.summary.ipv6_enabled / results.summary.total) * 100
  );

  console.log(`\n📊 Summary:`);
  console.log(`   Total endpoints tested: ${results.summary.total}`);
  console.log(`   IPv6 enabled: ${results.summary.ipv6_enabled} (${results.summary.ipv6_percentage}%)`);

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node test-cloud-ipv6.js <provider>');
    console.log('Providers: aws, gcp, azure, cloudflare');
    console.log('\nExample: node test-cloud-ipv6.js aws');
    process.exit(1);
  }

  const provider = args[0].toLowerCase();
  const results = await testCloudProvider(provider);

  if (results && args.includes('--save')) {
    // Save results to file
    const filename = `data/cloud-tests/${provider}-ipv6-test.json`;
    await fs.mkdir('data/cloud-tests', { recursive: true });
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to ${filename}`);
  }
}

main().catch(console.error);