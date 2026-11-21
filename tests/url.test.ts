import { describe, expect, it } from 'vitest';
import { parseYouTubeUrl, splitChannelLabel } from '../src/shared/url';

describe('splitChannelLabel', () => {
  it('splits a trailing handle from a channel label', () => {
    expect(splitChannelLabel('7NEWS Australia   @7news')).toEqual({
      name: '7NEWS Australia',
      handle: '7news',
    });
    expect(splitChannelLabel('Some Channel @Handle')).toEqual({
      name: 'Some Channel',
      handle: 'handle',
    });
  });

  it('leaves a label without a separate handle alone', () => {
    expect(splitChannelLabel('Some Channel')).toEqual({ name: 'Some Channel', handle: '' });
    expect(splitChannelLabel('mail@example.com')).toEqual({ name: 'mail@example.com', handle: '' });
    expect(splitChannelLabel('  padded  ')).toEqual({ name: 'padded', handle: '' });
  });
});

describe('parseYouTubeUrl', () => {
  it('parses watch URLs', () => {
    const parsed = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s');
    expect(parsed.kind).toBe('video');
    expect(parsed.videoId).toBe('dQw4w9WgXcQ');
  });

  it('parses relative and trailing-slash watch URLs', () => {
    expect(parseYouTubeUrl('/watch?v=abcdefghijk').videoId).toBe('abcdefghijk');
    expect(parseYouTubeUrl('https://www.youtube.com/watch/?v=abcdefghijk').videoId).toBe(
      'abcdefghijk',
    );
  });

  it('parses YouTube Music watch URLs', () => {
    expect(parseYouTubeUrl('https://music.youtube.com/watch?v=abcdefghijk')).toMatchObject({
      kind: 'video',
      videoId: 'abcdefghijk',
    });
  });

  it('parses scheme-less YouTube links', () => {
    expect(parseYouTubeUrl('youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      kind: 'video',
      videoId: 'dQw4w9WgXcQ',
    });
    expect(parseYouTubeUrl('m.youtube.com/@SomeHandle')).toMatchObject({
      kind: 'handle',
      handle: 'SomeHandle',
    });
    expect(parseYouTubeUrl('youtu.be/dQw4w9WgXcQ')).toMatchObject({
      kind: 'video',
      videoId: 'dQw4w9WgXcQ',
    });
  });

  it('parses youtu.be short links', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=10s')).toMatchObject({
      kind: 'video',
      videoId: 'dQw4w9WgXcQ',
    });
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ/')).toMatchObject({
      kind: 'video',
      videoId: 'dQw4w9WgXcQ',
    });
    expect(parseYouTubeUrl('https://youtu.be/').kind).toBe('other');
  });

  it('parses shorts, live and embed URLs', () => {
    expect(parseYouTubeUrl('https://m.youtube.com/shorts/abcdefghijk')).toMatchObject({
      kind: 'shorts',
      videoId: 'abcdefghijk',
    });
    expect(parseYouTubeUrl('https://www.youtube.com/live/abcdefghijk').videoId).toBe('abcdefghijk');
    expect(parseYouTubeUrl('https://www.youtube.com/embed/abcdefghijk').videoId).toBe(
      'abcdefghijk',
    );
  });

  it('rejects short links and routes without a full video id', () => {
    expect(parseYouTubeUrl('https://youtu.be/nope').kind).toBe('other');
    expect(parseYouTubeUrl('https://www.youtube.com/shorts/abc').kind).toBe('other');
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=abc').kind).toBe('other');
  });

  it('parses channel and handle URLs', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/channel/UC123').channelId).toBe('UC123');
    expect(parseYouTubeUrl('https://www.youtube.com/@SomeHandle/videos')).toMatchObject({
      kind: 'handle',
      handle: 'SomeHandle',
    });
  });

  it('rejects handles that are too short to exist', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/@a').kind).toBe('other');
  });

  it('ignores non-YouTube hosts', () => {
    expect(parseYouTubeUrl('https://example.com/watch?v=abc').kind).toBe('other');
  });
});
