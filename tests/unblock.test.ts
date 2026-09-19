import { describe, expect, it } from 'vitest';
import { defaultRules } from '../src/shared/storage';
import {
  entityUrlForReason,
  reasonDetail,
  reasonLabel,
  removeRule,
  ruleRefForReason,
} from '../src/shared/unblock';

describe('ruleRefForReason', () => {
  it('maps exact video, channel and handle reasons', () => {
    expect(ruleRefForReason('video id dQw4w9WgXcQ')).toEqual({
      kind: 'video',
      value: 'dQw4w9WgXcQ',
    });
    expect(ruleRefForReason('channel id UCabc')).toEqual({ kind: 'channel', value: 'UCabc' });
    expect(ruleRefForReason('channel handle @SomeChannel')).toEqual({
      kind: 'handle',
      value: 'somechannel',
    });
  });

  it('returns null for pattern and malformed reasons', () => {
    expect(ruleRefForReason('title filter "clickbait"')).toBeNull();
    expect(ruleRefForReason('channel filter "drama"')).toBeNull();
    expect(ruleRefForReason('comment filter "spam"')).toBeNull();
    expect(ruleRefForReason('area shortsPage')).toBeNull();
    expect(ruleRefForReason('channel handle @')).toBeNull();
  });
});

describe('removeRule', () => {
  it('removes a matching video and reports whether it changed', () => {
    const rules = defaultRules();
    rules.videos = [
      { id: 'a', title: '' },
      { id: 'b', title: '' },
    ];
    expect(removeRule(rules, { kind: 'video', value: 'a' })).toBe(true);
    expect(rules.videos.map((video) => video.id)).toEqual(['b']);
    expect(removeRule(rules, { kind: 'video', value: 'missing' })).toBe(false);
  });

  it('removes channels by id or normalized handle', () => {
    const rules = defaultRules();
    rules.channels = [{ id: 'UC1', name: '', handle: 'somechannel' }];
    expect(removeRule(rules, { kind: 'handle', value: 'somechannel' })).toBe(true);
    expect(rules.channels).toEqual([]);

    rules.channels = [{ id: 'UC2', name: '', handle: '' }];
    expect(removeRule(rules, { kind: 'channel', value: 'UC2' })).toBe(true);
    expect(rules.channels).toEqual([]);
  });
});

describe('reasonLabel', () => {
  it('labels known reason kinds and falls back otherwise', () => {
    expect(reasonLabel('video id x', 'fallback')).toBe('This video is blocked.');
    expect(reasonLabel('channel handle @x', 'fallback')).toBe('This channel is blocked.');
    expect(reasonLabel('channel filter "x"', 'fallback')).toBe('This channel is blocked.');
    expect(reasonLabel('area homePage', 'fallback')).toBe('This page is blocked.');
    expect(reasonLabel('title filter "x"', 'fallback')).toBe('fallback');
    expect(reasonLabel('', 'fallback')).toBe('fallback');
  });
});

describe('reasonDetail', () => {
  it('describes entity and pattern matches', () => {
    expect(reasonDetail('video id abc')).toBe('Blocked video ID: abc');
    expect(reasonDetail('channel id UC1')).toBe('Blocked channel ID: UC1');
    expect(reasonDetail('channel handle @foo')).toBe('Blocked channel: @foo');
    expect(reasonDetail('channel handle @FooBar')).toBe('Blocked channel: @foobar');
    expect(reasonDetail('title filter "x"')).toBe('Blocked title: x');
    expect(reasonDetail('channel filter "x"')).toBe('Blocked channel name: x');
    expect(reasonDetail('comment filter "x"')).toBe('Blocked comment: x');
  });

  it('falls back to the raw reason', () => {
    expect(reasonDetail('area shortsPage')).toBe('area shortsPage');
    expect(reasonDetail('comment filter ""')).toBe('comment filter ""');
  });
});

describe('entityUrlForReason', () => {
  it('builds YouTube URLs for exact matches', () => {
    expect(entityUrlForReason('video id abc')).toBe('https://www.youtube.com/watch?v=abc');
    expect(entityUrlForReason('channel id UC1')).toBe('https://www.youtube.com/channel/UC1');
    expect(entityUrlForReason('channel handle @foo')).toBe('https://www.youtube.com/@foo');
  });

  it('returns null otherwise', () => {
    expect(entityUrlForReason('title filter "x"')).toBeNull();
    expect(entityUrlForReason('area homePage')).toBeNull();
  });
});
