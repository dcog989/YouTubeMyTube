import { describe, expect, it } from 'vitest';
import { parseYouTubeUrl } from '../src/shared/url';

describe('parseYouTubeUrl', () => {
  it('parses watch URLs', () => {
    const parsed = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s');
    expect(parsed.kind).toBe('video');
    expect(parsed.videoId).toBe('dQw4w9WgXcQ');
  });

  it('parses relative watch URLs', () => {
    expect(parseYouTubeUrl('/watch?v=abcdefghijk').videoId).toBe('abcdefghijk');
  });

  it('parses shorts, live and embed URLs', () => {
    expect(parseYouTubeUrl('https://m.youtube.com/shorts/abc')).toMatchObject({
      kind: 'shorts',
      videoId: 'abc',
    });
    expect(parseYouTubeUrl('https://www.youtube.com/live/xyz').videoId).toBe('xyz');
    expect(parseYouTubeUrl('https://www.youtube.com/embed/123').videoId).toBe('123');
  });

  it('parses channel and handle URLs', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/channel/UC123').channelId).toBe('UC123');
    expect(parseYouTubeUrl('https://www.youtube.com/@SomeHandle/videos')).toMatchObject({
      kind: 'handle',
      handle: 'SomeHandle',
    });
  });

  it('ignores non-YouTube hosts', () => {
    expect(parseYouTubeUrl('https://example.com/watch?v=abc').kind).toBe('other');
  });
});
