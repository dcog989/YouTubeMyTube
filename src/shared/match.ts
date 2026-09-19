import { AREA_DEFINITIONS, REDIRECT_AREAS } from './areas';
import type { AreaFlags, AreaKey, CompiledRules, Entity, MatchResult, ParsedUrl } from './types';
import { normalizeHandle } from './url';

const MAX_MATCH_LENGTH = 4096;

function matchesAny(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value.slice(0, MAX_MATCH_LENGTH)));
}

export function matchEntity(entity: Entity, rules: CompiledRules): MatchResult {
  if (entity.videoId && rules.videoIds.has(entity.videoId)) {
    return { blocked: true, reason: { kind: 'video', value: entity.videoId } };
  }
  if (entity.channelId && rules.channelIds.has(entity.channelId)) {
    return { blocked: true, reason: { kind: 'channel', value: entity.channelId } };
  }
  if (entity.handle && rules.handles.has(normalizeHandle(entity.handle))) {
    const value = normalizeHandle(entity.handle);
    return { blocked: true, reason: { kind: 'handle', value } };
  }
  if (entity.title && matchesAny(rules.titleFilters, entity.title)) {
    return { blocked: true, reason: { kind: 'title', value: entity.title } };
  }
  if (entity.channelName && matchesAny(rules.channelFilters, entity.channelName)) {
    return { blocked: true, reason: { kind: 'channelName', value: entity.channelName } };
  }
  if (entity.handle && matchesAny(rules.channelFilters, entity.handle)) {
    return { blocked: true, reason: { kind: 'channelName', value: entity.handle } };
  }
  if (entity.commentAuthor && matchesAny(rules.commentFilters, entity.commentAuthor)) {
    return { blocked: true, reason: { kind: 'comment', value: entity.commentAuthor } };
  }
  if (entity.commentContent && matchesAny(rules.commentFilters, entity.commentContent)) {
    return { blocked: true, reason: { kind: 'comment', value: entity.commentContent } };
  }
  return { blocked: false };
}

export function areaForPath(pathname: string): AreaKey | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const area of AREA_DEFINITIONS) {
    if (area.mode !== 'redirect') continue;
    if (normalized === area.path || normalized.startsWith(`${area.path}/`)) return area.key;
  }
  return null;
}

export function matchAreaRedirect(pathname: string, areas: AreaFlags): MatchResult {
  const area = areaForPath(pathname);
  if (area && REDIRECT_AREAS.has(area) && areas[area]) {
    return { blocked: true, reason: { kind: 'area', value: area } };
  }
  return { blocked: false };
}

export function matchDirectNavigation(
  parsed: ParsedUrl,
  pathname: string,
  rules: CompiledRules,
  areas: AreaFlags,
): MatchResult {
  const result = matchEntity(
    { videoId: parsed.videoId, channelId: parsed.channelId, handle: parsed.handle },
    rules,
  );
  return result.blocked ? result : matchAreaRedirect(pathname, areas);
}
