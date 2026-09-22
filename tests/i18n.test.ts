import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = resolve(__dirname, '..', '_locales');

function readMessages(locale: string): Record<string, { message: string }> {
  return JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, 'messages.json'), 'utf8'));
}

describe('locale messages', () => {
  const locales = readdirSync(LOCALES_DIR);
  const reference = readMessages('en');
  const referenceKeys = Object.keys(reference).sort();

  it('ships English as the default locale', () => {
    expect(locales).toContain('en');
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
