import { describe, expect, it, vi } from 'vitest';
import { MAX_DNR_REGEX_RULES, MAX_DNR_RULES } from '../src/shared/constants';
import { defaultState } from '../src/shared/defaults';
import {
  applyDnrRules,
  buildDnrRules,
  countDnrRules,
  type DnrRule,
  dnrOverflow,
  sameRules,
} from '../src/shared/dnr';
import type { ChannelEntry, VideoEntry } from '../src/shared/types';

const VIDEO_A = 'aaaaaaaaaaa';
const VIDEO_B = 'bbbbbbbbbbb';
const VIDEO_C = 'ccccccccccc';
const VIDEO_D = 'dQw4w9WgXcQ';
const VIDEO_BAD = 'badbadbadba';
const CHANNEL_A = `UC${'a'.repeat(20)}`;
const HANDLE_A = 'somechannel';

function videoIdAt(index: number): string {
  return String(index).padStart(11, '0');
}

function channelIdAt(index: number): string {
  return `UC${String(index).padStart(20, '0')}`;
}

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
    const { rules } = buildDnrRules(stateWith({ videos: [video(VIDEO_A)], enabled: false }));
    expect(rules).toHaveLength(0);
  });

  it('creates a redirect and a sub-frame block per video, and one rule per channel field', () => {
    const { rules } = buildDnrRules(
      stateWith({
        videos: [video(VIDEO_A)],
        channels: [channel(CHANNEL_A, HANDLE_A)],
      }),
    );
    expect(rules).toHaveLength(4);
    expect(rules.filter((rule) => rule.action.type === 'redirect')).toHaveLength(3);
    expect(rules.filter((rule) => rule.action.type === 'block')).toHaveLength(1);
  });

  it('redirects entity rules to the extension blocked page with a reason', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video(VIDEO_A)] }));
    expect(decodeURIComponent(rules[0]?.action.redirect?.extensionPath ?? '')).toBe(
      `/blocked.html?reason=video id ${VIDEO_A}`,
    );
  });

  it('uses a distinct reason per entity type', () => {
    const { rules } = buildDnrRules(
      stateWith({
        videos: [video(VIDEO_A)],
        channels: [channel(CHANNEL_A, HANDLE_A)],
      }),
    );
    const reasons = rules
      .filter((rule) => rule.action.type === 'redirect')
      .map((rule) => decodeURIComponent(rule.action.redirect?.extensionPath ?? ''));
    expect(reasons).toEqual([
      `/blocked.html?reason=video id ${VIDEO_A}`,
      `/blocked.html?reason=channel id ${CHANNEL_A}`,
      `/blocked.html?reason=channel handle @${HANDLE_A}`,
    ]);
  });

  it('blocks blocked videos embedded in another site as sub-frames', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video(VIDEO_A)] }));
    const embed = rules.find((rule) => rule.condition.resourceTypes?.includes('sub_frame'));
    expect(embed?.condition.urlFilter).toBe(`||youtube.com/embed/${VIDEO_A}^`);
    expect(embed?.condition.resourceTypes).toEqual(['sub_frame']);
    expect(embed?.condition.isUrlFilterCaseSensitive).toBe(true);
    expect(embed?.action).toEqual({ type: 'block' });
    expect(embed?.priority).toBe(2);
  });

  it('uses a domain-anchored urlFilter for channel ids', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel(CHANNEL_A)] }));
    const rule = rules[0];
    expect(rule?.condition.regexFilter).toBeUndefined();
    expect(rule?.condition.urlFilter).toBe(`||youtube.com/channel/${CHANNEL_A}^`);
    expect(rule?.condition.isUrlFilterCaseSensitive).toBe(true);
    expect(rule?.priority).toBe(2);
  });

  it('uses a domain-anchored urlFilter for handles', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', 'SomeChannel')] }));
    const rule = rules[0];
    expect(rule?.condition.regexFilter).toBeUndefined();
    expect(rule?.condition.urlFilter).toBe('||youtube.com/@SomeChannel^');
    expect(rule?.condition.isUrlFilterCaseSensitive).toBe(false);
    expect(rule?.priority).toBe(2);
  });

  it('skips handles that are not valid YouTube handles', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', 'カナル')] }));
    expect(rules).toHaveLength(0);
  });

  it('skips ids and handles containing urlFilter syntax characters', () => {
    const { rules } = buildDnrRules(
      stateWith({ channels: [channel(`UC${'a'.repeat(19)}*`, 'some*channel')] }),
    );
    expect(rules).toHaveLength(0);
  });

  it('skips channels without an id or handle', () => {
    const { rules } = buildDnrRules(stateWith({ channels: [channel('', '')] }));
    expect(rules).toHaveLength(0);
  });

  it('redirects area rules to the YouTube home page', () => {
    const { rules } = buildDnrRules(stateWith({ trendingPage: true }));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.action.redirect?.url).toBe('https://www.youtube.com/');
    expect(rules[0]?.priority).toBe(1);
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

  it('leaves watch, live and Shorts pages to the in-page player cover', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video(VIDEO_D)] }));
    const filter = rules[0]?.condition.regexFilter ?? '';
    expect(filter).not.toContain('watch');
    expect(filter).not.toContain('live');
    expect(filter).not.toContain('shorts');
    expect(filter).toContain('embed');
    expect(filter).toContain(VIDEO_D);
  });

  it('covers YouTube Music in the video pattern', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video(VIDEO_A)] }));
    expect(rules[0]?.condition.regexFilter).toContain('music');
  });

  it('assigns unique positive rule ids', () => {
    const { rules } = buildDnrRules(
      stateWith({
        videos: [video(VIDEO_A), video(VIDEO_B), video(VIDEO_C)],
        channels: [channel(CHANNEL_A)],
      }),
    );
    const ids = rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id > 0)).toBe(true);
  });

  it('skips blank entries', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video(''), video('  ')] }));
    expect(rules).toHaveLength(0);
  });

  it('skips ids that would produce an invalid DNR rule', () => {
    const { rules } = buildDnrRules(stateWith({ videos: [video('abc'), video('a'.repeat(3000))] }));
    expect(rules).toHaveLength(0);
  });

  it('caps regex rules at the browser limit and reports the overflow', () => {
    const videos = Array.from({ length: MAX_DNR_REGEX_RULES + 1 }, (_, index) =>
      video(videoIdAt(index)),
    );
    const { rules, dropped } = buildDnrRules(stateWith({ videos }));
    expect(rules.filter((rule) => rule.condition.regexFilter !== undefined)).toHaveLength(
      MAX_DNR_REGEX_RULES,
    );
    expect(dropped).toBe(1);
  });

  it('does not count urlFilter channel/handle rules against the regex cap', () => {
    const videos = Array.from({ length: MAX_DNR_REGEX_RULES }, (_, index) =>
      video(videoIdAt(index)),
    );
    const channels = Array.from({ length: 5 }, (_, index) =>
      channel(channelIdAt(index), `handle${index}`),
    );
    const { rules, dropped } = buildDnrRules(stateWith({ videos, channels }));
    expect(dropped).toBe(0);
    expect(rules).toHaveLength(MAX_DNR_REGEX_RULES * 2 + 10);
    expect(rules.filter((rule) => rule.condition.regexFilter !== undefined)).toHaveLength(
      MAX_DNR_REGEX_RULES,
    );
    expect(rules.filter((rule) => rule.condition.urlFilter !== undefined)).toHaveLength(
      MAX_DNR_REGEX_RULES + 10,
    );
  });

  it('caps the total rule count and reports the overflow', () => {
    const channels = Array.from({ length: MAX_DNR_RULES + 5 }, (_, index) =>
      channel(channelIdAt(index)),
    );
    const { rules, dropped } = buildDnrRules(stateWith({ channels }));
    expect(rules).toHaveLength(MAX_DNR_RULES);
    expect(dropped).toBe(5);
  });
});

