import { YOUTUBE_ORIGIN } from './constants';
import {
  CHANNEL_ID,
  HANDLE,
  normalizeChannelName,
  normalizeHandle,
  parseLegacyChannelPath,
  parseYouTubeUrl,
  splitChannelLabel,
  VIDEO_ID,
} from './url';

export type BlockInput =
  | { kind: 'video'; videoId: string }
  | { kind: 'channel'; channelId?: string; handle?: string; name?: string; path?: string };

export type BlockInputKind = BlockInput['kind'];

export interface ChannelRef {
  id?: string;
  handle?: string;
  name?: string;
  path?: string;
}

export interface ChannelMeta {
  id: string;
  name: string;
  handle: string;
}

export interface ResolveDeps {
  fetch: typeof fetch;
}

function looksLikeUrl(value: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ||
    value.startsWith('//') ||
    /^(?:www\.|(?:[\w-]+\.)+\w+\/)/i.test(value)
  );
}

export function parseBlockInput(input: string, kind?: BlockInputKind): BlockInput | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith('@')) {
    const handle = normalizeHandle(value);
    return HANDLE.test(handle) ? { kind: 'channel', handle } : null;
  }
  if (CHANNEL_ID.test(value)) return { kind: 'channel', channelId: value };

  // A bare 11-character token is a valid video id and a valid handle; the
  // channel field must be able to claim it as a handle.
  if (kind === 'channel' && HANDLE.test(value)) {
    return { kind: 'channel', handle: normalizeHandle(value) };
  }

  if (VIDEO_ID.test(value)) return { kind: 'video', videoId: value };

  const parsed = parseYouTubeUrl(value);
  if (parsed.videoId) return { kind: 'video', videoId: parsed.videoId };
  if (parsed.channelId) return { kind: 'channel', channelId: parsed.channelId };
  if (parsed.handle) return { kind: 'channel', handle: normalizeHandle(parsed.handle) };

  const path = parseLegacyChannelPath(value);
  if (path) return { kind: 'channel', path };

  // Any other plain text (e.g. a multi-word channel name) blocks that name.
  // A pasted "Name @handle" keeps the handle so it can be resolved to an id.
  if (kind === 'channel' && !looksLikeUrl(value)) {
    const { name, handle } = splitChannelLabel(value);
    return handle ? { kind: 'channel', name, handle } : { kind: 'channel', name };
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function firstGroup(html: string, pattern: RegExp, group = 1): string {
  const value = pattern.exec(html)?.[group];
  return value ? decodeEntities(value).trim() : '';
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function jsonGroup(html: string, pattern: RegExp): string {
  const match = pattern.exec(html);
  if (!match?.[1]) return '';
  return decodeEntities(decodeJsonString(match[1])).trim();
}

export function channelMetaFromHtml(html: string): ChannelMeta {
  const name =
    firstGroup(html, /<meta[^>]+property=["']og:title["'][^>]*content=(["'])(.*?)\1/i, 2) ||
    firstGroup(html, /<meta[^>]+content=(["'])(.*?)\1[^>]*property=["']og:title["']/i, 2);

  const canonical = firstGroup(html, /<link[^>]+rel=["']canonical["'][^>]*href=(["'])(.*?)\1/i, 2);
  // The canonical URL names the page's own channel; `"channelId"` also appears
  // in related-video data, so it is only a last resort.
  const id =
    /youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/i.exec(canonical)?.[1] ||
    firstGroup(html, /"externalId":"(UC[A-Za-z0-9_-]+)"/) ||
    firstGroup(
      html,
      /<meta[^>]+itemprop=["']identifier["'][^>]*content=(["'])(UC[A-Za-z0-9_-]+)\1/i,
      2,
    ) ||
    firstGroup(html, /"channelId":"(UC[A-Za-z0-9_-]+)"/);

  let handle = '';
  const canonicalMatch = /youtube\.com\/@([^/?#]+)/i.exec(canonical);
  if (canonicalMatch?.[1]) handle = normalizeHandle(canonicalMatch[1]);
  if (!handle) {
    const vanity = firstGroup(html, /"canonicalBaseUrl":"\/(@[^"]+)"/);
    if (vanity) handle = normalizeHandle(vanity);
  }

  return { id, name, handle };
}

const SEARCH_CHANNEL_FILTER = 'EgIQAg%3D%3D';
const CHANNEL_RENDERER = '"channelRenderer":';
const MAX_SEARCH_RESULTS = 20;

function metaFromChannelRenderer(block: string): ChannelMeta {
  const id = firstGroup(block, /"channelId":"(UC[A-Za-z0-9_-]+)"/);
  const name =
    jsonGroup(block, /"title":\{"simpleText":"((?:[^"\\]|\\.)*)"/) ||
    jsonGroup(block, /"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
  const canonical = firstGroup(block, /"canonicalBaseUrl":"\/(@[^"]+)"/);
  return { id, name, handle: canonical ? normalizeHandle(canonical) : '' };
}

