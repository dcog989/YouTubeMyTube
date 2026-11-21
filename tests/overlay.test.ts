import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockSurface } from '../src/content/evaluate';

describe('blockSurface', () => {
  it('blanks the player on every video page, whatever the reason', () => {
    for (const kind of ['video', 'shorts', 'live', 'embed'] as const) {
      expect(blockSurface(kind)).toBe('blank');
    }
  });

  it('keeps the full overlay for channel pages', () => {
    expect(blockSurface('channel')).toBe('channel');
    expect(blockSurface('handle')).toBe('channel');
  });
});

describe('player selectors', () => {
  const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

  it('keeps the cover list in sync with the CSS hide list', () => {
    const source = read('../src/content/overlay.ts');
    const css = read('../src/content/content.css');
    const array = /const PLAYER_BOX_SELECTORS = \[([\s\S]*?)\n\];/.exec(source)?.[1] ?? '';
    const inSource = new Set(array.match(/'[^']+'/g)?.map((value) => value.slice(1, -1)) ?? []);
    // `video` is the cover's last-resort element, not a container the CSS targets.
    inSource.delete('video');

    const block = /html\.ytb-blank-player\s*:is\(([\s\S]*?)\)\s*\{/.exec(css)?.[1] ?? '';
    const inCss = new Set(
      block
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );

    expect(inSource).toEqual(inCss);
  });
});
