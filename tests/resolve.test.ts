import { describe, expect, it } from 'vitest';
import {
  channelMetaFromHtml,
  channelMetaFromSearch,
  channelRefFromOembed,
  parseBlockInput,
  resolveChannel,
  resolveChannelByName,
  resolveChannelMeta,
  resolveVideoChannel,
  resolveVideoTitle,
  videoTitleFromOembed,
} from '../src/shared/resolve';

const CHANNEL_HTML = `<!doctype html><html><head>
<meta property="og:title" content="My Channel">
<link rel="canonical" href="https://www.youtube.com/@mychannel">
<script>var x = {"channelId":"UCabc123","canonicalBaseUrl":"/@mychannel"};</script>
</head></html>`;

function fetchStub(body: string, status = 200): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
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

  it('keeps a trailing handle when a channel label is pasted', () => {
    expect(parseBlockInput('7NEWS Australia   @7news', 'channel')).toEqual({
      kind: 'channel',
      name: '7NEWS Australia',
      handle: '7news',
    });
    expect(parseBlockInput('Some Channel', 'channel')).toEqual({
      kind: 'channel',
      name: 'Some Channel',
    });
  });

  it('parses legacy /c/ and /user/ channel URLs', () => {
    expect(parseBlockInput('https://www.youtube.com/c/SomeChannel')).toEqual({
      kind: 'channel',
      path: '/c/SomeChannel',
    });
    expect(parseBlockInput('https://www.youtube.com/user/SomeUser/videos')).toEqual({
      kind: 'channel',
      path: '/user/SomeUser',
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

  it('keeps punctuation that is valid in a channel name', () => {
    expect(parseBlockInput('AC/DC', 'channel')).toEqual({
      kind: 'channel',
      name: 'AC/DC',
    });
    expect(parseBlockInput('Foo: Bar', 'channel')).toEqual({
      kind: 'channel',
      name: 'Foo: Bar',
    });
  });

  it('still treats a pasted non-YouTube URL as unusable', () => {
    expect(parseBlockInput('https://example.com/channel/foo', 'channel')).toBeNull();
    expect(parseBlockInput('www.example.com/foo', 'channel')).toBeNull();
    expect(parseBlockInput('example.com/foo', 'channel')).toBeNull();
  });

  it('rejects handles that are too short to exist', () => {
    expect(parseBlockInput('@a')).toBeNull();
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

  it('prefers the canonical channel id over related-video ids', () => {
    const html = `<link rel="canonical" href="https://www.youtube.com/channel/UCown">
<script>{"channelId":"UCrelated"}</script>`;
    expect(channelMetaFromHtml(html).id).toBe('UCown');
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

const SEARCH_HTML_ESCAPED = `<script>var ytInitialData = {"contents":{"channelRenderer":{"channelId":"UCCB1oLQY3XM86ACD05Lq4HQ","title":{"simpleText":"Tom \\u0026 Jerry"},"navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@TomJerry"}}}}};</script>`;

const SEARCH_HTML_AVIATION = `<script>var ytInitialData = {"contents":{"channelRenderer":{"channelId":"UCCB1oLQY3XM86ACD05Lq4HQ","title":{"simpleText":"Aviation"},"navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@Aviation"}}}}};</script>`;

const SEARCH_HTML_QUOTED = `<script>var ytInitialData = {"contents":{"channelRenderer":{"channelId":"UCquoted1234567890123456","title":{"simpleText":"Rob \\"The Rob\\" Channel"},"navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@RobTheRob"}}}}};</script>`;

describe('channelMetaFromSearch', () => {
  it('extracts the first channel result', () => {
    expect(channelMetaFromSearch(SEARCH_HTML)).toEqual({
      id: 'UCCB1oLQY3XM86ACD05Lq4HQ',
      name: '3 Minutes of Aviation',
      handle: '3minutesofaviation',
    });
  });

  it('unescapes JSON string escapes in the name', () => {
    expect(channelMetaFromSearch(SEARCH_HTML_ESCAPED).name).toBe('Tom & Jerry');
  });

  it('returns empty fields when there is no channel result', () => {
    expect(channelMetaFromSearch('<html></html>')).toEqual({ id: '', name: '', handle: '' });
  });

  it('keeps quotes in a display name', () => {
    expect(channelMetaFromSearch(SEARCH_HTML_QUOTED).name).toBe('Rob "The Rob" Channel');
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

  it('returns the input when the channel is not found (404)', async () => {
    const meta = await resolveChannel(
      { id: 'UC1', handle: 'mychannel' },
      { fetch: fetchStub('', 404) },
    );
    expect(meta).toEqual({ id: 'UC1', name: '', handle: 'mychannel' });
  });

  it('rejects on transient failures so callers can retry', async () => {
    await expect(
      resolveChannel({ handle: 'mychannel' }, { fetch: fetchStub('', 503) }),
    ).rejects.toThrow();
  });

  it('resolves a video title from oEmbed', async () => {
    const title = await resolveVideoTitle('dQw4w9WgXcQ', {
      fetch: fetchStub('{"title":"Cool Video"}'),
    });
    expect(title).toBe('Cool Video');
  });

  it('returns an empty title when the video is gone (404)', async () => {
    const title = await resolveVideoTitle('dQw4w9WgXcQ', { fetch: fetchStub('', 404) });
    expect(title).toBe('');
  });

  it('rejects a rate-limited title lookup so callers retry later', async () => {
    await expect(resolveVideoTitle('dQw4w9WgXcQ', { fetch: fetchStub('', 429) })).rejects.toThrow();
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

  it('stays name-only when the first search hit has a different name', async () => {
    const meta = await resolveChannelByName('Someone Else', {
      fetch: fetchStub(SEARCH_HTML),
    });
    expect(meta).toEqual({ id: '', name: '', handle: '' });
  });

  it('matches a quoted display name', async () => {
    const meta = await resolveChannelByName('Rob "The Rob" Channel', {
      fetch: fetchStub(SEARCH_HTML_QUOTED),
    });
    expect(meta).toEqual({
      id: 'UCquoted1234567890123456',
      name: 'Rob "The Rob" Channel',
      handle: 'robtherob',
    });
  });

  it('rejects a failed search so callers retry later', async () => {
    await expect(resolveChannelByName('Someone', { fetch: fetchStub('', 503) })).rejects.toThrow();
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

  it('returns empty identity when the video is gone (404)', async () => {
    const meta = await resolveVideoChannel('dQw4w9WgXcQ', {
      fetch: fetchStub('{}', 404),
    });
    expect(meta).toEqual({ id: '', name: '', handle: '' });
  });

  it('rejects when oEmbed is rate-limited', async () => {
    await expect(
      resolveVideoChannel('dQw4w9WgXcQ', { fetch: fetchStub('{}', 429) }),
    ).rejects.toThrow();
  });
});

describe('resolveChannelMeta', () => {
  it('prefers a channel id and fills the display fields', async () => {
    const meta = await resolveChannelMeta({ id: 'UCabc' }, { fetch: fetchStub(CHANNEL_HTML) });
    expect(meta).toEqual({ id: 'UCabc123', name: 'My Channel', handle: 'mychannel' });
  });

  it('resolves a handle through the channel page', async () => {
    const meta = await resolveChannelMeta(
      { handle: 'mychannel' },
      { fetch: fetchStub(CHANNEL_HTML) },
    );
    expect(meta).toEqual({ id: 'UCabc123', name: 'My Channel', handle: 'mychannel' });
  });

  it('falls back to a name search when a bare handle has no channel page', async () => {
    const fetchImpl = (async (input: unknown) => {
      const isHandlePage = String(input).includes('/@aviation');
      const body = isHandlePage ? '' : SEARCH_HTML_AVIATION;
      return {
        ok: !isHandlePage,
        status: isHandlePage ? 404 : 200,
        text: async () => body,
        json: async () => JSON.parse(body || '{}'),
      } as Response;
    }) as unknown as typeof fetch;

    const meta = await resolveChannelMeta({ handle: 'aviation' }, { fetch: fetchImpl });
    expect(meta).toEqual({ id: 'UCCB1oLQY3XM86ACD05Lq4HQ', name: 'Aviation', handle: 'aviation' });
  });

  it('resolves a name-only entry through the channel search', async () => {
    const meta = await resolveChannelMeta(
      { name: '3 Minutes of Aviation' },
      { fetch: fetchStub(SEARCH_HTML) },
    );
    expect(meta).toEqual({
      id: 'UCCB1oLQY3XM86ACD05Lq4HQ',
      name: '3 Minutes of Aviation',
      handle: '3minutesofaviation',
    });
  });

  it('returns empty fields for an empty reference', async () => {
    expect(await resolveChannelMeta({})).toEqual({ id: '', name: '', handle: '' });
  });

  it('resolves a legacy channel path through the page it redirects to', async () => {
    const meta = await resolveChannelMeta(
      { path: '/c/SomeChannel' },
      { fetch: fetchStub(CHANNEL_HTML) },
    );
    expect(meta).toEqual({ id: 'UCabc123', name: 'My Channel', handle: 'mychannel' });
  });

  it('returns empty fields for a gone legacy page and rejects transient errors', async () => {
    expect(await resolveChannelMeta({ path: '/c/Gone' }, { fetch: fetchStub('', 404) })).toEqual({
      id: '',
      name: '',
      handle: '',
    });
    await expect(
      resolveChannelMeta({ path: '/c/Gone' }, { fetch: fetchStub('', 503) }),
    ).rejects.toThrow();
  });

  it('tries the handle when a stored id is gone', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: unknown) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/@aviation')) {
        return {
          ok: true,
          status: 200,
          text: async () => CHANNEL_HTML,
          json: async () => ({}),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const meta = await resolveChannelMeta(
      { id: 'UCdead', handle: 'aviation' },
      { fetch: fetchImpl },
    );
    expect(meta).toEqual({ id: 'UCabc123', name: 'My Channel', handle: 'mychannel' });
    expect(calls.some((url) => url.includes('/results'))).toBe(false);
  });

  it('searches by name when the stored id and handle are both gone', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: unknown) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/results')) {
        return {
          ok: true,
          status: 200,
          text: async () => SEARCH_HTML,
          json: async () => ({}),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const meta = await resolveChannelMeta(
      { id: 'UCdead', handle: 'aviation', name: '3 Minutes of Aviation' },
      { fetch: fetchImpl },
    );
    expect(meta).toEqual({
      id: 'UCCB1oLQY3XM86ACD05Lq4HQ',
      name: '3 Minutes of Aviation',
      handle: '3minutesofaviation',
    });
    expect(calls.some((url) => url.includes('search_query=3%20Minutes%20of%20Aviation'))).toBe(
      true,
    );
  });

  it('searches the display name, not a stale handle', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: unknown) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/results')) {
        return {
          ok: true,
          status: 200,
          text: async () => SEARCH_HTML,
          json: async () => ({}),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const meta = await resolveChannelMeta(
      { handle: 'stale', name: '3 Minutes of Aviation' },
      { fetch: fetchImpl },
    );
    expect(meta.id).toBe('UCCB1oLQY3XM86ACD05Lq4HQ');
    expect(calls.some((url) => url.includes('search_query=3%20Minutes%20of%20Aviation'))).toBe(
      true,
    );
    expect(calls.some((url) => url.includes('search_query=stale'))).toBe(false);
  });
});
