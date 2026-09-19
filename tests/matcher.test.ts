import { describe, expect, it } from 'vitest';
import {
  areaForPath,
  compileRules,
  countActiveEntries,
  isActiveEntry,
  matchDirectNavigation,
  matchEntity,
  parseYouTubeUrl,
} from '../src/shared/matcher';
import { defaultAreas, defaultRules } from '../src/shared/storage';
import type { FilterRules } from '../src/shared/types';

function rulesWith(overrides: Partial<FilterRules> = {}) {
  return compileRules({ ...defaultRules(), ...overrides });
}

describe('parseYouTubeUrl', () => {
  it('parses watch URLs', () => {
    const parsed = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s');
    expect(parsed.kind).toBe('video');
    expect(parsed.videoId).toBe('dQw4w9WgXcQ');
  });

  it('parses relative watch URLs', () => {
    expect(parseYouTubeUrl('/watch?v=abcdefghijk').videoId).toBe('abcdefghijk');
  });

  it('parses shorts, live and embed URLs', () => {
    expect(parseYouTubeUrl('https://m.youtube.com/shorts/abc')).toMatchObject({
      kind: 'shorts',
      videoId: 'abc',
    });
    expect(parseYouTubeUrl('https://www.youtube.com/live/xyz').videoId).toBe('xyz');
    expect(parseYouTubeUrl('https://www.youtube.com/embed/123').videoId).toBe('123');
  });

  it('parses channel and handle URLs', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/channel/UC123').channelId).toBe('UC123');
    expect(parseYouTubeUrl('https://www.youtube.com/@SomeHandle/videos')).toMatchObject({
      kind: 'handle',
      handle: 'SomeHandle',
    });
  });

  it('ignores non-YouTube hosts', () => {
    expect(parseYouTubeUrl('https://example.com/watch?v=abc').kind).toBe('other');
  });
});

describe('matchEntity', () => {
  it('blocks exact video ids only', () => {
    const rules = rulesWith({ videos: [{ id: 'dQw4w9WgXcQ', title: '' }] });
    expect(matchEntity({ videoId: 'dQw4w9WgXcQ' }, rules).blocked).toBe(true);
    expect(matchEntity({ videoId: 'other' }, rules).blocked).toBe(false);
  });

  it('matches handles case-insensitively and ignores the @', () => {
    const rules = rulesWith({ channels: [{ id: '', name: '', handle: 'SomeChannel' }] });
    expect(matchEntity({ handle: '@somechannel' }, rules).blocked).toBe(true);
  });

  it('matches channel names as case-insensitive substrings', () => {
    const rules = rulesWith({ channelFilters: ['drama'] });
    expect(matchEntity({ channelName: 'Daily Drama Recap' }, rules).blocked).toBe(true);
    expect(matchEntity({ channelName: 'Comedy Central' }, rules).blocked).toBe(false);
  });

  it('matches channel filters against handles', () => {
    const rules = rulesWith({ channelFilters: ['somehandle'] });
    expect(matchEntity({ handle: 'SomeHandle' }, rules).blocked).toBe(true);
  });

  it('supports regex patterns', () => {
    const rules = rulesWith({ titleFilters: ['/\\bspoiler(s)?\\b/i'] });
    expect(matchEntity({ title: 'Ending Spoilers revealed' }, rules).blocked).toBe(true);
    expect(matchEntity({ title: 'A nice video' }, rules).blocked).toBe(false);
  });

  it('drops malformed regex patterns', () => {
    const rules = rulesWith({ titleFilters: ['/[unclosed/'] });
    expect(rules.titleFilters).toHaveLength(0);
  });

  it('matches comment filters against authors and content', () => {
    const rules = rulesWith({ commentFilters: ['spammer', '/free crypto/i'] });
    expect(matchEntity({ commentAuthor: 'Spammer99' }, rules).blocked).toBe(true);
    expect(matchEntity({ commentContent: 'Get FREE CRYPTO now' }, rules).blocked).toBe(true);
    expect(matchEntity({ commentContent: 'Nice video' }, rules).blocked).toBe(false);
  });

  it('caps the tested string length', () => {
    const rules = rulesWith({ commentFilters: ['needle'] });
    expect(matchEntity({ commentContent: 'needle' }, rules).blocked).toBe(true);
    expect(matchEntity({ commentContent: `${'x'.repeat(5000)}needle` }, rules).blocked).toBe(false);
  });
});

describe('isActiveEntry / countActiveEntries', () => {
  it('ignores blank and comment entries after trimming', () => {
    expect(isActiveEntry(' hello ')).toBe(true);
    expect(isActiveEntry('// note')).toBe(false);
    expect(isActiveEntry('  // note')).toBe(false);
    expect(isActiveEntry('   ')).toBe(false);
    expect(countActiveEntries(['a', '// b', '  // c', '', ' d '])).toBe(2);
  });
});

describe('areaForPath', () => {
  it('maps known paths', () => {
    expect(areaForPath('/')).toBe('homePage');
    expect(areaForPath('/feed/trending')).toBe('trendingPage');
    expect(areaForPath('/shorts')).toBe('shortsPage');
    expect(areaForPath('/feed/trending/')).toBe('trendingPage');
    expect(areaForPath('/watch')).toBeNull();
  });

  it('treats individual Shorts as the Shorts area', () => {
    expect(areaForPath('/shorts/abcdefghijk')).toBe('shortsPage');
    expect(areaForPath('/shorts/abcdefghijk/')).toBe('shortsPage');
  });
});

describe('matchDirectNavigation', () => {
  it('blocks direct video navigation', () => {
    const rules = rulesWith({ videos: [{ id: 'dQw4w9WgXcQ', title: '' }] });
    const parsed = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(matchDirectNavigation(parsed, '/watch', rules, defaultAreas()).blocked).toBe(true);
  });

  it('blocks direct channel navigation', () => {
    const rules = rulesWith({ channels: [{ id: 'UC123', name: '', handle: '' }] });
    const parsed = parseYouTubeUrl('https://www.youtube.com/channel/UC123');
    expect(matchDirectNavigation(parsed, '/channel/UC123', rules, defaultAreas()).blocked).toBe(
      true,
    );
  });

  it('blocks enabled area pages', () => {
    const rules = rulesWith();
    const areas = { ...defaultAreas(), trendingPage: true };
    const parsed = parseYouTubeUrl('https://www.youtube.com/feed/trending');
    expect(matchDirectNavigation(parsed, '/feed/trending', rules, areas).blocked).toBe(true);
  });

  it('does not block disabled areas', () => {
    const rules = rulesWith();
    const parsed = parseYouTubeUrl('https://www.youtube.com/feed/trending');
    expect(matchDirectNavigation(parsed, '/feed/trending', rules, defaultAreas()).blocked).toBe(
      false,
    );
  });
});
