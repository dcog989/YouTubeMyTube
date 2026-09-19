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
    expect(ruleRefForReason({ kind: 'video', value: 'dQw4w9WgXcQ' })).toEqual({
      kind: 'video',
      value: 'dQw4w9WgXcQ',
    });
    expect(ruleRefForReason({ kind: 'channel', value: 'UCabc' })).toEqual({
      kind: 'channel',
      value: 'UCabc',
    });
    expect(ruleRefForReason({ kind: 'handle', value: 'SomeChannel' })).toEqual({
      kind: 'handle',
      value: 'somechannel',
    });
  });

  it('returns null for pattern, area and empty-handle reasons', () => {
    expect(ruleRefForReason({ kind: 'title', value: 'clickbait' })).toBeNull();
    expect(ruleRefForReason({ kind: 'channelName', value: 'drama' })).toBeNull();
    expect(ruleRefForReason({ kind: 'comment', value: 'spam' })).toBeNull();
    expect(ruleRefForReason({ kind: 'area', value: 'shortsPage' })).toBeNull();
    expect(ruleRefForReason({ kind: 'handle', value: '@' })).toBeNull();
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
    expect(reasonLabel({ kind: 'video', value: 'x' }, 'fallback')).toBe('This video is blocked.');
    expect(reasonLabel({ kind: 'handle', value: 'x' }, 'fallback')).toBe(
      'This channel is blocked.',
    );
    expect(reasonLabel({ kind: 'channelName', value: 'x' }, 'fallback')).toBe(
      'This channel is blocked.',
    );
    expect(reasonLabel({ kind: 'area', value: 'homePage' }, 'fallback')).toBe(
      'This page is blocked.',
    );
    expect(reasonLabel({ kind: 'title', value: 'x' }, 'fallback')).toBe('fallback');
  });
});

describe('reasonDetail', () => {
  it('describes entity and pattern matches', () => {
    expect(reasonDetail({ kind: 'video', value: 'abc' })).toBe('Blocked video ID: abc');
    expect(reasonDetail({ kind: 'channel', value: 'UC1' })).toBe('Blocked channel ID: UC1');
    expect(reasonDetail({ kind: 'handle', value: 'foo' })).toBe('Blocked channel: @foo');
    expect(reasonDetail({ kind: 'handle', value: 'FooBar' })).toBe('Blocked channel: @foobar');
    expect(reasonDetail({ kind: 'title', value: 'x' })).toBe('Blocked title: x');
    expect(reasonDetail({ kind: 'channelName', value: 'x' })).toBe('Blocked channel name: x');
    expect(reasonDetail({ kind: 'comment', value: 'x' })).toBe('Blocked comment: x');
    expect(reasonDetail({ kind: 'area', value: 'shortsPage' })).toBe('Blocked page: shortsPage');
  });

  it('falls back to a generic description for empty pattern values', () => {
    expect(reasonDetail({ kind: 'handle', value: '@' })).toBe('Blocked channel.');
    expect(reasonDetail({ kind: 'title', value: '' })).toBe('Blocked by a title filter.');
    expect(reasonDetail({ kind: 'channelName', value: '' })).toBe('Blocked by a channel filter.');
    expect(reasonDetail({ kind: 'comment', value: '' })).toBe('Blocked by a comment filter.');
  });
});

describe('entityUrlForReason', () => {
  it('builds YouTube URLs for exact matches', () => {
    expect(entityUrlForReason({ kind: 'video', value: 'abc' })).toBe(
      'https://www.youtube.com/watch?v=abc',
    );
    expect(entityUrlForReason({ kind: 'channel', value: 'UC1' })).toBe(
      'https://www.youtube.com/channel/UC1',
    );
    expect(entityUrlForReason({ kind: 'handle', value: 'foo' })).toBe(
      'https://www.youtube.com/@foo',
    );
    expect(entityUrlForReason({ kind: 'handle', value: '@Foo' })).toBe(
      'https://www.youtube.com/@foo',
    );
  });

  it('returns null otherwise', () => {
    expect(entityUrlForReason({ kind: 'title', value: 'x' })).toBeNull();
    expect(entityUrlForReason({ kind: 'area', value: 'homePage' })).toBeNull();
  });
});
