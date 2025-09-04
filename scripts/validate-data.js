/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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