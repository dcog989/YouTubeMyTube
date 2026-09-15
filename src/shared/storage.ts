import { STATE_VERSION } from './constants';
import type { AreaFlags, BlockerState, FilterRules, Settings } from './types';

export function defaultRules(): FilterRules {
  return {
    videoIds: [],
    channelIds: [],
    handles: [],
    channelNames: [],
    titles: [],
    commentAuthors: [],
    commentContents: [],
  };
}

export function defaultAreas(): AreaFlags {
  return {
    homePage: false,
    trendingPage: false,
    explorePage: false,
    subscriptionsPage: false,
    shortsPage: false,
    shortsShelf: false,
    commentsSection: false,
    liveChat: false,
    relatedVideos: false,
  };
}

export function defaultSettings(): Settings {
  return {
    enabled: true,
    theme: 'system',
    blockMessage: 'This content is blocked by YouTube Blocker.',
  };
}

export function defaultState(): BlockerState {
  return {
    version: STATE_VERSION,
    rules: defaultRules(),
    areas: defaultAreas(),
    settings: defaultSettings(),
  };
}

function pickStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string');
}

function mergeRules(value: unknown): FilterRules {
  const base = defaultRules();
  if (!value || typeof value !== 'object') return base;
  const record = value as Record<string, unknown>;
  return {
    videoIds: pickStringArray(record.videoIds, base.videoIds),
    channelIds: pickStringArray(record.channelIds, base.channelIds),
    handles: pickStringArray(record.handles, base.handles),
    channelNames: pickStringArray(record.channelNames, base.channelNames),
    titles: pickStringArray(record.titles, base.titles),
    commentAuthors: pickStringArray(record.commentAuthors, base.commentAuthors),
    commentContents: pickStringArray(record.commentContents, base.commentContents),
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
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : base.theme,
    blockMessage: typeof record.blockMessage === 'string' ? record.blockMessage : base.blockMessage,
  };
}

export function normalizeState(value: unknown): BlockerState {
  if (!value || typeof value !== 'object') return defaultState();
  const record = value as Record<string, unknown>;
  return {
    version: STATE_VERSION,
    rules: mergeRules(record.rules),
    areas: mergeAreas(record.areas),
    settings: mergeSettings(record.settings),
  };
}

export function ruleCount(state: BlockerState): number {
  const { rules } = state;
  return (
    rules.videoIds.length +
    rules.channelIds.length +
    rules.handles.length +
    rules.channelNames.length +
    rules.titles.length +
    rules.commentAuthors.length +
    rules.commentContents.length
  );
}
