import { compilePatterns, isActiveEntry } from './patterns';
import type { ChannelEntry, CompiledRules, FilterRules, VideoEntry } from './types';
import { normalizeChannelName, normalizeHandle } from './url';

export function compileRules(rules: FilterRules): CompiledRules {
  const videoIds = new Set<string>();
  for (const { id } of rules.videos) {
    const value = id.trim();
    if (isActiveEntry(value)) videoIds.add(value);
  }

  const channelIds = new Set<string>();
  const handles = new Set<string>();
  const channelNames = new Set<string>();
  for (const { id, handle, name } of rules.channels) {
    const channelId = id.trim();
    const channelHandle = normalizeHandle(handle);
    if (isActiveEntry(channelId)) channelIds.add(channelId);
    if (isActiveEntry(channelHandle)) handles.add(channelHandle);
    const channelName = normalizeChannelName(name);
    if (channelName) channelNames.add(channelName);
  }

  return {
    videoIds,
    channelIds,
    handles,
    channelNames,
    titleFilters: compilePatterns(rules.titleFilters),
    channelFilters: compilePatterns(rules.channelFilters),
    commentFilters: compilePatterns(rules.commentFilters),
  };
}

export function scansComments(rules: CompiledRules): boolean {
  return (
    rules.commentFilters.length > 0 ||
    rules.channelIds.size > 0 ||
    rules.handles.size > 0 ||
    rules.channelNames.size > 0
  );
}

export interface ChannelLookup {
  id?: string | null;
  handle?: string | null;
  name?: string | null;
}

const NO_MATCH = -1;
const MATCH_ID = 0;
const MATCH_HANDLE = 1;
const MATCH_NAME = 2;

// Lower ranks are stronger matches; NO_MATCH means the entry is unrelated.
function channelMatchRank(entry: ChannelEntry, lookup: ChannelLookup): number {
  const id = lookup.id?.trim() ?? '';
  if (id !== '' && entry.id.trim() === id) return MATCH_ID;
  const handle = lookup.handle ? normalizeHandle(lookup.handle) : '';
  if (handle !== '' && entry.handle === handle) return MATCH_HANDLE;
  const strongLookup = id !== '' || handle !== '';
  const strongEntry = entry.id.trim() !== '' || entry.handle.trim() !== '';
  if (strongLookup && strongEntry) return NO_MATCH;
  const name = lookup.name ? normalizeChannelName(lookup.name) : '';
  if (name !== '' && normalizeChannelName(entry.name) === name) return MATCH_NAME;
  return NO_MATCH;
}

export function channelMatches(entry: ChannelEntry, lookup: ChannelLookup): boolean {
  return channelMatchRank(entry, lookup) !== NO_MATCH;
}

export function findChannel(rules: FilterRules, lookup: ChannelLookup): ChannelEntry | undefined {
  return rules.channels.find((channel) => channelMatches(channel, lookup));
}

export function findVideo(rules: FilterRules, videoId: string): VideoEntry | undefined {
  const id = videoId.trim();
  return rules.videos.find((video) => video.id.trim() === id);
}

export function hasVideoId(rules: FilterRules, videoId: string): boolean {
  return findVideo(rules, videoId) !== undefined;
}

export function addVideo(rules: FilterRules, entry: VideoEntry): boolean {
  if (!isActiveEntry(entry.id) || hasVideoId(rules, entry.id)) return false;
  rules.videos.push(entry);
  return true;
}

export function removeVideo(rules: FilterRules, videoId: string): boolean {
  const id = videoId.trim();
  const index = rules.videos.findIndex((video) => video.id.trim() === id);
  if (index === -1) return false;
  rules.videos.splice(index, 1);
  return true;
}

export function addChannel(rules: FilterRules, entry: ChannelEntry): boolean {
  const channel: ChannelEntry = { ...entry, handle: normalizeHandle(entry.handle) };
  if (
    !isActiveEntry(channel.id) &&
    !isActiveEntry(channel.handle) &&
    !isActiveEntry(channel.name)
  ) {
    return false;
  }
  const existing = findChannel(rules, channel);
  if (!existing) {
    rules.channels.push(channel);
    return true;
  }
  // A weaker (name-only) entry can match an incoming entry that carries an id
  // or handle; upgrade it in place so DNR can enforce the block instead of
  // silently treating the stronger entry as a duplicate.
  const beforeLength = rules.channels.length;
  const before = { id: existing.id, name: existing.name, handle: existing.handle };
  applyResolvedMeta(rules, existing, channel);
  return (
    rules.channels.length !== beforeLength ||
    existing.id !== before.id ||
    existing.name !== before.name ||
    existing.handle !== before.handle
  );
}

export function isChannelComplete(channel: ChannelEntry): boolean {
  return !channel.lookupFailed && Boolean(channel.id && channel.name);
}

export type ResolvedMetaOutcome = 'merged' | 'conflict';

export function applyResolvedMeta(
  rules: FilterRules,
  stored: ChannelEntry,
  meta: ChannelLookup,
): ResolvedMetaOutcome {
  const conflict = rules.channels.find(
    (channel) =>
      channel !== stored && channelMatches(channel, { id: meta.id, handle: meta.handle }),
  );
  if (!conflict) {
    if (meta.id) stored.id = meta.id;
    if (meta.name && !stored.name) stored.name = meta.name;
    if (meta.handle) stored.handle = meta.handle;
    return 'merged';
  }
  const index = rules.channels.indexOf(stored);
  if (index !== -1) rules.channels.splice(index, 1);
  if (meta.id && !conflict.id) conflict.id = meta.id;
  if (meta.name && !conflict.name) conflict.name = meta.name;
  if (meta.handle && !conflict.handle) conflict.handle = meta.handle;
  return 'conflict';
}

export function removeChannel(rules: FilterRules, lookup: ChannelLookup): boolean {
  let bestIndex = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  rules.channels.forEach((channel, index) => {
    const rank = channelMatchRank(channel, lookup);
    if (rank !== NO_MATCH && rank < bestRank) {
      bestRank = rank;
      bestIndex = index;
    }
  });
  if (bestIndex === -1) return false;
  rules.channels.splice(bestIndex, 1);
  return true;
}
