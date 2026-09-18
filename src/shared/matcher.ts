import { AREA_DEFINITIONS, REDIRECT_AREAS } from './areas';
import { YOUTUBE_HOSTS } from './constants';
import { FILTER_DEFINITIONS } from './filters';
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
      compiled.push({ test: (value: string) => regex.test(value) });
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
  const compiled = {} as Record<keyof FilterRules, Set<string> | CompiledPattern[]>;
  for (const def of FILTER_DEFINITIONS) {
    const entries = rules[def.key];
    compiled[def.key] =
      def.match === 'pattern'
        ? compilePatterns(entries)
        : def.match === 'handle'
          ? toHandleSet(entries)
          : toIdSet(entries);
  }
  return compiled as CompiledRules;
}

export function hasCommentRules(rules: CompiledRules): boolean {
  return rules.commentAuthors.length > 0 || rules.commentContents.length > 0;
}

export function isRulePresent(rules: FilterRules, key: keyof FilterRules, value: string): boolean {
  const list = rules[key];
  if (key === 'handles') return list.some((entry) => normalizeHandle(entry) === value);
  return list.includes(value);
}

export function matchEntity(entity: Entity, rules: CompiledRules): MatchResult {
  const compiled = rules as Record<keyof FilterRules, Set<string> | CompiledPattern[]>;
  for (const def of FILTER_DEFINITIONS) {
    const raw = entity[def.entityField];
    if (!raw) continue;
    if (def.match === 'pattern') {
      if (matchesAny(compiled[def.key] as CompiledPattern[], raw)) {
        return { blocked: true, reason: formatReason(def.reason, raw) };
      }
      continue;
    }
    const value = def.match === 'handle' ? normalizeHandle(raw) : raw;
    if ((compiled[def.key] as Set<string>).has(value)) {
      return { blocked: true, reason: formatReason(def.reason, value) };
    }
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
    return { blocked: true, reason: formatReason('handle', parsed.handle) };
  }
  return matchAreaRedirect(pathname, areas);
}
