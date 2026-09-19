import { cpSync, watch as fsWatch, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';
import { generateIcons } from './scripts/gen-icons.mjs';
import { validateManifests } from './scripts/manifest-check.mjs';
import { createSourceZip } from './scripts/source-zip.mjs';
import { createZip } from './scripts/zip.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
/** @type {{ name: string, version: string }} */
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const WATCH_DEBOUNCE_MS = 50;

/** @type {Record<string, string>} */
const ENTRIES = {
  background: 'src/background/service-worker.ts',
  content: 'src/content/content.ts',
  popup: 'src/popup/popup.ts',
  options: 'src/options/options.ts',
  blocked: 'src/blocked/blocked.ts',
};

/** @type {Array<[string, string]>} */
const STATIC_ASSETS = [
  ['src/content/content.css', 'content.css'],
  ['src/popup/popup.html', 'popup.html'],
  ['src/popup/popup.css', 'popup.css'],
  ['src/options/options.html', 'options.html'],
  ['src/options/options.css', 'options.css'],
  ['src/blocked/blocked.html', 'blocked.html'],
  ['src/blocked/blocked.css', 'blocked.css'],
];

const SUPPORTED = ['chrome', 'firefox'];
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const requested = args.find((arg) => !arg.startsWith('--')) ?? 'all';
const browsers = requested === 'all' ? SUPPORTED : SUPPORTED.filter((name) => name === requested);

if (browsers.length === 0) {
  console.error(`Unknown target "${requested}". Use one of: all, ${SUPPORTED.join(', ')}`);
  process.exit(1);
}

/**
 * @param {string} browser
 * @returns {string}
 */
function distDir(browser) {
  return resolve(ROOT, 'dist', browser);
}

/**
 * @param {string} browser
 * @returns {string}
 */
function resolveManifest(browser) {
  return readFileSync(resolve(ROOT, 'manifests', `${browser}.json`), 'utf8').replaceAll(
    '__VERSION__',
    VERSION,
  );
}

/**
 * @param {string} browser
 */
function copyStaticAssets(browser) {
  const outDir = distDir(browser);
  for (const [source, target] of STATIC_ASSETS) {
    cpSync(resolve(ROOT, source), resolve(outDir, target));
  }

  cpSync(resolve(ROOT, 'assets/icons'), resolve(outDir, 'assets/icons'), { recursive: true });
  writeFileSync(resolve(outDir, 'manifest.json'), resolveManifest(browser));
}

/**
 * @param {string} browser
 */
function prepareAssets(browser) {
  const outDir = distDir(browser);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyStaticAssets(browser);
}

/**
 * @param {string[]} targets
 */
function watchStaticAssets(targets) {
  const sources = [
    ...STATIC_ASSETS.map(([source]) => resolve(ROOT, source)),
    ...targets.map((browser) => resolve(ROOT, 'manifests', `${browser}.json`)),
  ];
  const directories = new Set(sources.map((source) => dirname(source)));
  directories.add(resolve(ROOT, 'assets/icons'));

  /** @type {ReturnType<typeof setTimeout> | null} */
  let pending = null;
  /**
   * @param {string} directory
   */
  const resync = (directory) => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      for (const browser of targets) {
        copyStaticAssets(browser);
      }
      console.log(`Copied static assets after change in ${relative(ROOT, directory)}`);
    }, WATCH_DEBOUNCE_MS);
  };

  for (const directory of directories) {
    fsWatch(directory, () => resync(directory));
  }
}

/**
 * @param {string} browser
 * @param {string} name
 * @returns {import('esbuild').BuildOptions}
 */
function esbuildOptions(browser, name) {
  const entry = ENTRIES[name];
  if (!entry) throw new Error(`Unknown entry "${name}"`);
  return {
    entryPoints: [resolve(ROOT, entry)],
    outfile: resolve(distDir(browser), `${name}.js`),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome140', 'firefox140'],
    sourcemap: watch ? 'inline' : false,
    minify: !watch,
    logLevel: 'info',
  };
}

async function main() {
  validateManifests(ROOT, SUPPORTED);

  generateIcons();

  for (const browser of browsers) {
    prepareAssets(browser);
  }

  const names = Object.keys(ENTRIES);

  if (watch) {
    const contexts = await Promise.all(
      browsers.flatMap((browser) => names.map((name) => context(esbuildOptions(browser, name)))),
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    watchStaticAssets(browsers);
    for (const browser of browsers) {
      console.log(`Watching ${browser} → ${distDir(browser)}`);
    }
  } else {
    for (const browser of browsers) {
      await Promise.all(names.map((name) => build(esbuildOptions(browser, name))));
      const archive = resolve(ROOT, 'dist', `${pkg.name}-${browser}.zip`);
      const { entries } = createZip(distDir(browser), archive);
      console.log(`Built ${browser} v${VERSION} → ${distDir(browser)}`);
      console.log(`Packaged ${entries} files → ${archive}`);
    }

    const sourceArchive = resolve(ROOT, 'dist', `${pkg.name}-source.zip`);
    const { entries: sourceEntries } = createSourceZip(sourceArchive);
    console.log(`Packaged ${sourceEntries} source files → ${sourceArchive}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
