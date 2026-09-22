import { YOUTUBE_ORIGIN } from './constants';
import { normalizeHandle, parseYouTubeUrl } from './url';

export type BlockInput =
  | { kind: 'video'; videoId: string }
  | { kind: 'channel'; channelId?: string; handle?: string };

export type BlockInputKind = BlockInput['kind'];

export interface ChannelRef {
  id?: string;
  handle?: string;
}

export interface ChannelMeta {
  id: string;
  name: string;
  handle: string;
}

export interface ResolveDeps {
  fetch: typeof fetch;
}

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{20,}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HANDLE = /^[A-Za-z0-9._-]{3,30}$/;

export function parseBlockInput(input: string, kind?: BlockInputKind): BlockInput | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith('@')) {
    const handle = normalizeHandle(value);
    return handle ? { kind: 'channel', handle } : null;
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

function firstGroup(html: string, pattern: RegExp): string {
  const match = pattern.exec(html);
  return match?.[1] ? decodeEntities(match[1]).trim() : '';
}

export function channelMetaFromHtml(html: string): ChannelMeta {
  const name =
    firstGroup(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
    firstGroup(html, /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i);

  const id =
    firstGroup(html, /"channelId":"(UC[A-Za-z0-9_-]+)"/) ||
    firstGroup(html, /"externalId":"(UC[A-Za-z0-9_-]+)"/) ||
    firstGroup(
      html,
      /<meta[^>]+itemprop=["']identifier["'][^>]*content=["'](UC[A-Za-z0-9_-]+)["']/i,
    );

  const canonical = firstGroup(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  let handle = '';
  const canonicalMatch = /youtube\.com\/@([^/?#]+)/i.exec(canonical);
  if (canonicalMatch?.[1]) handle = normalizeHandle(canonicalMatch[1]);
  if (!handle) {
    const vanity = firstGroup(html, /"canonicalBaseUrl":"\/(@[^"]+)"/);
    if (vanity) handle = normalizeHandle(vanity);
  }

  return { id, name, handle };
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

function fetchWith(deps?: Partial<ResolveDeps>): typeof fetch {
  return deps?.fetch ?? globalThis.fetch;
}

async function fetchOembed(videoId: string, deps?: Partial<ResolveDeps>): Promise<unknown> {
  const target = `${YOUTUBE_ORIGIN}/watch?v=${encodeURIComponent(videoId)}`;
  const url = `${YOUTUBE_ORIGIN}/oembed?url=${encodeURIComponent(target)}&format=json`;
  const response = await fetchWith(deps)(url);
  if (!response.ok) return null;
  return response.json();
}

export async function resolveVideoTitle(
  videoId: string,
  deps?: Partial<ResolveDeps>,
): Promise<string> {
  return videoTitleFromOembed(await fetchOembed(videoId, deps));
}

export async function resolveVideoChannel(
  videoId: string,
  deps?: Partial<ResolveDeps>,
): Promise<ChannelMeta> {
  const meta = channelRefFromOembed(await fetchOembed(videoId, deps));
  if (meta.id || !meta.handle) return meta;

  const resolved = await resolveChannel({ handle: meta.handle }, deps);
  return {
    id: resolved.id,
    name: resolved.name || meta.name,
    handle: resolved.handle || meta.handle,
  };
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

  const response = await fetchWith(deps)(`${YOUTUBE_ORIGIN}${path}`);
  if (!response.ok) return { id, name: '', handle };

  const meta = channelMetaFromHtml(await response.text());
  return { id: meta.id || id, name: meta.name, handle: meta.handle || handle };
}
