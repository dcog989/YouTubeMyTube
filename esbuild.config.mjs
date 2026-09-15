import { build, context } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateIcons } from './scripts/gen-icons.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const ENTRIES = {
  background: 'src/background/service-worker.ts',
  content: 'src/content/content.ts',
  popup: 'src/popup/popup.ts',
  options: 'src/options/options.ts',
  blocked: 'src/blocked/blocked.ts',
};

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

function distDir(browser) {
  return resolve(ROOT, 'dist', browser);
}

function prepareAssets(browser) {
  const outDir = distDir(browser);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const [source, target] of STATIC_ASSETS) {
    cpSync(resolve(ROOT, source), resolve(outDir, target));
  }

  cpSync(resolve(ROOT, 'assets/icons'), resolve(outDir, 'assets/icons'), { recursive: true });

  const manifest = readFileSync(resolve(ROOT, 'manifests', `${browser}.json`), 'utf8').replaceAll(
    '__VERSION__',
    VERSION,
  );
  writeFileSync(resolve(outDir, 'manifest.json'), manifest);
}

function esbuildOptions(browser, name) {
  return {
    entryPoints: [resolve(ROOT, ENTRIES[name])],
    outfile: resolve(distDir(browser), `${name}.js`),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110', 'firefox115'],
    sourcemap: watch ? 'inline' : false,
    minify: !watch,
    logLevel: 'info',
  };
}

async function main() {
  if (!existsSync(resolve(ROOT, 'assets/icons/128.png'))) {
    generateIcons();
  }

  for (const browser of browsers) {
    prepareAssets(browser);
    const names = Object.keys(ENTRIES);

    if (watch) {
      const contexts = await Promise.all(
        names.map((name) => context(esbuildOptions(browser, name))),
      );
      await Promise.all(contexts.map((ctx) => ctx.watch()));
      console.log(`Watching ${browser} → ${distDir(browser)}`);
    } else {
      await Promise.all(names.map((name) => build(esbuildOptions(browser, name))));
      console.log(`Built ${browser} v${VERSION} → ${distDir(browser)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
