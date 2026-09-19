import { describe, expect, it } from 'vitest';
import { formatReason, parseReason, type Reason } from '../src/shared/reason';

describe('formatReason / parseReason', () => {
  it('round-trips every reason kind', () => {
    const reasons: Reason[] = [
      { kind: 'video', value: 'dQw4w9WgXcQ' },
      { kind: 'channel', value: 'UCabc' },
      { kind: 'handle', value: 'somechannel' },
      { kind: 'title', value: 'clickbait' },
      { kind: 'channelName', value: 'Drama Daily' },
      { kind: 'comment', value: 'free crypto' },
      { kind: 'area', value: 'shortsPage' },
    ];
    for (const reason of reasons) {
      expect(parseReason(formatReason(reason))).toEqual(reason);
    }
  });

  it('round-trips values containing newlines and quotes', () => {
    const reasons: Reason[] = [
      { kind: 'title', value: 'line one\nline two' },
      { kind: 'comment', value: 'a"b\nc' },
      { kind: 'channelName', value: 'multi\nline' },
    ];
    for (const reason of reasons) {
      expect(parseReason(formatReason(reason))).toEqual(reason);
    }
  });

  it('formats the wire strings the blocked page expects', () => {
    expect(formatReason({ kind: 'video', value: 'abc' })).toBe('video id abc');
    expect(formatReason({ kind: 'handle', value: 'somechannel' })).toBe(
      'channel handle @somechannel',
    );
    expect(formatReason({ kind: 'title', value: 'x' })).toBe('title filter "x"');
    expect(formatReason({ kind: 'area', value: 'shortsPage' })).toBe('area shortsPage');
  });

  it('returns null for malformed input', () => {
    expect(parseReason('')).toBeNull();
    expect(parseReason('something else')).toBeNull();
  });
});
