import { describe, expect, it } from 'vitest';
import { defaultState, normalizeState, ruleCount } from '../src/shared/storage';

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

  it('keeps only string entries in rule lists', () => {
    const state = normalizeState({
      rules: { videoIds: ['abc', 1, null, 'def'], titles: 'not-an-array' },
    });
    expect(state.rules.videoIds).toEqual(['abc', 'def']);
    expect(state.rules.titles).toEqual([]);
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
    expect(normalizeState({ settings: { blockMessage: 5 } }).settings.blockMessage).toBe(
      defaultState().settings.blockMessage,
    );
    expect(normalizeState({ settings: { blockMessage: '' } }).settings.blockMessage).toBe('');
  });
});

describe('ruleCount', () => {
  it('sums every rule list', () => {
    const state = defaultState();
    state.rules.videoIds = ['a', 'b'];
    state.rules.channelIds = ['UC1'];
    state.rules.titles = ['x'];
    expect(ruleCount(state)).toBe(4);
  });
});
