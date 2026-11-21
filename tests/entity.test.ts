import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cardEntity, commentEntity, currentContext, entityKey } from '../src/content/entity';
import { METADATA_SELECTOR } from '../src/content/entity-selectors';

// The extractors only need the few Element members they read; a plain stub
// keeps these tests free of a DOM implementation.
class FakeElement {}

beforeAll(() => {
  vi.stubGlobal('Element', FakeElement);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

interface StubOptions {
  selectors?: Record<string, Element | Element[]>;
  attributes?: Record<string, string>;
  text?: string;
}

function stub({ selectors = {}, attributes = {}, text = '' }: StubOptions = {}): Element {
  return Object.assign(new FakeElement(), {
    querySelector: (selector: string) => selectors[selector] ?? null,
    querySelectorAll: (selector: string) => {
      const match = selectors[selector];
      if (match === undefined) return [];
      return Array.isArray(match) ? match : [match];
    },
    getAttribute: (name: string) => attributes[name] ?? null,
    textContent: text,
  }) as unknown as Element;
}

function anchor(href: string, text = ''): Element {
  return stub({ attributes: { href }, text });
}

describe('cardEntity', () => {
  it('reads the video, channel and title from the card DOM', () => {
    const card = stub({
      selectors: {
        'a[href]': [anchor('/watch?v=abcdefghijk'), anchor('/@RickAstley', 'Rick Astley')],
        'a[title]': stub({ attributes: { title: '  Never Gonna Give You Up ' } }),
      },
    });

    expect(cardEntity(card)).toEqual({
      videoId: 'abcdefghijk',
      handle: 'RickAstley',
      channelName: 'Rick Astley',
      title: 'Never Gonna Give You Up',
    });
  });

  it('marks a Shorts card so the channel lookup can run', () => {
    const card = stub({
      selectors: {
        'a[href]': [anchor('/shorts/abcdefghijk')],
        '.shortsLockupViewModelHostMetadataTitle': stub({ text: 'A short' }),
      },
    });

    const entity = cardEntity(card);
    expect(entity.videoId).toBe('abcdefghijk');
    expect(entity.isShorts).toBe(true);
    expect(entity.title).toBe('A short');
  });

  it('falls back to the first metadata text that is not a view count or date', () => {
    const metadata = stub({
      selectors: {
        [METADATA_SELECTOR]: [
          stub({ text: '1.2M views' }),
          stub({ text: '3 days ago' }),
          stub({ text: 'Rick Astley' }),
        ],
      },
    });
    const card = stub({
      selectors: {
        'a[href]': [anchor('/watch?v=abcdefghijk')],
        '#video-title': stub({ text: 'A video' }),
        'yt-content-metadata-view-model': metadata,
      },
    });

    expect(cardEntity(card).channelName).toBe('Rick Astley');
  });
});

describe('commentEntity', () => {
  it('reads the author, handle and body from the comment DOM', () => {
    const thread = stub({
      selectors: {
        'a[href*="/channel/"], a[href^="/@"], a[href*="/@"]': anchor('/@SomeUser'),
        '#author-text': stub({ text: ' Some User ' }),
        '#content-text': stub({ text: ' buy my course ' }),
      },
    });

    expect(commentEntity(thread)).toEqual({
      handle: 'SomeUser',
      commentAuthor: 'Some User',
      commentContent: 'buy my course',
    });
  });
});

describe('currentContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('Element', FakeElement);
  });

  function page(identifier: string): Element {
    const author = stub({
      selectors: {
        'link[itemprop="url"]': stub({
          attributes: { href: 'http://www.youtube.com/@RickAstleyYT' },
        }),
        'link[itemprop="name"], meta[itemprop="name"]': stub({
          attributes: { content: 'Rick Astley' },
        }),
      },
    });
    const document = stub({
      selectors: {
        'meta[itemprop="identifier"]': stub({ attributes: { content: identifier } }),
        'meta[itemprop="name"]': stub({
          attributes: { content: 'Never Gonna Give You Up' },
        }),
        'span[itemprop="author"]': author,
      },
    });
    vi.stubGlobal('document', document);
    vi.stubGlobal('window', {
      location: { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    return document;
  }

  it('reads the channel and title from head data before the player DOM exists', () => {
    page('dQw4w9WgXcQ');
    expect(currentContext()).toEqual({
      videoId: 'dQw4w9WgXcQ',
      handle: 'RickAstleyYT',
      channelName: 'Rick Astley',
      title: 'Never Gonna Give You Up',
    });
  });

  it('ignores head data left behind by a previous navigation', () => {
    page('aaaaaaaaaaa');
    expect(currentContext()).toEqual({ videoId: 'dQw4w9WgXcQ' });
  });
});

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
