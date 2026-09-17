import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const SHARED_KEYS = [
  'manifest_version',
  'name',
  'version',
  'description',
  'permissions',
  'host_permissions',
  'icons',
  'action',
  'options_ui',
  'web_accessible_resources',
];

const CONTENT_SCRIPT_KEYS = ['matches', 'js', 'css', 'run_at', 'all_frames'];

function readManifest(root, browser) {
  return JSON.parse(readFileSync(resolve(root, 'manifests', `${browser}.json`), 'utf8'));
}

function mismatch(label, referenceName, reference, otherName, other) {
  const referenceValue = JSON.stringify(reference);
  const otherValue = JSON.stringify(other);
  return `${label}: ${referenceName}=${referenceValue} ${otherName}=${otherValue}`;
}

function compare(reference, referenceName, other, otherName) {
  const problems = [];
  for (const key of SHARED_KEYS) {
    if (!isDeepStrictEqual(reference[key], other[key])) {
      problems.push(mismatch(key, referenceName, reference[key], otherName, other[key]));
    }
  }

  const referenceScript = reference.content_scripts?.[0] ?? {};
  const otherScript = other.content_scripts?.[0] ?? {};
  for (const key of CONTENT_SCRIPT_KEYS) {
    if (!isDeepStrictEqual(referenceScript[key], otherScript[key])) {
      problems.push(
        mismatch(
          `content_scripts.${key}`,
          referenceName,
          referenceScript[key],
          otherName,
          otherScript[key],
        ),
      );
    }
  }
  return problems;
}

export function validateManifests(root, browsers) {
  const [referenceName, ...others] = browsers;
  if (!referenceName) return;
  const reference = readManifest(root, referenceName);
  const problems = others.flatMap((browser) =>
    compare(reference, referenceName, readManifest(root, browser), browser),
  );

  if (problems.length > 0) {
    const detail = problems.map((problem) => `  - ${problem}`).join('\n');
    throw new Error(`Manifest drift detected:\n${detail}`);
  }
}
