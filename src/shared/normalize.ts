import { AREA_DEFINITIONS, type AreaFlags } from './areas';
import { defaultAreas, defaultRules, defaultSettings, defaultState } from './defaults';
import { countActiveEntries, isActiveEntry, sortEntries } from './patterns';
import { isTheme } from './theme';
import type { BlockerState, ChannelEntry, FilterRules, Settings, VideoEntry } from './types';
import { normalizeChannelName, normalizeHandle } from './url';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

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
    if (!isRecord(item)) continue;
    const id = pickString(item.id);
    const name = pickString(item.name);
    const handle = pickString(item.handle);
    if (!id && !handle && !name) continue;
    if (id && ids.has(id)) continue;
    if (handle && handles.has(handle)) continue;
    const normalizedName = normalizeChannelName(name);
    if (!id && !handle && normalizedName && names.has(normalizedName)) continue;
    if (id) ids.add(id);
    if (handle) handles.add(handle);
    if (normalizedName) names.add(normalizedName);
    const entry: ChannelEntry = { id, name, handle };
    if (item.lookupFailed === true) entry.lookupFailed = true;
    result.push(entry);
  }
  return result;
}

function pickVideos(value: unknown): VideoEntry[] {
  if (!Array.isArray(value)) return [];
  const result: VideoEntry[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = pickString(item.id);
    const title = pickString(item.title);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const entry: VideoEntry = { id, title };
    if (item.lookupFailed === true) entry.lookupFailed = true;
    result.push(entry);
  }
  return result;
}

function mergeRules(value: unknown): FilterRules {
  if (!isRecord(value)) return defaultRules();
  return {
    channels: pickChannels(value.channels),
    channelFilters: sortEntries(pickStringArray(value.channelFilters)),
    videos: pickVideos(value.videos),
    titleFilters: sortEntries(pickStringArray(value.titleFilters)),
    commentFilters: sortEntries(pickStringArray(value.commentFilters)),
  };
}

function mergeAreas(value: unknown): AreaFlags {
  const base = defaultAreas();
  if (!isRecord(value)) return base;
  const result = { ...base };
  for (const key of Object.keys(base) as (keyof AreaFlags)[]) {
    const flag = pickBoolean(value[key]);
    if (flag !== undefined) result[key] = flag;
  }
  return result;
}

function mergeSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!isRecord(value)) return base;
  const theme = value.theme;
  const enabled = pickBoolean(value.enabled);
  const onboardingComplete = pickBoolean(value.onboardingComplete);
  return {
    enabled: enabled ?? base.enabled,
    theme: isTheme(theme) ? theme : base.theme,
    onboardingComplete: onboardingComplete ?? base.onboardingComplete,
  };
}

export function normalizeState(value: unknown): BlockerState {
  if (!isRecord(value)) return defaultState();
  return {
    rules: mergeRules(value.rules),
    areas: mergeAreas(value.areas),
    settings: mergeSettings(value.settings),
  };
}

export interface RuleSummary {
  videos: number;
  channels: number;
  channelFilters: number;
  titleFilters: number;
  commentFilters: number;
  areas: number;
  redirectAreas: number;
  activeVideoIds: number;
  activeChannelIds: number;
  handles: number;
  enabled: boolean;
}

export function summarizeRules(state: BlockerState): RuleSummary {
  const { channels, channelFilters, videos, titleFilters, commentFilters } = state.rules;
  let areas = 0;
  let redirectAreas = 0;
  for (const area of AREA_DEFINITIONS) {
    if (!state.areas[area.key]) continue;
    areas += 1;
    if (area.mode === 'redirect') redirectAreas += 1;
  }
  return {
    videos: videos.length,
    channels: channels.length,
    channelFilters: countActiveEntries(channelFilters),
    titleFilters: countActiveEntries(titleFilters),
    commentFilters: countActiveEntries(commentFilters),
    areas,
    redirectAreas,
    activeVideoIds: videos.filter(({ id }) => isActiveEntry(id)).length,
    activeChannelIds: channels.filter(({ id }) => isActiveEntry(id)).length,
    handles: channels.filter(({ handle }) => isActiveEntry(handle)).length,
    enabled: state.settings.enabled,
  };
}

export function ruleCount(state: BlockerState): number {
  const summary = summarizeRules(state);
  return (
    summary.videos +
    summary.channels +
    summary.channelFilters +
    summary.titleFilters +
    summary.commentFilters
  );
}
