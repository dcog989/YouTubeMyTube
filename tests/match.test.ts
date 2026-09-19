import { describe, expect, it } from 'vitest';
import { defaultAreas, defaultRules } from '../src/shared/defaults';
import { areaForPath, matchDirectNavigation, matchEntity } from '../src/shared/match';
import { compileRules } from '../src/shared/rules';
import type { FilterRules } from '../src/shared/types';
import { parseYouTubeUrl } from '../src/shared/url';

function rulesWith(overrides: Partial<FilterRules> = {}) {
  return compileRules({ ...defaultRules(), ...overrides });
}

describe('matchEntity', () => {
  it('blocks exact video ids only', () => {
    const rules = rulesWith({ videos: [{ id: 'dQw4w9WgXcQ', title: '' }] });
    expect(matchEntity({ videoId: 'dQw4w9WgXcQ' }, rules).blocked).toBe(true);
    expect(matchEntity({ videoId: 'other' }, rules).blocked).toBe(false);
  });

  it('matches handles case-insensitively and ignores the @', () => {
    const rules = rulesWith({ channels: [{ id: '', name: '', handle: 'somechannel' }] });
    expect(matchEntity({ handle: '@SomeChannel' }, rules).blocked).toBe(true);
  });

  it('matches channel names as case-insensitive substrings', () => {
    const rules = rulesWith({ channelFilters: ['drama'] });
    expect(matchEntity({ channelName: 'Daily Drama Recap' }, rules).blocked).toBe(true);
    expect(matchEntity({ channelName: 'Comedy Central' }, rules).blocked).toBe(false);
  });

  it('blocks exact channel names from blocked channel entries', () => {
    const rules = rulesWith({ channels: [{ id: '', name: 'Rick Astley', handle: '' }] });
    expect(matchEntity({ channelName: 'Rick Astley' }, rules).blocked).toBe(true);
    expect(matchEntity({ channelName: 'rick astley' }, rules).blocked).toBe(true);
    expect(matchEntity({ channelName: 'Rick Astley Tribute' }, rules).blocked).toBe(false);
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

describe('areaForPath', () => {
  it('maps known paths', () => {
    expect(areaForPath('/')).toBeNull();
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
