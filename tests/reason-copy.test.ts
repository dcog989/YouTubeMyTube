import { describe, expect, it } from 'vitest';
import { reasonDetail, reasonLabel } from '../src/shared/reason-copy';

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
    expect(reasonLabel(null, 'fallback')).toBe('fallback');
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
