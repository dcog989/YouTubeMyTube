import { YOUTUBE_DOMAIN, YOUTUBE_HOSTS, YOUTUBE_ORIGIN, YOUTUBE_SHORT_DOMAIN } from './constants';
import type { ParsedUrl } from './types';

export const CHANNEL_ID = /^UC[A-Za-z0-9_-]{20,}$/;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const HANDLE = /^[A-Za-z0-9._-]{3,30}$/;

const SCHEME_LESS_YOUTUBE = /^(?:[\w-]+\.)?youtube\.com\/|^youtu\.be\//i;

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function normalizeChannelName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

// BlockTube stores a channel's label verbatim, so an entry can read
// "7NEWS Australia   @7news". Split the trailing handle out so the lookup has
// something to resolve. The handle must be a separate word.
const TRAILING_HANDLE = /\s@([A-Za-z0-9._-]+)\s*$/;

export function splitChannelLabel(value: string): { name: string; handle: string } {
  const match = TRAILING_HANDLE.exec(value);
  if (!match?.[1]) return { name: value.trim(), handle: '' };
  return { name: value.slice(0, match.index).trim(), handle: normalizeHandle(match[1]) };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toUrl(href: string): URL | null {
  const value = href.trim();
  const target = SCHEME_LESS_YOUTUBE.test(value) ? `https://${value}` : value;
  try {
    return new URL(target, YOUTUBE_ORIGIN);
  } catch {
    return null;
  }
}

export function isYouTubeHost(hostname: string): boolean {
  if ((YOUTUBE_HOSTS as readonly string[]).includes(hostname)) return true;
  return hostname.endsWith(`.${YOUTUBE_DOMAIN}`);
}

export function parseYouTubeUrl(href: string): ParsedUrl {
  const url = toUrl(href);
  if (!url || !isYouTubeHost(url.hostname)) return { kind: 'other' };

  const path = url.pathname;
  const params = url.searchParams;

  if (url.hostname === YOUTUBE_SHORT_DOMAIN) {
    const videoId = path.slice(1).split('/')[0] ?? '';
    return VIDEO_ID.test(videoId) ? { kind: 'video', videoId } : { kind: 'other' };
  }

  if (path === '/watch' || path === '/watch/') {
    const videoId = params.get('v')?.trim() ?? '';
    if (VIDEO_ID.test(videoId)) return { kind: 'video', videoId };
  }

  const shorts = /^\/shorts\/([^/?#]+)/.exec(path);
  if (shorts?.[1] && VIDEO_ID.test(shorts[1])) return { kind: 'shorts', videoId: shorts[1] };

  const live = /^\/live\/([^/?#]+)/.exec(path);
  if (live?.[1] && VIDEO_ID.test(live[1])) return { kind: 'live', videoId: live[1] };

  const embed = /^\/embed\/([^/?#]+)/.exec(path);
  if (embed?.[1] && VIDEO_ID.test(embed[1])) return { kind: 'embed', videoId: embed[1] };

  const channel = /^\/channel\/([^/?#]+)/.exec(path);
  if (channel?.[1]) return { kind: 'channel', channelId: channel[1] };

  const handle = /^\/@([^/?#]+)/.exec(path);
  if (handle?.[1]) {
    const value = safeDecode(handle[1]);
    if (HANDLE.test(normalizeHandle(value))) return { kind: 'handle', handle: value };
  }

  return { kind: 'other' };
}

// Legacy /c/Name and /user/Name pages redirect to the canonical /@handle page.
export function parseLegacyChannelPath(href: string): string | null {
  const url = toUrl(href);
  if (!url || !isYouTubeHost(url.hostname)) return null;
  const match = /^\/(c|user)\/([^/?#]+)/.exec(url.pathname);
  if (!match?.[1] || !match[2]) return null;
  return `/${match[1]}/${match[2]}`;
}
