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
    if (isActiveEntry(channelId)) channelIds.add(channelId);
    if (isActiveEntry(handle)) handles.add(handle);
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

export function hasCommentRules(rules: CompiledRules): boolean {
  return rules.commentFilters.length > 0;
}

export interface ChannelLookup {
  id?: string | null;
  handle?: string | null;
  name?: string | null;
}

export function channelMatches(entry: ChannelEntry, lookup: ChannelLookup): boolean {
  const id = lookup.id?.trim() ?? '';
  const handle = lookup.handle ? normalizeHandle(lookup.handle) : '';
  const name = lookup.name ? normalizeChannelName(lookup.name) : '';
  if (!id && !handle && !name) return false;
  return (
    (id !== '' && entry.id.trim() === id) ||
    (handle !== '' && entry.handle === handle) ||
    (name !== '' && normalizeChannelName(entry.name) === name)
  );
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
  entry.handle = normalizeHandle(entry.handle);
  if (!isActiveEntry(entry.id) && !isActiveEntry(entry.handle) && !isActiveEntry(entry.name)) {
    return false;
  }
  if (findChannel(rules, { id: entry.id, handle: entry.handle, name: entry.name })) return false;
  rules.channels.push(entry);
  return true;
}

export function removeChannel(rules: FilterRules, lookup: ChannelLookup): boolean {
  const index = rules.channels.findIndex((channel) => channelMatches(channel, lookup));
  if (index === -1) return false;
  rules.channels.splice(index, 1);
  return true;
}
