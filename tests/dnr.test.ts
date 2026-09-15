import { describe, expect, it } from 'vitest';
import { buildDnrRules } from '../src/shared/dnr';
import { defaultState } from '../src/shared/storage';

function stateWith(overrides: {
  videoIds?: string[];
  channelIds?: string[];
  handles?: string[];
  trendingPage?: boolean;
  enabled?: boolean;
}) {
  const state = defaultState();
  state.rules.videoIds = overrides.videoIds ?? [];
  state.rules.channelIds = overrides.channelIds ?? [];
  state.rules.handles = overrides.handles ?? [];
  if (overrides.trendingPage) state.areas.trendingPage = true;
  if (overrides.enabled === false) state.settings.enabled = false;
  return state;
}

describe('buildDnrRules', () => {
  it('returns no rules when disabled', () => {
    const rules = buildDnrRules(stateWith({ videoIds: ['abc'], enabled: false }));
    expect(rules).toHaveLength(0);
  });

  it('creates one redirect rule per entity', () => {
    const rules = buildDnrRules(
      stateWith({ videoIds: ['abc'], channelIds: ['UC123'], handles: ['SomeChannel'] }),
    );
    expect(rules).toHaveLength(3);
    expect(rules.every((rule) => rule.action.type === 'redirect')).toBe(true);
  });

  it('redirects entity rules to the extension blocked page', () => {
    const rules = buildDnrRules(stateWith({ videoIds: ['abc'] }));
    expect(rules[0]?.action.redirect?.extensionPath).toBe('/blocked.html');
  });

  it('redirects area rules to the YouTube home page', () => {
    const rules = buildDnrRules(stateWith({ trendingPage: true }));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.action.redirect?.url).toBe('https://www.youtube.com/');
  });

  it('never emits a home-page redirect rule (would loop)', () => {
    const state = defaultState();
    state.areas.homePage = true;
    expect(
      buildDnrRules(state).some((rule) => rule.action.redirect?.url === 'https://www.youtube.com/'),
    ).toBe(false);
  });

  it('builds a combined video regex including shorts and watch paths', () => {
    const rules = buildDnrRules(stateWith({ videoIds: ['dQw4w9WgXcQ'] }));
    const filter = rules[0]?.condition.regexFilter ?? '';
    expect(filter).toContain('watch');
    expect(filter).toContain('shorts');
    expect(filter).toContain('dQw4w9WgXcQ');
  });

  it('assigns unique positive rule ids', () => {
    const rules = buildDnrRules(stateWith({ videoIds: ['a', 'b', 'c'], channelIds: ['UC1'] }));
    const ids = rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id > 0)).toBe(true);
  });

  it('skips blank and comment entries', () => {
    const rules = buildDnrRules(stateWith({ videoIds: ['', '  ', '// comment'] }));
    expect(rules).toHaveLength(0);
  });
});
