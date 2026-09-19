import { describe, expect, it } from 'vitest';
import {
  channelMetaFromHtml,
  parseBlockInput,
  resolveChannel,
  resolveVideoTitle,
  videoTitleFromOembed,
} from '../src/shared/resolve';

const CHANNEL_HTML = `<!doctype html><html><head>
<meta property="og:title" content="My Channel">
<link rel="canonical" href="https://www.youtube.com/@mychannel">
<script>var x = {"channelId":"UCabc123","canonicalBaseUrl":"/@mychannel"};</script>
</head></html>`;

function fetchStub(body: string, ok = true): typeof fetch {
  return (async () =>
    ({
      ok,
      text: async () => body,
      json: async () => JSON.parse(body),
    }) as Response) as unknown as typeof fetch;
}

describe('parseBlockInput', () => {
  it('parses handles, channel ids and video ids', () => {
    expect(parseBlockInput('@SomeHandle')).toEqual({ kind: 'channel', handle: 'somehandle' });
    expect(parseBlockInput('UC'.concat('a'.repeat(22)))).toEqual({
      kind: 'channel',
      channelId: 'UC'.concat('a'.repeat(22)),
    });
    expect(parseBlockInput('dQw4w9WgXcQ')).toEqual({ kind: 'video', videoId: 'dQw4w9WgXcQ' });
  });

  it('parses pasted URLs', () => {
    expect(parseBlockInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'video',
      videoId: 'dQw4w9WgXcQ',
    });
    expect(parseBlockInput('https://www.youtube.com/channel/UCabc')).toEqual({
      kind: 'channel',
      channelId: 'UCabc',
    });
    expect(parseBlockInput('https://www.youtube.com/@SomeHandle/videos')).toEqual({
      kind: 'channel',
      handle: 'somehandle',
    });
  });

  it('returns null for unusable input', () => {
    expect(parseBlockInput('')).toBeNull();
    expect(parseBlockInput('   ')).toBeNull();
    expect(parseBlockInput('not a channel')).toBeNull();
    expect(parseBlockInput('https://example.com/watch?v=abc')).toBeNull();
  });

  it('claims a bare ambiguous token as a handle for the channel field', () => {
    expect(parseBlockInput('MrBeastGame', 'channel')).toEqual({
      kind: 'channel',
      handle: 'mrbeastgame',
    });
    expect(parseBlockInput('MrBeastGame', 'video')).toEqual({
      kind: 'video',
      videoId: 'MrBeastGame',
    });
  });
});

describe('channelMetaFromHtml', () => {
  it('extracts the name, id and handle', () => {
    expect(channelMetaFromHtml(CHANNEL_HTML)).toEqual({
      id: 'UCabc123',
      name: 'My Channel',
      handle: 'mychannel',
    });
  });

  it('returns empty fields when nothing is present', () => {
    expect(channelMetaFromHtml('<html></html>')).toEqual({ id: '', name: '', handle: '' });
  });

  it('decodes entities with &amp; last to avoid double-decoding', () => {
    expect(channelMetaFromHtml('<meta property="og:title" content="Tom &amp; Jerry">').name).toBe(
      'Tom & Jerry',
    );
    expect(channelMetaFromHtml('<meta property="og:title" content="&amp;quot;">').name).toBe(
      '&quot;',
    );
  });
});

describe('videoTitleFromOembed', () => {
  it('reads a title and tolerates other payloads', () => {
    expect(videoTitleFromOembed({ title: ' Cool Video ' })).toBe('Cool Video');
    expect(videoTitleFromOembed({})).toBe('');
    expect(videoTitleFromOembed(null)).toBe('');
  });
});

describe('resolveChannel / resolveVideoTitle', () => {
  it('resolves channel metadata from the page', async () => {
    const meta = await resolveChannel({ handle: 'mychannel' }, { fetch: fetchStub(CHANNEL_HTML) });
    expect(meta).toEqual({ id: 'UCabc123', name: 'My Channel', handle: 'mychannel' });
  });

  it('returns the input when the channel page is unavailable', async () => {
    const meta = await resolveChannel(
      { id: 'UC1', handle: 'mychannel' },
      { fetch: fetchStub('', false) },
    );
    expect(meta).toEqual({ id: 'UC1', name: '', handle: 'mychannel' });
  });

  it('resolves a video title from oEmbed', async () => {
    const title = await resolveVideoTitle('dQw4w9WgXcQ', {
      fetch: fetchStub('{"title":"Cool Video"}'),
    });
    expect(title).toBe('Cool Video');
  });

  it('returns an empty title when oEmbed fails', async () => {
    const title = await resolveVideoTitle('dQw4w9WgXcQ', { fetch: fetchStub('{}', false) });
    expect(title).toBe('');
  });
});
