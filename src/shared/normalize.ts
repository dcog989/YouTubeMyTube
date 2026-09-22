import type { AreaFlags } from './areas';
import { defaultAreas, defaultRules, defaultSettings, defaultState } from './defaults';
import { countActiveEntries, sortEntries } from './patterns';
import { isTheme } from './theme';
import type { BlockerState, ChannelEntry, FilterRules, Settings, VideoEntry } from './types';
import { normalizeChannelName, normalizeHandle } from './url';

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function pickChannels(value: unknown): ChannelEntry[] {
  if (!Array.isArray(value)) return [];
  const result: ChannelEntry[] = [];
  const ids = new Set<string>();
  const handles = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const handle = typeof record.handle === 'string' ? normalizeHandle(record.handle) : '';
    if (!id && !handle && !name) continue;
    if (id && ids.has(id)) continue;
    if (handle && handles.has(handle)) continue;
    const normalizedName = normalizeChannelName(name);
    if (!id && !handle && normalizedName && names.has(normalizedName)) continue;
    if (id) ids.add(id);
    if (handle) handles.add(handle);
    if (normalizedName) names.add(normalizedName);
    const entry: ChannelEntry = { id, name, handle };
    if (record.lookupFailed === true) entry.lookupFailed = true;
    result.push(entry);
  }
  return result;
}

function pickVideos(value: unknown): VideoEntry[] {
  if (!Array.isArray(value)) return [];
  const result: VideoEntry[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const entry: VideoEntry = { id, title };
    if (record.lookupFailed === true) entry.lookupFailed = true;
    result.push(entry);
  }
  return result;
}

function mergeRules(value: unknown): FilterRules {
  if (!value || typeof value !== 'object') return defaultRules();
  const record = value as Record<string, unknown>;
  return {
    channels: pickChannels(record.channels),
    channelFilters: sortEntries(pickStringArray(record.channelFilters)),
    videos: pickVideos(record.videos),
    titleFilters: sortEntries(pickStringArray(record.titleFilters)),
    commentFilters: sortEntries(pickStringArray(record.commentFilters)),
  };
}

function mergeAreas(value: unknown): AreaFlags {
  const base = defaultAreas();
  if (!value || typeof value !== 'object') return base;
  const record = value as Record<string, unknown>;
  const result = { ...base };
  for (const key of Object.keys(base) as (keyof AreaFlags)[]) {
    if (typeof record[key] === 'boolean') result[key] = record[key] as boolean;
  }
  return result;
}

function mergeSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!value || typeof value !== 'object') return base;
  const record = value as Record<string, unknown>;
  const theme = record.theme;
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : base.enabled,
    theme: isTheme(theme) ? theme : base.theme,
  };
}

export function normalizeState(value: unknown): BlockerState {
  if (!value || typeof value !== 'object') return defaultState();
  const record = value as Record<string, unknown>;
  return {
    rules: mergeRules(record.rules),
    areas: mergeAreas(record.areas),
    settings: mergeSettings(record.settings),
  };
}

export function ruleCount(state: BlockerState): number {
  const { channels, channelFilters, videos, titleFilters, commentFilters } = state.rules;
  return (
    channels.length +
    videos.length +
    countActiveEntries(channelFilters) +
    countActiveEntries(titleFilters) +
    countActiveEntries(commentFilters)
  );
}
