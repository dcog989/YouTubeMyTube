import { YOUTUBE_DOMAIN, YOUTUBE_HOSTS, YOUTUBE_ORIGIN } from './constants';
import type { ParsedUrl } from './types';

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function normalizeChannelName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isYouTubeHost(hostname: string): boolean {
  if ((YOUTUBE_HOSTS as readonly string[]).includes(hostname)) return true;
  return hostname.endsWith(`.${YOUTUBE_DOMAIN}`);
}

export function parseYouTubeUrl(href: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(href, YOUTUBE_ORIGIN);
  } catch {
    return { kind: 'other' };
  }

  if (!isYouTubeHost(url.hostname)) return { kind: 'other' };

  const path = url.pathname;
  const params = url.searchParams;

  if (path === '/watch') {
    const videoId = params.get('v');
    if (videoId) return { kind: 'video', videoId };
  }

  let match = /^\/shorts\/([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'shorts', videoId: match[1] };

  match = /^\/live\/([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'live', videoId: match[1] };

  match = /^\/embed\/([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'embed', videoId: match[1] };

  match = /^\/channel\/([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'channel', channelId: match[1] };

  match = /^\/@([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'handle', handle: safeDecode(match[1]) };

  return { kind: 'other' };
}
