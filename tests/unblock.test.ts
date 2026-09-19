import { describe, expect, it } from 'vitest';
import { defaultRules } from '../src/shared/defaults';
import { removeRule, ruleRefForReason } from '../src/shared/unblock';

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
