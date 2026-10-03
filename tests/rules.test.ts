import { describe, expect, it } from 'vitest';
import { defaultRules } from '../src/shared/defaults';
import {
  addChannel,
  addVideo,
  applyResolvedMeta,
  channelMatches,
  compileRules,
  findChannel,
  findVideo,
  hasVideoId,
  isChannelComplete,
  removeChannel,
  removeVideo,
  scansComments,
} from '../src/shared/rules';

describe('compileRules', () => {
  it('collects active ids, handles and compiled patterns', () => {
    const rules = compileRules({
      ...defaultRules(),
      videos: [
        { id: 'abc', title: '' },
        { id: '  ', title: '' },
      ],
      channels: [{ id: 'UC1', name: '', handle: '@SomeHandle' }],
      titleFilters: ['/spoiler/i', '// ignored'],
      commentFilters: ['spam'],
    });
    expect(rules.videoIds.has('abc')).toBe(true);
    expect(rules.videoIds.size).toBe(1);
    expect(rules.channelIds.has('UC1')).toBe(true);
    expect(rules.handles.has('somehandle')).toBe(true);
    expect(rules.handles.has('@SomeHandle')).toBe(false);
    expect(rules.titleFilters).toHaveLength(1);
    expect(rules.commentFilters).toHaveLength(1);
  });

  it('reports whether comments need scanning', () => {
    expect(scansComments(compileRules(defaultRules()))).toBe(false);
    expect(scansComments(compileRules({ ...defaultRules(), commentFilters: ['x'] }))).toBe(true);
    expect(
      scansComments(
        compileRules({ ...defaultRules(), channels: [{ id: 'UC1', name: '', handle: '' }] }),
      ),
    ).toBe(true);
  });

  it('collects normalized channel names for name-based matching', () => {
    const rules = compileRules({
      ...defaultRules(),
      channels: [
        { id: '', name: 'Rick Astley', handle: '' },
        { id: 'UC1', name: '', handle: 'somehandle' },
      ],
    });
    expect(rules.channelNames.has('rick astley')).toBe(true);
    expect(rules.channelNames.size).toBe(1);
  });

  it('collects names even on channels that have an id or handle', () => {
    const rules = compileRules({
      ...defaultRules(),
      channels: [
        { id: 'UC1', name: 'Music', handle: '' },
        { id: '', name: 'Music', handle: 'somehandle' },
      ],
    });
    expect(rules.channelNames.has('music')).toBe(true);
    expect(rules.channelNames.size).toBe(1);
  });
});

describe('channelMatches', () => {
  const entry = { id: 'UC1', name: '', handle: 'somechannel' };

  it('matches by id or normalized handle', () => {
    expect(channelMatches(entry, { id: 'UC1' })).toBe(true);
    expect(channelMatches(entry, { handle: '@somechannel' })).toBe(true);
    expect(channelMatches(entry, { id: 'UC2' })).toBe(false);
  });

  it('does not match an empty lookup', () => {
    expect(channelMatches(entry, {})).toBe(false);
    expect(channelMatches(entry, { id: '', handle: '' })).toBe(false);
  });

  it('matches by normalized name as a fallback', () => {
    const named = { id: '', name: 'Rick Astley', handle: '' };
    expect(channelMatches(named, { name: 'rick astley' })).toBe(true);
    expect(channelMatches(named, { name: '  Rick   Astley ' })).toBe(true);
    expect(channelMatches(named, { name: 'Someone Else' })).toBe(false);
  });

  it('falls back to the name for a name-only lookup', () => {
    expect(channelMatches({ id: 'UC1', name: 'Music', handle: '' }, { name: 'Music' })).toBe(true);
    expect(channelMatches({ id: '', name: 'Music', handle: 'music' }, { name: 'Music' })).toBe(
      true,
    );
  });

  it('does not name-match when the lookup and entry are both strong', () => {
    expect(
      channelMatches({ id: 'UC1', name: 'Music', handle: '' }, { id: 'UC2', name: 'Music' }),
    ).toBe(false);
    expect(
      channelMatches(
        { id: '', name: 'Music', handle: 'music' },
        { handle: 'other', name: 'Music' },
      ),
    ).toBe(false);
  });
});

describe('find / has', () => {
  const rules = {
    ...defaultRules(),
    videos: [{ id: 'abc', title: '' }],
    channels: [{ id: 'UC1', name: '', handle: 'somechannel' }],
  };

  it('looks up videos and channels', () => {
    expect(hasVideoId(rules, 'abc')).toBe(true);
    expect(hasVideoId(rules, 'missing')).toBe(false);
    expect(findVideo(rules, 'abc')?.id).toBe('abc');
    expect(findChannel(rules, { id: 'UC1' })?.id).toBe('UC1');
    expect(findChannel(rules, { handle: '@somechannel' })?.id).toBe('UC1');
    expect(findChannel(rules, { id: 'nope' })).toBeUndefined();
  });
});

