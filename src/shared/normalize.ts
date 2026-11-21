import { AREA_DEFINITIONS, type AreaFlags } from './areas';
import { defaultAreas, defaultRules, defaultSettings, defaultState } from './defaults';
import { countActiveEntries, sortEntries } from './patterns';
import { mergeChannelEntries } from './rules';
import { isTheme } from './theme';
import type { BlockerState, ChannelEntry, FilterRules, Settings, VideoEntry } from './types';
import { VIDEO_ID } from './url';

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
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const entry = item.trim();
    if (entry === '') continue;
    // Keyword entries match case-insensitively; regex entries do not.
    const key = entry.startsWith('/') ? entry : entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function pickChannels(value: unknown): ChannelEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: ChannelEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const entry: ChannelEntry = {
      id: pickString(item.id),
      name: pickString(item.name),
      handle: pickString(item.handle),
    };
    if (item.lookupFailed === true) entry.lookupFailed = true;
    entries.push(entry);
  }
  // Merge duplicate rows so they keep every field they carry.
  return mergeChannelEntries(entries).channels;
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

function pickAllowedVideos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((id) => VIDEO_ID.test(id));
  return [...new Set(ids)];
}

function mergeRules(value: unknown): FilterRules {
  if (!isRecord(value)) return defaultRules();
  return {
    channels: pickChannels(value.channels),
    channelFilters: sortEntries(pickStringArray(value.channelFilters)),
    videos: pickVideos(value.videos),
    titleFilters: sortEntries(pickStringArray(value.titleFilters)),
    commentFilters: sortEntries(pickStringArray(value.commentFilters)),
    allowedVideos: pickAllowedVideos(value.allowedVideos),
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
}

export function summarizeRules(state: BlockerState): RuleSummary {
  const { channels, channelFilters, videos, titleFilters, commentFilters } = state.rules;
  let areas = 0;
  for (const area of AREA_DEFINITIONS) {
    if (state.areas[area.key]) areas += 1;
  }
  return {
    videos: videos.length,
    channels: channels.length,
    channelFilters: countActiveEntries(channelFilters),
    titleFilters: countActiveEntries(titleFilters),
    commentFilters: countActiveEntries(commentFilters),
    areas,
  };
}

export function ruleCount(state: BlockerState): number {
  const summary = summarizeRules(state);
  return (
    summary.videos +
    summary.channels +
    summary.channelFilters +
    summary.titleFilters +
    summary.commentFilters +
    summary.areas
  );
}
