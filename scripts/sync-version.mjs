import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const version = process.argv[2];
if (!version || !VERSION_PATTERN.test(version)) {
  console.error('usage: node scripts/sync-version.mjs <version>');
  console.error(`received: ${JSON.stringify(version)}`);
  process.exit(1);
}

const path = resolve(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(path, 'utf8'));
const previous = pkg.version;
pkg.version = version;
writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Synced package.json version: ${previous} → ${version}`);
