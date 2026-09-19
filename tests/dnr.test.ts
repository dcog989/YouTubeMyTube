import { describe, expect, it } from 'vitest';
import { MAX_DNR_REGEX_RULES } from '../src/shared/constants';
import { buildDnrRules } from '../src/shared/dnr';
import { defaultState } from '../src/shared/storage';
import type { ChannelEntry, VideoEntry } from '../src/shared/types';

function stateWith(overrides: {
  videos?: VideoEntry[];
  channels?: ChannelEntry[];
  trendingPage?: boolean;
  enabled?: boolean;
}) {
  const state = defaultState();
  state.rules.videos = overrides.videos ?? [];
  state.rules.channels = overrides.channels ?? [];
  if (overrides.trendingPage) state.areas.trendingPage = true;
  if (overrides.enabled === false) state.settings.enabled = false;
  return state;
}

function channel(id: string, handle = ''): ChannelEntry {
  return { id, name: '', handle };
}

function video(id: string): VideoEntry {
  return { id, title: '' };
}

describe('buildDnrRules', () => {
  it('returns no rules when disabled', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video('abc')], enabled: false }));
    expect(rules).toHaveLength(0);
  });

  it('creates one redirect rule per video id and channel field', () => {
    const { rules } = buildDnrRules(
      stateWith({
        videos: [video('abc')],
        channels: [channel('UC123', 'somechannel')],
      }),
    );
    expect(rules).toHaveLength(3);
    expect(rules.every((rule) => rule.action.type === 'redirect')).toBe(true);
  });

  it('redirects entity rules to the extension blocked page with a reason', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video('abc')] }));
    expect(decodeURIComponent(rules[0]?.action.redirect?.extensionPath ?? '')).toBe(
      '/blocked.html?reason=video id abc',
    );
  });

  it('uses a distinct reason per entity type', () => {
    const { rules } = buildDnrRules(
      stateWith({
        videos: [video('abc')],
        channels: [channel('UC123', 'somechannel')],
      }),
    );
    const reasons = rules.map((rule) =>
      decodeURIComponent(rule.action.redirect?.extensionPath ?? ''),
    );
    expect(reasons).toEqual([
      '/blocked.html?reason=video id abc',
      '/blocked.html?reason=channel id UC123',
      '/blocked.html?reason=channel handle @somechannel',
    ]);
  });

  it('matches handles case-insensitively', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', 'SomeChannel')] }));
    const filter = rules[0]?.condition.regexFilter ?? '';
    expect(new RegExp(filter).test('https://www.youtube.com/@somechannel')).toBe(true);
    expect(new RegExp(filter).test('https://www.youtube.com/@SOMECHANNEL')).toBe(true);
    expect(new RegExp(filter).test('https://www.youtube.com/@another')).toBe(false);
  });

  it('skips channels without an id or handle', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', '')] }));
    expect(rules).toHaveLength(0);
  });

  it('redirects area rules to the YouTube home page', () => {
    const { rules } = buildDnrRules(stateWith({ trendingPage: true }));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.action.redirect?.url).toBe('https://www.youtube.com/');
  });

  it('never emits a home-page redirect rule (would loop)', () => {
    const state = defaultState();
    state.areas.homePage = true;
    expect(
      buildDnrRules(state).rules.some(
        (rule) => rule.action.redirect?.url === 'https://www.youtube.com/',
      ),
    ).toBe(false);
  });

  it('builds a combined video regex including shorts and watch paths', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video('dQw4w9WgXcQ')] }));
    const filter = rules[0]?.condition.regexFilter ?? '';
    expect(filter).toContain('watch');
    expect(filter).toContain('shorts');
    expect(filter).toContain('dQw4w9WgXcQ');
  });

  it('assigns unique positive rule ids', () => {
    const { rules } = buildDnrRules(
      stateWith({ videos: [video('a'), video('b'), video('c')], channels: [channel('UC1')] }),
    );
    const ids = rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id > 0)).toBe(true);
  });

  it('skips blank entries', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video(''), video('  ')] }));
    expect(rules).toHaveLength(0);
  });

  it('caps regex rules at the browser limit and reports the overflow', () => {
    const videos = Array.from({ length: MAX_DNR_REGEX_RULES + 1 }, (_, index) =>
      video(`v${index}`),
    );
    const { rules, dropped } = buildDnrRules(stateWith({ videos }));
    expect(rules).toHaveLength(MAX_DNR_REGEX_RULES);
    expect(dropped).toBe(1);
  });
});
