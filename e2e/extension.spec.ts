import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const EXTENSION_PATH = resolve(process.cwd(), 'dist', 'chrome');

test('loads the background service worker from the built extension', async () => {
  const userDataDir = mkdtempSync(resolve(tmpdir(), 'ytb-e2e-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    expect(new URL(worker.url()).pathname.endsWith('background.js')).toBe(true);
  } finally {
    await context.close();
  }
});
