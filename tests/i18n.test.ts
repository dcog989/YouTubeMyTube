import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = resolve(__dirname, '..', '_locales');
const SRC_DIR = resolve(__dirname, '..', 'src');

function readMessages(locale: string): Record<string, { message: string }> {
  return JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, 'messages.json'), 'utf8'));
}

function htmlFiles(dir = SRC_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function markupKeys(html: string): string[] {
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1] ?? '');
  for (const match of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of (match[1] ?? '').split(';')) keys.push(pair.split(':')[1] ?? '');
  }
  return keys;
}

describe('locale messages', () => {
  const locales = readdirSync(LOCALES_DIR);
  const reference = readMessages('en');
  const referenceKeys = Object.keys(reference).sort();

  it('ships English as the default locale', () => {
    expect(locales).toContain('en');
  });

  it('only uses keys that exist in English', () => {
    const missing: string[] = [];
    for (const file of htmlFiles()) {
      for (const key of markupKeys(readFileSync(file, 'utf8'))) {
        if (!reference[key]) missing.push(`${file} → ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s matches the English key set', (locale) => {
    const keys = Object.keys(readMessages(locale)).sort();
    expect(keys).toEqual(referenceKeys);
  });

  it.each(locales)('%s has no empty messages', (locale) => {
    for (const [key, entry] of Object.entries(readMessages(locale))) {
      expect(entry.message, `${locale}:${key}`).not.toBe('');
    }
  });

  it('keeps placeholders consistent per locale', () => {
    const placeholders = (message: string) =>
      [...message.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])).sort();
    for (const locale of locales) {
      const messages = readMessages(locale);
      for (const key of referenceKeys) {
        const referenceMessage = reference[key]?.message ?? '';
        const entry = messages[key];
        if (!entry) continue;
        expect(placeholders(entry.message), `${locale}:${key}`).toEqual(
          placeholders(referenceMessage),
        );
      }
    }
  });
});
