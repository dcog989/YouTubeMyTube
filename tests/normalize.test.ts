import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/shared/defaults';
import { normalizeState, ruleCount } from '../src/shared/normalize';

describe('defaultState', () => {
  it('starts empty, disabled areas and enabled blocking', () => {
    const state = defaultState();
    expect(ruleCount(state)).toBe(0);
    expect(Object.values(state.areas).every((value) => value === false)).toBe(true);
    expect(state.settings.enabled).toBe(true);
    expect(state.settings.theme).toBe('system');
  });
});

describe('normalizeState', () => {
  it('falls back to defaults for non-objects', () => {
    expect(normalizeState(null)).toEqual(defaultState());
    expect(normalizeState('nope')).toEqual(defaultState());
    expect(normalizeState(42)).toEqual(defaultState());
  });

  it('keeps only well-formed channel and video entries', () => {
    const state = normalizeState({
      rules: {
        channels: [
          { id: 'UC1', name: 'One', handle: 'one' },
          { id: '', handle: 'two' },
          { id: '', name: '', handle: '' },
          { id: 'UC1', name: 'dupe', handle: '' },
          { id: 5 },
        ],
        videos: [
          { id: 'abc', title: 'A' },
          { id: 'abc', title: 'dupe' },
          { id: '' },
          { title: 'no id' },
        ],
      },
    });
    expect(state.rules.channels).toEqual([
      { id: 'UC1', name: 'One', handle: 'one' },
      { id: '', name: '', handle: 'two' },
    ]);
    expect(state.rules.videos).toEqual([{ id: 'abc', title: 'A' }]);
  });

  it('normalizes channel handles so they are not double-prefixed', () => {
    const state = normalizeState({ rules: { channels: [{ id: '', handle: '@Foo' }] } });
    expect(state.rules.channels[0]).toEqual({ id: '', name: '', handle: 'foo' });
  });

  it('keeps name-only channel entries and dedupes them by name', () => {
    const state = normalizeState({
      rules: {
        channels: [
          { id: '', name: 'Rick Astley', handle: '' },
          { id: '', name: 'rick astley', handle: '' },
          { id: '', name: '', handle: '' },
        ],
      },
    });
    expect(state.rules.channels).toEqual([{ id: '', name: 'Rick Astley', handle: '' }]);
  });

  it('preserves the lookupFailed marker on entities', () => {
    const state = normalizeState({
      rules: {
        channels: [{ id: 'UC1', name: '', handle: '', lookupFailed: true }],
        videos: [{ id: 'abc', title: '', lookupFailed: true }],
      },
    });
    expect(state.rules.channels[0]?.lookupFailed).toBe(true);
    expect(state.rules.videos[0]?.lookupFailed).toBe(true);
    expect(
      normalizeState({ rules: { videos: [{ id: 'x', title: '' }] } }).rules.videos[0],
    ).not.toHaveProperty('lookupFailed');
  });

  it('keeps only string entries in pattern lists', () => {
    const state = normalizeState({
      rules: { titleFilters: ['a', 1, null, 'b'], commentFilters: 'not-an-array' },
    });
    expect(state.rules.titleFilters).toEqual(['a', 'b']);
    expect(state.rules.commentFilters).toEqual([]);
  });

  it('ignores non-boolean area flags and keeps valid ones', () => {
    const state = normalizeState({
      areas: { trendingPage: true, shortsPage: 'yes', homePage: false },
    });
    expect(state.areas.trendingPage).toBe(true);
    expect(state.areas.shortsPage).toBe(false);
    expect(state.areas.homePage).toBe(false);
  });

  it('validates settings and falls back on bad values', () => {
    expect(normalizeState({ settings: { theme: 'neon' } }).settings.theme).toBe('system');
    expect(normalizeState({ settings: { theme: 'dark' } }).settings.theme).toBe('dark');
    expect(normalizeState({ settings: { enabled: 'yes' } }).settings.enabled).toBe(true);
  });
});

describe('ruleCount', () => {
  it('sums entities and active pattern entries', () => {
    const state = defaultState();
    state.rules.videos = [{ id: 'a', title: '' }];
    state.rules.channels = [{ id: 'UC1', name: '', handle: '' }];
    state.rules.titleFilters = ['x', '// comment', '  // indented comment', '   ', ''];
    state.rules.commentFilters = ['y'];
    expect(ruleCount(state)).toBe(4);
  });
});
