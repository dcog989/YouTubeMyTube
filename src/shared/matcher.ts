import { HANDLE_PREFIX, YOUTUBE_HOSTS } from './constants';
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

function matchesAny(patterns: CompiledPattern[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export interface ParsedPattern {
  source: string;
  flags: string;
}

export function parsePattern(raw: string): ParsedPattern | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;

  const regexForm = /^\/(.*)\/([a-z]*)$/i.exec(trimmed);
  if (regexForm) {
    const source = regexForm[1] ?? '';
    // `g`/`y` are stateful with reused `test()` calls; drop them.
    const flags = (regexForm[2] ?? '').replace(/[gy]/gi, '') || 'i';
    try {
      // Validate eagerly; invalid patterns are dropped.
      new RegExp(source, flags);
      return { source, flags };
    } catch {
      return null;
    }
  }

  return { source: escapeRegExp(trimmed), flags: 'i' };
}

export function compilePatterns(entries: string[]): CompiledPattern[] {
  const compiled: CompiledPattern[] = [];
  for (const raw of entries) {
    const parsed = parsePattern(raw);
    if (!parsed) continue;
    try {
      const regex = new RegExp(parsed.source, parsed.flags);
      compiled.push({ raw, test: (value: string) => regex.test(value) });
    } catch {
      // Skip patterns that fail to compile.
    }
  }
  return compiled;
}

function toIdSet(entries: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of entries) {
    const value = raw.trim();
    if (!value || value.startsWith('//')) continue;
    set.add(value);
  }
  return set;
}

function toHandleSet(entries: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of entries) {
    const value = normalizeHandle(raw);
    if (!value || value.startsWith('//')) continue;
    set.add(value);
  }
  return set;
}

export function compileRules(rules: FilterRules): CompiledRules {
  const compiled: CompiledRules = {
    videoIds: toIdSet(rules.videoIds),
    channelIds: toIdSet(rules.channelIds),
    handles: toHandleSet(rules.handles),
    channelNames: compilePatterns(rules.channelNames),
    titles: compilePatterns(rules.titles),
    commentAuthors: compilePatterns(rules.commentAuthors),
    commentContents: compilePatterns(rules.commentContents),
    isEmpty: false,
  };

  compiled.isEmpty =
    compiled.videoIds.size === 0 &&
    compiled.channelIds.size === 0 &&
    compiled.handles.size === 0 &&
    compiled.channelNames.length === 0 &&
    compiled.titles.length === 0 &&
    compiled.commentAuthors.length === 0 &&
    compiled.commentContents.length === 0;

  return compiled;
}

export function hasCommentRules(rules: CompiledRules): boolean {
  return rules.commentAuthors.length > 0 || rules.commentContents.length > 0;
}

export function matchEntity(entity: Entity, rules: CompiledRules): MatchResult {
  if (entity.videoId && rules.videoIds.has(entity.videoId)) {
    return { blocked: true, reason: `video id ${entity.videoId}` };
  }
  if (entity.channelId && rules.channelIds.has(entity.channelId)) {
    return { blocked: true, reason: `channel id ${entity.channelId}` };
  }
  if (entity.handle && rules.handles.has(normalizeHandle(entity.handle))) {
    return {
      blocked: true,
      reason: `channel handle ${HANDLE_PREFIX}${normalizeHandle(entity.handle)}`,
    };
  }
  if (entity.channelName && matchesAny(rules.channelNames, entity.channelName)) {
    return { blocked: true, reason: `channel name "${entity.channelName}"` };
  }
  if (entity.title && matchesAny(rules.titles, entity.title)) {
    return { blocked: true, reason: `title "${entity.title}"` };
  }
  if (entity.commentAuthor && matchesAny(rules.commentAuthors, entity.commentAuthor)) {
    return { blocked: true, reason: `comment author "${entity.commentAuthor}"` };
  }
  if (entity.commentContent && matchesAny(rules.commentContents, entity.commentContent)) {
    return { blocked: true, reason: 'comment content' };
  }
  return { blocked: false };
}

export function isYouTubeHost(hostname: string): boolean {
  if ((YOUTUBE_HOSTS as readonly string[]).includes(hostname)) return true;
  return hostname.endsWith('.youtube.com');
}

export function parseYouTubeUrl(href: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(href, 'https://www.youtube.com');
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
  if (match?.[1]) return { kind: 'handle', handle: decodeURIComponent(match[1]) };

  if (path === '/playlist') return { kind: 'playlist', ...(playlistId ? { playlistId } : {}) };
  if (path === '/results') return { kind: 'search' };

  match = /^\/feed\/([^/?#]+)/.exec(path);
  if (match?.[1]) return { kind: 'feed', feed: match[1] };

  return { kind: 'other' };
}

const NAVIGABLE_AREAS: ReadonlySet<AreaKey> = new Set<AreaKey>([
  'trendingPage',
  'explorePage',
  'subscriptionsPage',
  'shortsPage',
]);

export function areaForPath(pathname: string): AreaKey | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  switch (normalized) {
    case '/':
      return 'homePage';
    case '/feed/trending':
      return 'trendingPage';
    case '/feed/explore':
      return 'explorePage';
    case '/feed/subscriptions':
      return 'subscriptionsPage';
    default:
      if (normalized === '/shorts' || normalized.startsWith('/shorts/')) return 'shortsPage';
      return null;
  }
}

export function matchDirectNavigation(
  parsed: ParsedUrl,
  pathname: string,
  rules: CompiledRules,
  areas: AreaFlags,
): MatchResult {
  if (parsed.videoId && rules.videoIds.has(parsed.videoId)) {
    return { blocked: true, reason: `video id ${parsed.videoId}` };
  }
  if (parsed.channelId && rules.channelIds.has(parsed.channelId)) {
    return { blocked: true, reason: `channel id ${parsed.channelId}` };
  }
  if (parsed.handle && rules.handles.has(normalizeHandle(parsed.handle))) {
    return { blocked: true, reason: `channel handle ${HANDLE_PREFIX}${parsed.handle}` };
  }
  const area = areaForPath(pathname);
  if (area && NAVIGABLE_AREAS.has(area) && areas[area]) {
    return { blocked: true, reason: `area ${area}` };
  }
  return { blocked: false };
}
