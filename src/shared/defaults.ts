import { AREA_DEFINITIONS, type AreaFlags } from './areas';
import type { BlockerState, FilterRules, Settings } from './types';

export function defaultRules(): FilterRules {
  return {
    channels: [],
    channelFilters: [],
    videos: [],
    titleFilters: [],
    commentFilters: [],
  };
}

export function defaultAreas(): AreaFlags {
  const areas = {} as AreaFlags;
  for (const { key } of AREA_DEFINITIONS) {
    areas[key] = false;
  }
  return areas;
}

export function defaultSettings(): Settings {
  return {
    enabled: true,
    theme: 'system',
  };
}

export function defaultState(): BlockerState {
  return {
    rules: defaultRules(),
    areas: defaultAreas(),
    settings: defaultSettings(),
  };
}
