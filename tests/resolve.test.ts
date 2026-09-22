import { describe, expect, it } from 'vitest';
import {
  channelMetaFromHtml,
  channelMetaFromSearch,
  channelRefFromOembed,
  parseBlockInput,
  resolveChannel,
  resolveChannelByName,
  resolveVideoChannel,
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

  it('parses a plain channel name for the channel field', () => {
    expect(parseBlockInput('3 Minutes of Aviation', 'channel')).toEqual({
      kind: 'channel',
      name: '3 Minutes of Aviation',
    });
    expect(parseBlockInput('3 Minutes of Aviation')).toBeNull();
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

const SEARCH_HTML = `<script>var ytInitialData = {"contents":{"channelRenderer":{"channelId":"UCCB1oLQY3XM86ACD05Lq4HQ","title":{"simpleText":"3 Minutes of Aviation"},"navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@3MinutesofAviation"}}}}};</script>`;

describe('channelMetaFromSearch', () => {
  it('extracts the first channel result', () => {
    expect(channelMetaFromSearch(SEARCH_HTML)).toEqual({
      id: 'UCCB1oLQY3XM86ACD05Lq4HQ',
      name: '3 Minutes of Aviation',
      handle: '3minutesofaviation',
    });
  });

  it('returns empty fields when there is no channel result', () => {
    expect(channelMetaFromSearch('<html></html>')).toEqual({ id: '', name: '', handle: '' });
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

describe('resolveChannelByName', () => {
  it('resolves a channel name through the channel search', async () => {
    const meta = await resolveChannelByName('3 Minutes of Aviation', {
      fetch: fetchStub(SEARCH_HTML),
    });
    expect(meta).toEqual({
      id: 'UCCB1oLQY3XM86ACD05Lq4HQ',
      name: '3 Minutes of Aviation',
      handle: '3minutesofaviation',
    });
  });
});

describe('channelRefFromOembed', () => {
  it('reads the handle and name from author_url', () => {
    expect(
      channelRefFromOembed({
        author_name: ' Rick Astley ',
        author_url: 'https://www.youtube.com/@RickAstleyYT',
      }),
    ).toEqual({ id: '', name: 'Rick Astley', handle: 'rickastleyyt' });
  });

  it('reads the channel id when author_url points at /channel', () => {
    expect(
      channelRefFromOembed({
        author_name: 'Rick Astley',
        author_url: 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
      }),
    ).toEqual({ id: 'UCuAXFkgsw1L7xaCfnd5JJOw', name: 'Rick Astley', handle: '' });
  });

  it('tolerates missing or malformed payloads', () => {
    expect(channelRefFromOembed(null)).toEqual({ id: '', name: '', handle: '' });
    expect(channelRefFromOembed({ author_url: 'https://example.com/@x' })).toEqual({
      id: '',
      name: '',
      handle: '',
    });
  });
});

describe('resolveVideoChannel', () => {
  it('keeps the oEmbed identity when the author_url is a handle', async () => {
    const meta = await resolveVideoChannel('dQw4w9WgXcQ', {
      fetch: fetchStub(
        '{"author_name":"Rick Astley","author_url":"https://www.youtube.com/@RickAstleyYT"}',
      ),
    });
    expect(meta).toEqual({ id: '', name: 'Rick Astley', handle: 'rickastleyyt' });
  });

  it('returns empty identity when oEmbed fails', async () => {
    const meta = await resolveVideoChannel('dQw4w9WgXcQ', { fetch: fetchStub('{}', false) });
    expect(meta).toEqual({ id: '', name: '', handle: '' });
  });
});
