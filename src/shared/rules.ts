import { compilePatterns, isActiveEntry } from './patterns';
import type { ChannelEntry, CompiledRules, FilterRules, VideoEntry } from './types';
import { normalizeChannelName, normalizeHandle } from './url';

export function compileRules(rules: FilterRules): CompiledRules {
  const videoIds = new Set<string>();
  for (const { id } of rules.videos) {
    const value = id.trim();
    if (isActiveEntry(value)) videoIds.add(value);
  }

  const allowedVideoIds = new Set<string>();
  for (const id of rules.allowedVideos) {
    const value = id.trim();
    if (isActiveEntry(value)) allowedVideoIds.add(value);
  }

  const channelIds = new Set<string>();
  const handles = new Set<string>();
  const channelNames = new Set<string>();
  const weakChannelNames = new Set<string>();
  for (const { id, handle, name } of rules.channels) {
    const channelId = id.trim();
    const channelHandle = normalizeHandle(handle);
    const strong = isActiveEntry(channelId) || isActiveEntry(channelHandle);
    if (isActiveEntry(channelId)) channelIds.add(channelId);
    if (isActiveEntry(channelHandle)) handles.add(channelHandle);
    const channelName = normalizeChannelName(name);
    if (channelName) {
      channelNames.add(channelName);
      if (!strong) weakChannelNames.add(channelName);
    }
  }

  return {
    videoIds,
    allowedVideoIds,
    channelIds,
    handles,
    channelNames,
    weakChannelNames,
    titleFilters: compilePatterns(rules.titleFilters),
    channelFilters: compilePatterns(rules.channelFilters),
    commentFilters: compilePatterns(rules.commentFilters),
  };
}

