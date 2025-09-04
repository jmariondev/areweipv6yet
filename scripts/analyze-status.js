/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as fs } from 'fs';
import yaml from 'js-yaml';

async function main() {
  // Read the YAML file
  const data = yaml.load(await fs.readFile('data/services.yaml', 'utf8'));
  
  console.log('Status Analysis - Current vs Test Results\n');
  console.log('Service'.padEnd(25) + 'Current'.padEnd(10) + 'Main'.padEnd(6) + 'WWW'.padEnd(6) + 'Suggested'.padEnd(12) + 'Notes');
  console.log('-'.repeat(80));
  
  data.services.forEach(service => {
    if (!service.ipv6 || !service.ipv6.tests) return;
    
    const mainTest = service.ipv6.tests.find(t => t.id === 'aaaa_record');
    const wwwTest = service.ipv6.tests.find(t => t.id === 'www_variant');
    
    const mainWorks = mainTest && mainTest.result === true;
    const wwwWorks = wwwTest && wwwTest.result === true;
    
    // Suggest status based on test results
    let suggested;
    if (mainWorks && wwwWorks) {
      suggested = 'full';
    } else if (mainWorks || wwwWorks) {
      suggested = 'partial';
    } else {
      suggested = 'none';
    }
    
    const mainSymbol = mainWorks ? '✓' : '✗';
    const wwwSymbol = wwwWorks ? '✓' : '✗';
    const mismatch = service.ipv6.status !== suggested ? '⚠️' : '';
    
    console.log(
      service.name.padEnd(25) + 
      service.ipv6.status.padEnd(10) + 
      mainSymbol.padEnd(6) + 
      wwwSymbol.padEnd(6) + 
      suggested.padEnd(12) + 
      mismatch
    );
  });
  
  console.log('\n⚠️ = Status mismatch between current and test results');
}

main().catch(console.error);