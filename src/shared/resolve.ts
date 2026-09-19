import { normalizeHandle, parseYouTubeUrl } from './matcher';

export type BlockInput =
  | { kind: 'video'; videoId: string }
  | { kind: 'channel'; channelId?: string; handle?: string };

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

export function parseBlockInput(input: string): BlockInput | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith('@')) {
    const handle = normalizeHandle(value);
    return handle ? { kind: 'channel', handle } : null;
  }
  if (CHANNEL_ID.test(value)) return { kind: 'channel', channelId: value };
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

function fetchWith(deps?: Partial<ResolveDeps>): typeof fetch {
  return deps?.fetch ?? globalThis.fetch;
}

export async function resolveVideoTitle(
  videoId: string,
  deps?: Partial<ResolveDeps>,
): Promise<string> {
  const target = `https://www.youtube.com/watch?v=${videoId}`;
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`;
  const response = await fetchWith(deps)(url);
  if (!response.ok) return '';
  const payload: unknown = await response.json();
  return videoTitleFromOembed(payload);
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

  const response = await fetchWith(deps)(`https://www.youtube.com${path}`);
  if (!response.ok) return { id, name: '', handle };

  const meta = channelMetaFromHtml(await response.text());
  return { id: meta.id || id, name: meta.name, handle: meta.handle || handle };
}
