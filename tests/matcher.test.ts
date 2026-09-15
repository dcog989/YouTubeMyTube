import { describe, expect, it } from 'vitest';
import {
  areaForPath,
  compileRules,
  matchDirectNavigation,
  matchEntity,
  parseYouTubeUrl,
} from '../src/shared/matcher';
import { defaultAreas, defaultRules } from '../src/shared/storage';

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
    const rules = compileRules({ ...defaultRules(), videoIds: ['dQw4w9WgXcQ'] });
    expect(matchEntity({ videoId: 'dQw4w9WgXcQ' }, rules).blocked).toBe(true);
    expect(matchEntity({ videoId: 'other' }, rules).blocked).toBe(false);
  });

  it('matches handles case-insensitively and ignores the @', () => {
    const rules = compileRules({ ...defaultRules(), handles: ['SomeChannel'] });
    expect(matchEntity({ handle: '@somechannel' }, rules).blocked).toBe(true);
  });

  it('matches channel names as case-insensitive substrings', () => {
    const rules = compileRules({ ...defaultRules(), channelNames: ['drama'] });
    expect(matchEntity({ channelName: 'Daily Drama Recap' }, rules).blocked).toBe(true);
    expect(matchEntity({ channelName: 'Comedy Central' }, rules).blocked).toBe(false);
  });

  it('supports regex patterns', () => {
    const rules = compileRules({ ...defaultRules(), titles: ['/\\bspoiler(s)?\\b/i'] });
    expect(matchEntity({ title: 'Ending Spoilers revealed' }, rules).blocked).toBe(true);
    expect(matchEntity({ title: 'A nice video' }, rules).blocked).toBe(false);
  });

  it('drops malformed regex patterns', () => {
    const rules = compileRules({ ...defaultRules(), titles: ['/[unclosed/'] });
    expect(rules.titles).toHaveLength(0);
    expect(rules.isEmpty).toBe(true);
  });

  it('matches comment authors and content', () => {
    const rules = compileRules({
      ...defaultRules(),
      commentAuthors: ['spammer'],
      commentContents: ['/free crypto/i'],
    });
    expect(matchEntity({ commentAuthor: 'Spammer99' }, rules).blocked).toBe(true);
    expect(matchEntity({ commentContent: 'Get FREE CRYPTO now' }, rules).blocked).toBe(true);
    expect(matchEntity({ commentContent: 'Nice video' }, rules).blocked).toBe(false);
  });

  it('reports emptiness when no rules exist', () => {
    expect(compileRules(defaultRules()).isEmpty).toBe(true);
    expect(compileRules({ ...defaultRules(), videoIds: ['a'] }).isEmpty).toBe(false);
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
    const rules = compileRules({ ...defaultRules(), videoIds: ['dQw4w9WgXcQ'] });
    const parsed = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(matchDirectNavigation(parsed, '/watch', rules, defaultAreas()).blocked).toBe(true);
  });

  it('blocks enabled area pages', () => {
    const rules = compileRules(defaultRules());
    const areas = { ...defaultAreas(), trendingPage: true };
    const parsed = parseYouTubeUrl('https://www.youtube.com/feed/trending');
    expect(matchDirectNavigation(parsed, '/feed/trending', rules, areas).blocked).toBe(true);
  });

  it('does not block disabled areas', () => {
    const rules = compileRules(defaultRules());
    const parsed = parseYouTubeUrl('https://www.youtube.com/feed/trending');
    expect(matchDirectNavigation(parsed, '/feed/trending', rules, defaultAreas()).blocked).toBe(
      false,
    );
  });
});
