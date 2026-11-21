import { AREA_DEFINITIONS } from './areas';
import type { AreaFlags, AreaKey, CompiledRules, Entity, MatchResult, ParsedUrl } from './types';
import { normalizeChannelName, normalizeHandle } from './url';

const MAX_MATCH_LENGTH = 4096;

function matchesAny(patterns: RegExp[], value: string): boolean {
  const bounded = value.slice(0, MAX_MATCH_LENGTH);
  return patterns.some((pattern) => pattern.test(bounded));
}

export function matchEntity(entity: Entity, rules: CompiledRules): MatchResult {
  const videoId = entity.videoId?.trim() ?? '';
  if (videoId && rules.videoIds.has(videoId)) {
    return { blocked: true, reason: { kind: 'video', value: videoId } };
  }
  const channelId = entity.channelId?.trim() ?? '';
  if (channelId && rules.channelIds.has(channelId)) {
    return { blocked: true, reason: { kind: 'channel', value: channelId } };
  }
  const handle = entity.handle ? normalizeHandle(entity.handle) : '';
  if (handle && rules.handles.has(handle)) {
    return { blocked: true, reason: { kind: 'handle', value: handle } };
  }
  if (entity.channelName) {
    const name = normalizeChannelName(entity.channelName);
    // A card that names its channel id or handle tells us which channel it is;
    // only a name-only rule should override that identity.
    const hasStrongIdentity = channelId !== '' || handle !== '';
    if (
      name &&
      rules.channelNames.has(name) &&
      (!hasStrongIdentity || rules.weakChannelNames.has(name))
    ) {
      return { blocked: true, reason: { kind: 'channelNameRule', value: entity.channelName } };
    }
  }
  if (entity.commentAuthor) {
    const author = normalizeChannelName(entity.commentAuthor);
    if (author && rules.channelNames.has(author)) {
      return { blocked: true, reason: { kind: 'channelNameRule', value: entity.commentAuthor } };
    }
  }
  // A per-video exception bypasses pattern filters, but never an explicit
  // video or channel block: blocking the channel again must hide the video.
  if (videoId && rules.allowedVideoIds.has(videoId)) return { blocked: false };
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
  if (area && areas[area]) {
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
