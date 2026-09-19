import { normalizeHandle } from './matcher';
import type { ChannelEntry, FilterRules, VideoEntry } from './types';

export interface ChannelLookup {
  id?: string | null;
  handle?: string | null;
}

export function channelMatches(entry: ChannelEntry, lookup: ChannelLookup): boolean {
  const id = lookup.id?.trim() ?? '';
  const handle = lookup.handle ? normalizeHandle(lookup.handle) : '';
  if (!id && !handle) return false;
  return (
    (id !== '' && entry.id.trim() === id) ||
    (handle !== '' && normalizeHandle(entry.handle) === handle)
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
  if (!entry.id.trim() || hasVideoId(rules, entry.id)) return false;
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
  if (!entry.id.trim() && !normalizeHandle(entry.handle)) return false;
  if (findChannel(rules, { id: entry.id, handle: entry.handle })) return false;
  rules.channels.push(entry);
  return true;
}

export function removeChannel(rules: FilterRules, lookup: ChannelLookup): boolean {
  const index = rules.channels.findIndex((channel) => channelMatches(channel, lookup));
  if (index === -1) return false;
  rules.channels.splice(index, 1);
  return true;
}
