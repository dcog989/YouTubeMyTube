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
  it('maps exact video, channel, handle and channel-name reasons', () => {
    expect(ruleRefForReason('video id dQw4w9WgXcQ')).toEqual({
      key: 'videoIds',
      value: 'dQw4w9WgXcQ',
    });
    expect(ruleRefForReason('channel id UCabc')).toEqual({ key: 'channelIds', value: 'UCabc' });
    expect(ruleRefForReason('channel handle @SomeChannel')).toEqual({
      key: 'handles',
      value: 'somechannel',
    });
    expect(ruleRefForReason('channel name "drama"')).toEqual({
      key: 'channelNames',
      value: 'drama',
    });
  });

  it('returns null for keyword and malformed reasons', () => {
    expect(ruleRefForReason('title "clickbait"')).toBeNull();
    expect(ruleRefForReason('area shortsPage')).toBeNull();
    expect(ruleRefForReason('channel handle @')).toBeNull();
  });
});

describe('removeRule', () => {
  it('removes a matching entry and reports whether it changed', () => {
    const rules = defaultRules();
    rules.videoIds = ['a', 'b'];
    expect(removeRule(rules, { key: 'videoIds', value: 'a' })).toBe(true);
    expect(rules.videoIds).toEqual(['b']);
    expect(removeRule(rules, { key: 'videoIds', value: 'missing' })).toBe(false);
  });

  it('removes handles after normalization', () => {
    const rules = defaultRules();
    rules.handles = ['somechannel'];
    const ref = ruleRefForReason('channel handle @SomeChannel');
    expect(ref).not.toBeNull();
    if (ref) expect(removeRule(rules, ref)).toBe(true);
    expect(rules.handles).toEqual([]);
  });
});

describe('reasonLabel', () => {
  it('labels known reason kinds and falls back otherwise', () => {
    expect(reasonLabel('video id x', 'fallback')).toBe('This video is blocked.');
    expect(reasonLabel('channel handle @x', 'fallback')).toBe('This channel is blocked.');
    expect(reasonLabel('area homePage', 'fallback')).toBe('This page is blocked.');
    expect(reasonLabel('title "x"', 'fallback')).toBe('fallback');
    expect(reasonLabel('', 'fallback')).toBe('fallback');
  });
});

describe('reasonDetail', () => {
  it('describes exact entity matches', () => {
    expect(reasonDetail('video id abc')).toBe('Blocked video ID: abc');
    expect(reasonDetail('channel id UC1')).toBe('Blocked channel ID: UC1');
    expect(reasonDetail('channel handle @foo')).toBe('Blocked channel: @foo');
    expect(reasonDetail('title "x"')).toBe('Blocked title: x');
    expect(reasonDetail('channel name "x"')).toBe('Blocked channel name: x');
  });

  it('falls back to the raw reason', () => {
    expect(reasonDetail('area shortsPage')).toBe('area shortsPage');
    expect(reasonDetail('comment content')).toBe('comment content');
  });
});

describe('entityUrlForReason', () => {
  it('builds YouTube URLs for exact matches', () => {
    expect(entityUrlForReason('video id abc')).toBe('https://www.youtube.com/watch?v=abc');
    expect(entityUrlForReason('channel id UC1')).toBe('https://www.youtube.com/channel/UC1');
    expect(entityUrlForReason('channel handle @foo')).toBe('https://www.youtube.com/@foo');
  });

  it('returns null otherwise', () => {
    expect(entityUrlForReason('title "x"')).toBeNull();
    expect(entityUrlForReason('area homePage')).toBeNull();
  });
});
