import { describe, expect, it } from 'vitest';
import { entityKey } from '../src/content/entity';

describe('entityKey', () => {
  it('joins the identity fields that decide a re-evaluation', () => {
    expect(entityKey({ videoId: 'abc', channelId: 'UC1' })).toBe('abc\u0000UC1');
    expect(
      entityKey({
        videoId: 'abc',
        channelId: 'UC1',
        handle: 'foo',
        channelName: 'Foo',
        title: 'T',
        commentAuthor: 'A',
        commentContent: 'C',
      }),
    ).toBe('abc\u0000UC1\u0000foo\u0000Foo\u0000T\u0000A\u0000C');
  });

  it('ignores empty fields so a card and its pending lookup share a key', () => {
    expect(entityKey({ videoId: 'abc', channelId: '', title: '' })).toBe('abc');
    expect(entityKey({})).toBe('');
  });

  it('keeps fields distinct when their contents would otherwise run together', () => {
    expect(entityKey({ channelId: 'ab', handle: 'c' })).not.toBe(
      entityKey({ channelId: 'a', handle: 'bc' }),
    );
  });
});