// One block per `channelRenderer`, bounded by the next renderer instead of a
// fixed window, so a long first result cannot hide its own handle.
export function channelMetasFromSearch(html: string): ChannelMeta[] {
  const metas: ChannelMeta[] = [];
  let start = html.indexOf(CHANNEL_RENDERER);
  while (start !== -1 && metas.length < MAX_SEARCH_RESULTS) {
    const next = html.indexOf(CHANNEL_RENDERER, start + CHANNEL_RENDERER.length);
    metas.push(metaFromChannelRenderer(html.slice(start, next === -1 ? html.length : next)));
    start = next;
  }
  return metas;
}

export function channelMetaFromSearch(html: string): ChannelMeta {
  return channelMetasFromSearch(html)[0] ?? { id: '', name: '', handle: '' };
}

export function videoTitleFromOembed(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const title = (payload as Record<string, unknown>).title;
  return typeof title === 'string' ? title.trim() : '';
}

export function channelRefFromOembed(payload: unknown): ChannelMeta {
  if (!payload || typeof payload !== 'object') return { id: '', name: '', handle: '' };
  const record = payload as Record<string, unknown>;
  const name = typeof record.author_name === 'string' ? record.author_name.trim() : '';
  const authorUrl = typeof record.author_url === 'string' ? record.author_url : '';
  const parsed = parseYouTubeUrl(authorUrl);
  return {
    id: parsed.channelId ?? '',
    name,
    handle: parsed.handle ? normalizeHandle(parsed.handle) : '',
  };
}

const LOOKUP_TIMEOUT_MS = 10_000;

