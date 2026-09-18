import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} root
 * @returns {{ path: string, name: string }[]}
 */
function trackedFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  return output
    .split('\0')
    .filter(Boolean)
    .map((name) => ({ path: resolve(root, name), name }));
}

/**
 * @param {string} outFile
 * @returns {{ entries: number, bytes: number }}
 */
export function createSourceZip(outFile) {
  return writeZip(trackedFiles(ROOT), outFile);
}
