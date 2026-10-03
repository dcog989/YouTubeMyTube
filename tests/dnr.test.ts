import { describe, expect, it, vi } from 'vitest';
import { MAX_DNR_REGEX_RULES } from '../src/shared/constants';
import { defaultState } from '../src/shared/defaults';
import { applyDnrRules, buildDnrRules, countDnrRules, countRegexDnrRules } from '../src/shared/dnr';
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

  it('uses a domain-anchored urlFilter for channel ids', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('UC123')] }));
    const rule = rules[0];
    expect(rule?.condition.regexFilter).toBeUndefined();
    expect(rule?.condition.urlFilter).toBe('||youtube.com/channel/UC123^');
    expect(rule?.condition.isUrlFilterCaseSensitive).toBe(true);
  });

  it('uses a domain-anchored urlFilter for handles', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', 'SomeChannel')] }));
    const rule = rules[0];
    expect(rule?.condition.regexFilter).toBeUndefined();
    expect(rule?.condition.urlFilter).toBe('||youtube.com/@SomeChannel^');
    expect(rule?.condition.isUrlFilterCaseSensitive).toBe(false);
  });

  it('percent-encodes non-ASCII handles to match the URL path', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', 'カナル')] }));
    const filter = rules[0]?.condition.urlFilter ?? '';
    expect(filter).toBe(`||youtube.com/@${encodeURIComponent('カナル')}^`);
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

  it('does not count urlFilter channel/handle rules against the regex cap', () => {
    const videos = Array.from({ length: MAX_DNR_REGEX_RULES }, (_, index) => video(`v${index}`));
    const channels = Array.from({ length: 5 }, (_, index) =>
      channel(`UC${index}`, `handle${index}`),
    );
    const { rules, dropped } = buildDnrRules(stateWith({ videos, channels }));
    expect(dropped).toBe(0);
    expect(rules).toHaveLength(MAX_DNR_REGEX_RULES + 10);
    expect(rules.filter((rule) => rule.condition.regexFilter !== undefined)).toHaveLength(
      MAX_DNR_REGEX_RULES,
    );
    expect(rules.filter((rule) => rule.condition.urlFilter !== undefined)).toHaveLength(10);
  });
});

describe('applyDnrRules', () => {
  it('applies the batch in one atomic update', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('browser', { declarativeNetRequest: { updateDynamicRules: update } });
    const { rules } = buildDnrRules(stateWith({ videos: [video('a'), video('b')] }));
    const failed = await applyDnrRules([9], rules);
    expect(failed).toEqual([]);
    expect(update).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('retries rule-by-rule and reports only the rejected rule', async () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video('a'), video('bad'), video('b')] }));
    const badId = rules[1]?.id;
    const applied: number[] = [];
    const update = vi.fn(async (options: { addRules?: Array<{ id: number }> }) => {
      if (options.addRules?.some((rule) => rule.id === badId)) throw new Error('rejected');
      for (const rule of options.addRules ?? []) applied.push(rule.id);
    });
    vi.stubGlobal('browser', { declarativeNetRequest: { updateDynamicRules: update } });
    const failed = await applyDnrRules([9], rules);
    expect(failed).toEqual([badId]);
    expect(applied).toEqual([rules[0]?.id, rules[2]?.id]);
    vi.unstubAllGlobals();
  });
});

describe('countDnrRules', () => {
  it('matches the generated rule and overflow counts', () => {
    const state = stateWith({
      videos: [video('abc'), video('')],
      channels: [channel('UC1', 'somechannel'), channel('', '')],
      trendingPage: true,
    });
    const { rules, dropped } = buildDnrRules(state);
    expect(countDnrRules(state)).toBe(rules.length + dropped);
  });

  it('reports the total past the regex cap', () => {
    const videos = Array.from({ length: MAX_DNR_REGEX_RULES + 5 }, (_, index) =>
      video(`v${index}`),
    );
    expect(countDnrRules(stateWith({ videos }))).toBe(MAX_DNR_REGEX_RULES + 5);
  });

  it('counts nothing when disabled', () => {
    expect(countDnrRules(stateWith({ videos: [video('abc')], enabled: false }))).toBe(0);
  });

  it('counts only regex rules for the cap', () => {
    const state = stateWith({
      videos: [video('abc')],
      channels: [channel('UC1', 'somechannel')],
      trendingPage: true,
    });
    // video regex + trending area regex are the only regex rules
    expect(countRegexDnrRules(state)).toBe(2);
    expect(countDnrRules(state)).toBe(4);
  });
});