// A hung request would hold a channel-cache slot forever; abort it so the slot
// frees and the card can retry later.
function fetchLookup(url: string, deps?: Partial<ResolveDeps>): Promise<Response> {
  const fetchImpl = deps?.fetch ?? globalThis.fetch;
  return fetchImpl(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
}

async function fetchOembed(videoId: string, deps?: Partial<ResolveDeps>): Promise<unknown> {
  const target = `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(videoId)}`;
  const url = `${YOUTUBE_ORIGIN}/oembed?url=${encodeURIComponent(target)}&format=json`;
  const response = await fetchLookup(url, deps);
  // Only a 404 means the video is genuinely gone. Transient failures (429, 5xx)
  // must reject so callers do not record a permanent "not found".
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Video lookup failed with status ${response.status}`);
  return response.json();
}

export async function resolveVideoTitle(
  videoId: string,
  deps?: Partial<ResolveDeps>,
): Promise<string> {
  const payload = await fetchOembed(videoId, deps);
  if (payload === null) return '';
  const title = videoTitleFromOembed(payload);
  // A 200 without a title means the API answered with something unexpected
  // (consent/bot page), not that the video is gone; callers must retry later.
  if (!title) throw new Error('Video lookup returned no title');
  return title;
}

export async function resolveVideoChannel(
  videoId: string,
  deps?: Partial<ResolveDeps>,
): Promise<ChannelMeta> {
  const meta = channelRefFromOembed(await fetchOembed(videoId, deps));
  if (meta.id || !meta.handle) return meta;

  try {
    const resolved = await resolveChannel({ handle: meta.handle }, deps);
    return {
      id: resolved.id,
      name: resolved.name || meta.name,
      handle: resolved.handle || meta.handle,
    };
  } catch {
    return meta;
  }
}

export async function resolveChannel(
  ref: ChannelRef,
  deps?: Partial<ResolveDeps>,
): Promise<ChannelMeta> {
  const id = ref.id?.trim() ?? '';
  const handle = ref.handle ? normalizeHandle(ref.handle) : '';
  const path = id
    ? `/channel/${encodeURIComponent(id)}`
    : handle
      ? `/@${encodeURIComponent(handle)}`
      : '';
  if (!path) return { id, name: '', handle };

  const response = await fetchLookup(`${YOUTUBE_ORIGIN}${path}`, deps);
  if (!response.ok) {
    // Only a 404 means the channel genuinely does not exist. Transient
    // failures (429, 5xx) must reject so callers do not record a permanent
    // "not found" and can retry later.
    if (response.status === 404) return { id, name: '', handle };
    throw new Error(`Channel lookup failed with status ${response.status}`);
  }

  const meta = channelMetaFromHtml(await response.text());
  if (!meta.name && !meta.id && !meta.handle) {
    // A 200 without any channel metadata is a consent/bot page or a layout
    // change, not a missing channel; callers must retry later.
    throw new Error('Channel lookup returned no metadata');
  }
  return { id: meta.id || id, name: meta.name, handle: meta.handle || handle };
}

export async function resolveChannelByName(
  name: string,
  deps?: Partial<ResolveDeps>,
): Promise<ChannelMeta> {
  const query = name.trim();
  if (!query) return { id: '', name: '', handle: '' };

  const url = `${YOUTUBE_ORIGIN}/results?search_query=${encodeURIComponent(query)}&sp=${SEARCH_CHANNEL_FILTER}`;
  const response = await fetchLookup(url, deps);
  // A failed search is not a missing channel: reject so callers can retry later
  // instead of recording a permanent "not found".
  if (!response.ok) throw new Error(`Channel search failed with status ${response.status}`);

  const matches = channelMetasFromSearch(await response.text()).filter(
    (meta) => normalizeChannelName(meta.name) === normalizeChannelName(query),
  );
  // Display names are not unique; guessing between two same-name channels would
  // attach the wrong id to the block.
  const meta = matches.length === 1 ? matches[0] : undefined;
  return meta ?? { id: '', name: '', handle: '' };
}

// /c/Name and /user/Name redirect to the canonical /@handle page, so the page
// body is the only reliable source for the channel id and handle.
async function resolveLegacyChannel(
  path: string,
  deps?: Partial<ResolveDeps>,
): Promise<ChannelMeta> {
  const response = await fetchLookup(`${YOUTUBE_ORIGIN}${path}`, deps);
  if (!response.ok) {
    if (response.status === 404) return { id: '', name: '', handle: '' };
    throw new Error(`Channel lookup failed with status ${response.status}`);
  }
  const meta = channelMetaFromHtml(await response.text());
  if (!meta.name && !meta.id && !meta.handle) {
    throw new Error('Channel lookup returned no metadata');
  }
  return meta;
}

export async function resolveChannelMeta(
  ref: ChannelRef,
  deps?: Partial<ResolveDeps>,
): Promise<ChannelMeta> {
  if (ref.path) return resolveLegacyChannel(ref.path, deps);

  const id = ref.id?.trim() ?? '';
  const handle = ref.handle?.trim() ?? '';
  const name = ref.name?.trim() ?? '';

  if (id || handle) {
    const byRef = await resolveChannel({ id, handle }, deps);
    if (byRef.name) return byRef;

    // The id was tried first; when both are present, the handle is the next
    // strongest identity before falling back to the display name.
    if (id && handle) {
      const byHandle = await resolveChannel({ handle }, deps);
      if (byHandle.name) return byHandle;
    }

    // Only a stored display name identifies a channel for a search; a handle is
    // not a name, so searching it would bind the block to a different channel.
    if (name) {
      const byName = await resolveChannelByName(name, deps);
      if (byName.id || byName.name) return byName;
    }
    return byRef;
  }
  if (name) return resolveChannelByName(name, deps);
  return { id: '', name: '', handle: '' };
}
