import { describe, expect, it } from 'vitest';
import { defaultRules } from '../src/shared/defaults';
import {
  addChannel,
  addVideo,
  channelMatches,
  compileRules,
  findChannel,
  findVideo,
  hasCommentRules,
  hasVideoId,
  removeChannel,
  removeVideo,
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
    expect(rules.handles.has('@SomeHandle')).toBe(true);
    expect(rules.titleFilters).toHaveLength(1);
    expect(rules.commentFilters).toHaveLength(1);
  });

  it('reports whether comment rules exist', () => {
    expect(hasCommentRules(compileRules(defaultRules()))).toBe(false);
    expect(hasCommentRules(compileRules({ ...defaultRules(), commentFilters: ['x'] }))).toBe(true);
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
    expect(addChannel(rules, { id: 'UC1', name: '', handle: 'somechannel' })).toBe(true);
    expect(addChannel(rules, { id: 'UC1', name: '', handle: '' })).toBe(false);
    expect(addChannel(rules, { id: '', name: '', handle: '@somechannel' })).toBe(false);
    expect(addChannel(rules, { id: '', name: '', handle: '' })).toBe(false);
    expect(rules.channels).toHaveLength(1);
    expect(removeChannel(rules, { handle: '@somechannel' })).toBe(true);
    expect(rules.channels).toHaveLength(0);
    expect(removeChannel(rules, { id: 'UC1' })).toBe(false);
  });
});