export function scansComments(rules: CompiledRules): boolean {
  // Comment authors expose a name; their author link can also carry a handle
  // or a channel id, which matchEntity checks like any other entity.
  return (
    rules.commentFilters.length > 0 ||
    rules.channelNames.size > 0 ||
    rules.channelIds.size > 0 ||
    rules.handles.size > 0
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
interface PreparedLookup {
  id: string;
  handle: string;
  name: string;
  strong: boolean;
}

function prepareLookup(lookup: ChannelLookup): PreparedLookup {
  const id = lookup.id?.trim() ?? '';
  const handle = lookup.handle ? normalizeHandle(lookup.handle) : '';
  return {
    id,
    handle,
    name: lookup.name ? normalizeChannelName(lookup.name) : '',
    strong: id !== '' || handle !== '',
  };
}

function channelMatchRank(entry: ChannelEntry, lookup: PreparedLookup): number {
  if (lookup.id !== '' && entry.id.trim() === lookup.id) return MATCH_ID;
  if (lookup.handle !== '' && entry.handle === lookup.handle) return MATCH_HANDLE;
  const strongEntry = entry.id.trim() !== '' || entry.handle.trim() !== '';
  if (lookup.strong && strongEntry) return NO_MATCH;
  if (lookup.name !== '' && normalizeChannelName(entry.name) === lookup.name) return MATCH_NAME;
  return NO_MATCH;
}

export function findChannel(rules: FilterRules, lookup: ChannelLookup): ChannelEntry | undefined {
  const prepared = prepareLookup(lookup);
  return rules.channels.find((channel) => channelMatchRank(channel, prepared) !== NO_MATCH);
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
  // An explicit block replaces any earlier "show this video" exception.
  const allowed = rules.allowedVideos.indexOf(entry.id.trim());
  if (allowed !== -1) rules.allowedVideos.splice(allowed, 1);
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

interface ChannelIndex {
  byId: Map<string, ChannelEntry>;
  byHandle: Map<string, ChannelEntry>;
  byName: Map<string, ChannelEntry>;
}

interface ChannelKeys {
  id: string;
  handle: string;
  name: string;
}

function channelKeys(entry: ChannelEntry): ChannelKeys {
  return {
    id: entry.id.trim(),
    handle: entry.handle.trim(),
    name: normalizeChannelName(entry.name),
  };
}

function isStrongChannel(entry: ChannelEntry): boolean {
  return entry.id.trim() !== '' || entry.handle.trim() !== '';
}

function indexChannel(index: ChannelIndex, entry: ChannelEntry): void {
  const keys = channelKeys(entry);
  if (keys.id && !index.byId.has(keys.id)) index.byId.set(keys.id, entry);
  if (keys.handle && !index.byHandle.has(keys.handle)) index.byHandle.set(keys.handle, entry);
  if (keys.name && !index.byName.has(keys.name)) index.byName.set(keys.name, entry);
}

function unindexChannel(index: ChannelIndex, entry: ChannelEntry, keys: ChannelKeys): void {
  if (keys.id && index.byId.get(keys.id) === entry) index.byId.delete(keys.id);
  if (keys.handle && index.byHandle.get(keys.handle) === entry) index.byHandle.delete(keys.handle);
  if (keys.name && index.byName.get(keys.name) === entry) index.byName.delete(keys.name);
}

function mergeChannelEntry(stored: ChannelEntry, meta: ChannelEntry): void {
  if (meta.id) stored.id = meta.id.trim();
  if (meta.name && !stored.name) stored.name = meta.name.trim();
  if (meta.handle) stored.handle = normalizeHandle(meta.handle);
}

// Batch add with the same merge rules as `addChannel`, but indexed so importing
// or normalizing thousands of rows stays linear instead of scanning per row.
export function mergeChannelEntries(
  entries: Iterable<ChannelEntry>,
  channels: ChannelEntry[] = [],
): { channels: ChannelEntry[]; added: number } {
  const index: ChannelIndex = { byId: new Map(), byHandle: new Map(), byName: new Map() };
  for (const channel of channels) indexChannel(index, channel);

  let added = 0;
  for (const raw of entries) {
    const meta: ChannelEntry = {
      id: raw.id.trim(),
      name: raw.name.trim(),
      handle: normalizeHandle(raw.handle),
    };
    if (raw.lookupFailed) meta.lookupFailed = true;
    if (!isActiveEntry(meta.id) && !isActiveEntry(meta.handle) && !isActiveEntry(meta.name)) {
      continue;
    }

    const strong = meta.id !== '' || meta.handle !== '';
    let stored = meta.id ? index.byId.get(meta.id) : undefined;
    if (!stored && meta.handle) stored = index.byHandle.get(meta.handle);
    if (!stored && meta.name) {
      const candidate = index.byName.get(normalizeChannelName(meta.name));
      if (candidate && !(strong && isStrongChannel(candidate))) stored = candidate;
    }

    if (!stored) {
      channels.push(meta);
      indexChannel(index, meta);
      added += 1;
      continue;
    }

    const oldKeys = channelKeys(stored);
    mergeChannelEntry(stored, meta);
    unindexChannel(index, stored, oldKeys);
    indexChannel(index, stored);
  }

  return { channels, added };
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
  const lookup = prepareLookup({ id: meta.id, handle: meta.handle });
  const conflict = rules.channels.find(
    (channel) => channel !== stored && channelMatchRank(channel, lookup) !== NO_MATCH,
  );
  if (!conflict) {
    if (meta.id) stored.id = meta.id.trim();
    if (meta.name && !stored.name) stored.name = meta.name.trim();
    if (meta.handle) stored.handle = normalizeHandle(meta.handle);
    return 'merged';
  }
  const index = rules.channels.indexOf(stored);
  if (index !== -1) rules.channels.splice(index, 1);
  if (meta.id && !conflict.id) conflict.id = meta.id.trim();
  if (meta.name && !conflict.name) conflict.name = meta.name.trim();
  if (meta.handle && !conflict.handle) conflict.handle = normalizeHandle(meta.handle);
  return 'conflict';
}

export function removeChannel(rules: FilterRules, lookup: ChannelLookup): boolean {
  const prepared = prepareLookup(lookup);
  // A name-only reason does not identify one row; remove every row that blocks
  // that name so the unblock action actually stops hiding the content.
  if (prepared.id === '' && prepared.handle === '' && prepared.name !== '') {
    const before = rules.channels.length;
    for (let index = rules.channels.length - 1; index >= 0; index -= 1) {
      const channel = rules.channels[index];
      if (channel && normalizeChannelName(channel.name) === prepared.name) {
        rules.channels.splice(index, 1);
      }
    }
    return rules.channels.length !== before;
  }
  let bestIndex = -1;
  let bestRank = Number.POSITIVE_INFINITY;
  rules.channels.forEach((channel, index) => {
    const rank = channelMatchRank(channel, prepared);
    if (rank !== NO_MATCH && rank < bestRank) {
      bestRank = rank;
      bestIndex = index;
    }
  });
  if (bestIndex === -1) return false;
  rules.channels.splice(bestIndex, 1);
  return true;
}
