import { AREA_DEFINITIONS, REDIRECT_AREAS } from './areas';
import { YOUTUBE_DOMAIN, YOUTUBE_HOSTS, YOUTUBE_ORIGIN } from './constants';
import { formatReason } from './reason';
import type {
  AreaFlags,
  AreaKey,
  CompiledPattern,
  CompiledRules,
  Entity,
  FilterRules,
  MatchResult,
  ParsedUrl,
} from './types';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

const MAX_MATCH_LENGTH = 4096;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function matchesAny(patterns: CompiledPattern[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function isActiveEntry(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith('//');
}

export function countActiveEntries(entries: string[]): number {
  return entries.filter((entry) => isActiveEntry(entry)).length;
}

export function parsePattern(raw: string): RegExp | null {
  const trimmed = raw.trim();
  if (!isActiveEntry(trimmed)) return null;

  const regexForm = /^\/(.*)\/([a-z]*)$/i.exec(trimmed);
  if (regexForm) {
    const source = regexForm[1] ?? '';
    // `g`/`y` are stateful with reused `test()` calls; drop them.
    const flags = (regexForm[2] ?? '').replace(/[gy]/gi, '') || 'i';
    try {
      return new RegExp(source, flags);
    } catch {
      return null;
    }
  }

  return new RegExp(escapeRegExp(trimmed), 'i');
}

export function compilePatterns(entries: string[]): CompiledPattern[] {
  const compiled: CompiledPattern[] = [];
  for (const raw of entries) {
    const regex = parsePattern(raw);
    if (!regex) continue;
    compiled.push({ test: (value: string) => regex.test(value.slice(0, MAX_MATCH_LENGTH)) });
  }
  return compiled;
}

export function compileRules(rules: FilterRules): CompiledRules {
  const videoIds = new Set<string>();
  for (const { id } of rules.videos) {
    const value = id.trim();
    if (isActiveEntry(value)) videoIds.add(value);
  }

  const channelIds = new Set<string>();
  const handles = new Set<string>();
  for (const { id, handle } of rules.channels) {
    const channelId = id.trim();
    if (isActiveEntry(channelId)) channelIds.add(channelId);
    if (isActiveEntry(handle)) handles.add(handle);
  }

  return {
    videoIds,
    channelIds,
    handles,
    titleFilters: compilePatterns(rules.titleFilters),
    channelFilters: compilePatterns(rules.channelFilters),
    commentFilters: compilePatterns(rules.commentFilters),
  };
}

export function hasCommentRules(rules: CompiledRules): boolean {
  return rules.commentFilters.length > 0;
}

export function matchEntity(entity: Entity, rules: CompiledRules): MatchResult {
  if (entity.videoId && rules.videoIds.has(entity.videoId)) {
    return { blocked: true, reason: formatReason('video', entity.videoId) };
  }
  if (entity.channelId && rules.channelIds.has(entity.channelId)) {
    return { blocked: true, reason: formatReason('channel', entity.channelId) };
  }
  if (entity.handle && rules.handles.has(normalizeHandle(entity.handle))) {
    return { blocked: true, reason: formatReason('handle', normalizeHandle(entity.handle)) };
  }
  if (entity.title && matchesAny(rules.titleFilters, entity.title)) {
    return { blocked: true, reason: formatReason('title', entity.title) };
  }
  if (entity.channelName && matchesAny(rules.channelFilters, entity.channelName)) {
    return { blocked: true, reason: formatReason('channelName', entity.channelName) };
  }
  if (entity.handle && matchesAny(rules.channelFilters, entity.handle)) {
    return { blocked: true, reason: formatReason('channelName', entity.handle) };
  }
  if (entity.commentAuthor && matchesAny(rules.commentFilters, entity.commentAuthor)) {
    return { blocked: true, reason: formatReason('comment', entity.commentAuthor) };
  }
  if (entity.commentContent && matchesAny(rules.commentFilters, entity.commentContent)) {
    return { blocked: true, reason: formatReason('comment', entity.commentContent) };
  }
  return { blocked: false };
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
  const playlistId = params.get('list') ?? undefined;

  if (path === '/watch') {
    const videoId = params.get('v');
    if (videoId) return { kind: 'video', videoId, ...(playlistId ? { playlistId } : {}) };
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

  if (path === '/playlist') return { kind: 'playlist', ...(playlistId ? { playlistId } : {}) };
  if (path === '/results') return { kind: 'search' };

  match = /^\/feed\/([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'feed', feed: match[1] };

  return { kind: 'other' };
}

export function areaForPath(pathname: string): AreaKey | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const area of AREA_DEFINITIONS) {
    if (!area.path) continue;
    if (normalized === area.path || normalized.startsWith(`${area.path}/`)) return area.key;
  }
  return null;
}

export function matchAreaRedirect(pathname: string, areas: AreaFlags): MatchResult {
  const area = areaForPath(pathname);
  if (area && REDIRECT_AREAS.has(area) && areas[area]) {
    return { blocked: true, reason: formatReason('area', area) };
  }
  return { blocked: false };
}

export function matchDirectNavigation(
  parsed: ParsedUrl,
  pathname: string,
  rules: CompiledRules,
  areas: AreaFlags,
): MatchResult {
  if (parsed.videoId && rules.videoIds.has(parsed.videoId)) {
    return { blocked: true, reason: formatReason('video', parsed.videoId) };
  }
  if (parsed.channelId && rules.channelIds.has(parsed.channelId)) {
    return { blocked: true, reason: formatReason('channel', parsed.channelId) };
  }
  if (parsed.handle && rules.handles.has(normalizeHandle(parsed.handle))) {
    return { blocked: true, reason: formatReason('handle', normalizeHandle(parsed.handle)) };
  }
  return matchAreaRedirect(pathname, areas);
}