describe('applyDnrRules', () => {
  it('applies the batch in one atomic update', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('browser', { declarativeNetRequest: { updateDynamicRules: update } });
    const { rules } = buildDnrRules(stateWith({ videos: [video(VIDEO_A), video(VIDEO_B)] }));
    const failed = await applyDnrRules([9], rules);
    expect(failed).toEqual([]);
    expect(update).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('retries rule-by-rule and reports only the rejected rule', async () => {
    const { rules } = buildDnrRules(
      stateWith({ videos: [video(VIDEO_A), video(VIDEO_BAD), video(VIDEO_B)] }),
    );
    const badId = rules[2]?.id;
    const applied: number[] = [];
    const update = vi.fn(async (options: { addRules?: Array<{ id: number }> }) => {
      if (options.addRules?.some((rule) => rule.id === badId)) throw new Error('rejected');
      for (const rule of options.addRules ?? []) applied.push(rule.id);
    });
    vi.stubGlobal('browser', { declarativeNetRequest: { updateDynamicRules: update } });
    const failed = await applyDnrRules([9], rules);
    expect(failed).toEqual([badId]);
    expect(applied).toEqual(rules.map((rule) => rule.id).filter((id) => id !== badId));
    vi.unstubAllGlobals();
  });
});

describe('countDnrRules', () => {
  it('counts nothing when disabled', () => {
    expect(countDnrRules(stateWith({ videos: [video(VIDEO_A)], enabled: false }))).toEqual({
      total: 0,
      regex: 0,
    });
  });

  it('counts videos, redirect areas and both channel fields', () => {
    const state = stateWith({
      videos: [video(VIDEO_A), video('abc')],
      channels: [channel(CHANNEL_A, HANDLE_A)],
      trendingPage: true,
    });
    expect(countDnrRules(state)).toEqual({ total: 5, regex: 2 });
  });

  it('ignores malformed entries', () => {
    const state = stateWith({
      videos: [video('abc'), video('a'.repeat(3000))],
      channels: [channel('UCshort', 'bad handle')],
    });
    expect(countDnrRules(state)).toEqual({ total: 0, regex: 0 });
  });
});

describe('dnrOverflow', () => {
  it('is null when both limits fit', () => {
    expect(dnrOverflow(stateWith({ videos: [video(VIDEO_A)] }))).toBeNull();
  });

  it('reports regex overflow', () => {
    const videos = Array.from({ length: MAX_DNR_REGEX_RULES + 1 }, (_, index) =>
      video(videoIdAt(index)),
    );
    expect(dnrOverflow(stateWith({ videos }))).toEqual({
      dropped: 1,
      limit: MAX_DNR_REGEX_RULES,
    });
  });

  it('reports total overflow from urlFilter rules', () => {
    const channels = Array.from({ length: MAX_DNR_RULES + 1 }, (_, index) =>
      channel(channelIdAt(index)),
    );
    expect(dnrOverflow(stateWith({ channels }))).toEqual({
      dropped: 1,
      limit: MAX_DNR_RULES,
    });
  });

  it('reports the regex limit when regex rules alone account for every drop', () => {
    const state = stateWith({
      videos: Array.from({ length: MAX_DNR_REGEX_RULES * 2 }, (_, index) =>
        video(videoIdAt(index)),
      ),
    });
    expect(dnrOverflow(state)).toEqual({
      dropped: MAX_DNR_REGEX_RULES,
      limit: MAX_DNR_REGEX_RULES,
    });
  });

  it('matches the rules buildDnrRules drops', () => {
    const state = stateWith({
      videos: Array.from({ length: MAX_DNR_REGEX_RULES + 5 }, (_, index) =>
        video(videoIdAt(index)),
      ),
      channels: Array.from({ length: 4500 }, (_, index) => channel(channelIdAt(index))),
    });
    const { dropped } = buildDnrRules(state);
    expect(dnrOverflow(state)?.dropped).toBe(dropped);
  });
});

describe('sameRules', () => {
  function rule(overrides: Partial<DnrRule> = {}): DnrRule {
    return {
      id: 1,
      priority: 1,
      action: { type: 'redirect', redirect: { url: 'https://www.youtube.com/' } },
      condition: {
        regexFilter: '^https://example\\.com/',
        isUrlFilterCaseSensitive: true,
        resourceTypes: ['main_frame'],
      },
      ...overrides,
    };
  }

  it('ignores object key order', () => {
    const reordered: DnrRule = {
      condition: {
        resourceTypes: ['main_frame'],
        isUrlFilterCaseSensitive: true,
        regexFilter: '^https://example\\.com/',
      },
      action: { redirect: { url: 'https://www.youtube.com/' }, type: 'redirect' },
      priority: 1,
      id: 1,
    };
    expect(sameRules([rule()], [reordered])).toBe(true);
  });

  it('detects a changed field', () => {
    expect(sameRules([rule()], [rule({ priority: 2 })])).toBe(false);
  });

  it('detects a different rule count', () => {
    expect(sameRules([rule()], [])).toBe(false);
  });
});
