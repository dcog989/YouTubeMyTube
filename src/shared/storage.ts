import { FILTER_DEFINITIONS } from './filters';
import type { AreaFlags, BlockerState, FilterRules, Settings } from './types';

export function defaultRules(): FilterRules {
  const rules = {} as FilterRules;
  for (const { key } of FILTER_DEFINITIONS) rules[key] = [];
  return rules;
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
    promoSections: false,
  };
}

export function defaultSettings(): Settings {
  return {
    enabled: true,
    theme: 'system',
    blockMessage: 'This content is blocked by YouTubeMyTube.',
  };
}

export function defaultState(): BlockerState {
  return {
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
  const rules = {} as FilterRules;
  for (const { key } of FILTER_DEFINITIONS) rules[key] = pickStringArray(record[key], base[key]);
  return rules;
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
    rules: mergeRules(record.rules),
    areas: mergeAreas(record.areas),
    settings: mergeSettings(record.settings),
  };
}

export function ruleCount(state: BlockerState): number {
  return FILTER_DEFINITIONS.reduce((sum, { key }) => sum + state.rules[key].length, 0);
}