describe('add / remove', () => {
  it('adds unique videos and rejects duplicates', () => {
    const rules = defaultRules();
    expect(addVideo(rules, { id: 'abc', title: '' })).toBe(true);
    expect(addVideo(rules, { id: 'abc', title: 'dup' })).toBe(false);
    expect(addVideo(rules, { id: '', title: '' })).toBe(false);
    expect(rules.videos).toHaveLength(1);
    expect(removeVideo(rules, 'abc')).toBe(true);
    expect(removeVideo(rules, 'abc')).toBe(false);
    expect(rules.videos).toHaveLength(0);
  });

  it('adds unique channels and removes by id or handle', () => {
    const rules = defaultRules();
    const entry = { id: 'UC1', name: '', handle: 'SomeChannel' };
    expect(addChannel(rules, entry)).toBe(true);
    expect(entry.handle).toBe('SomeChannel');
    expect(rules.channels[0]?.handle).toBe('somechannel');
    expect(addChannel(rules, { id: 'UC1', name: '', handle: '' })).toBe(false);
    expect(addChannel(rules, { id: '', name: '', handle: '@somechannel' })).toBe(false);
    expect(addChannel(rules, { id: '', name: '', handle: '' })).toBe(false);
    expect(rules.channels).toHaveLength(1);
    expect(removeChannel(rules, { handle: '@somechannel' })).toBe(true);
    expect(rules.channels).toHaveLength(0);
    expect(removeChannel(rules, { id: 'UC1' })).toBe(false);
  });

  it('accepts and removes name-only channel entries', () => {
    const rules = defaultRules();
    expect(addChannel(rules, { id: '', name: 'Rick Astley', handle: '' })).toBe(true);
    expect(addChannel(rules, { id: '', name: 'rick astley', handle: '' })).toBe(false);
    expect(rules.channels).toHaveLength(1);
    expect(findChannel(rules, { name: 'Rick Astley' })?.name).toBe('Rick Astley');
    expect(removeChannel(rules, { name: 'rick astley' })).toBe(true);
    expect(rules.channels).toHaveLength(0);
  });

  it('upgrades a name-only entry when the same channel arrives with an id', () => {
    const rules = defaultRules();
    expect(addChannel(rules, { id: '', name: 'Rick Astley', handle: '' })).toBe(true);
    expect(addChannel(rules, { id: 'UC1', name: 'Rick Astley', handle: 'RickAstley' })).toBe(true);
    expect(rules.channels).toEqual([{ id: 'UC1', name: 'Rick Astley', handle: 'rickastley' }]);
  });

  it('does not rewrite an already-resolved duplicate', () => {
    const rules = defaultRules();
    expect(addChannel(rules, { id: 'UC1', name: 'Rick', handle: '' })).toBe(true);
    expect(addChannel(rules, { id: 'UC1', name: '', handle: '' })).toBe(false);
    expect(rules.channels).toEqual([{ id: 'UC1', name: 'Rick', handle: '' }]);
  });

  it('removes the channel matching the most specific field', () => {
    const rules = defaultRules();
    rules.channels = [
      { id: 'UC1', name: 'Same Name', handle: '' },
      { id: 'UC2', name: 'Same Name', handle: '' },
    ];
    expect(removeChannel(rules, { id: 'UC2', name: 'Same Name' })).toBe(true);
    expect(rules.channels.map((channel) => channel.id)).toEqual(['UC1']);
  });

  it('prefers a handle match over a shared name', () => {
    const rules = defaultRules();
    rules.channels = [
      { id: '', name: 'Same Name', handle: 'alpha' },
      { id: '', name: 'Same Name', handle: 'beta' },
    ];
    expect(removeChannel(rules, { handle: '@beta', name: 'Same Name' })).toBe(true);
    expect(rules.channels.map((channel) => channel.handle)).toEqual(['alpha']);
  });
});

describe('applyResolvedMeta', () => {
  it('merges resolved fields into the stored entry', () => {
    const rules = defaultRules();
    const stored = { id: '', name: '', handle: 'somechannel' };
    rules.channels = [stored];
    expect(
      applyResolvedMeta(rules, stored, { id: 'UC1', name: 'Music', handle: 'somechannel' }),
    ).toBe('merged');
    expect(stored).toEqual({ id: 'UC1', name: 'Music', handle: 'somechannel' });
  });

  it('keeps an existing name but overrides id and handle', () => {
    const rules = defaultRules();
    const stored = { id: '', name: 'Original', handle: 'old' };
    rules.channels = [stored];
    expect(applyResolvedMeta(rules, stored, { id: 'UC1', name: 'Resolved', handle: 'new' })).toBe(
      'merged',
    );
    expect(stored).toEqual({ id: 'UC1', name: 'Original', handle: 'new' });
  });

  it('merges into an existing channel and drops the duplicate on conflict', () => {
    const rules = defaultRules();
    const conflict = { id: 'UC1', name: '', handle: '' };
    const stored = { id: '', name: '', handle: 'somechannel' };
    rules.channels = [conflict, stored];
    expect(
      applyResolvedMeta(rules, stored, { id: 'UC1', name: 'Music', handle: 'somechannel' }),
    ).toBe('conflict');
    expect(rules.channels).toEqual([{ id: 'UC1', name: 'Music', handle: 'somechannel' }]);
  });

  it('does not treat a name-only match as a conflict', () => {
    const rules = defaultRules();
    const stored = { id: '', name: '', handle: 'somechannel' };
    rules.channels = [stored, { id: '', name: 'Music', handle: '' }];
    expect(applyResolvedMeta(rules, stored, { id: '', name: 'Music', handle: '' })).toBe('merged');
    expect(rules.channels).toHaveLength(2);
  });
});

describe('isChannelComplete', () => {
  it('requires both a canonical id and a display name', () => {
    expect(isChannelComplete({ id: 'UC1', name: 'Music', handle: '' })).toBe(true);
    expect(isChannelComplete({ id: 'UC1', name: '', handle: 'music' })).toBe(false);
    expect(isChannelComplete({ id: '', name: 'Music', handle: 'music' })).toBe(false);
  });

  it('treats a handle and name without an id as incomplete', () => {
    expect(isChannelComplete({ id: '', name: 'Music', handle: 'music' })).toBe(false);
  });

  it('excludes entries that already failed lookup', () => {
    expect(isChannelComplete({ id: 'UC1', name: 'Music', handle: '', lookupFailed: true })).toBe(
      false,
    );
  });
});
