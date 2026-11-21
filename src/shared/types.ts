import type { AreaFlags } from './areas';
import type { Reason } from './reason';

export type { AreaFlags, AreaKey } from './areas';

export interface ChannelEntry {
  id: string;
  name: string;
  handle: string;
  lookupFailed?: boolean;
}

export interface VideoEntry {
  id: string;
  title: string;
  lookupFailed?: boolean;
}

export interface FilterRules {
  channels: ChannelEntry[];
  channelFilters: string[];
  videos: VideoEntry[];
  titleFilters: string[];
  commentFilters: string[];
  // Videos the user explicitly unblocked from the player cover. They stay
  // visible even when a channel or pattern filter still matches them.
  allowedVideos: string[];
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  enabled: boolean;
  theme: Theme;
  onboardingComplete: boolean;
}

export interface BlockerState {
  rules: FilterRules;
  areas: AreaFlags;
  settings: Settings;
}

export interface Entity {
  videoId?: string;
  channelId?: string;
  handle?: string;
  channelName?: string;
  title?: string;
  commentAuthor?: string;
  commentContent?: string;
  // Set when the card linked to a /shorts/ page. The filter only spends an
  // oEmbed lookup on these cards because their channel is not in the DOM.
  isShorts?: boolean;
}

export type MatchResult = { blocked: false } | { blocked: true; reason: Reason };

export type UrlKind = 'video' | 'shorts' | 'live' | 'embed' | 'channel' | 'handle' | 'other';

export interface ParsedUrl {
  kind: UrlKind;
  videoId?: string;
  channelId?: string;
  handle?: string;
}

export interface CompiledRules {
  videoIds: Set<string>;
  allowedVideoIds: Set<string>;
  channelIds: Set<string>;
  handles: Set<string>;
  channelNames: Set<string>;
  // Names from entries that carry no id or handle. Those entries block by name
  // for every card; strong entries block by name only when the card carries no
  // identity of its own.
  weakChannelNames: Set<string>;
  titleFilters: RegExp[];
  channelFilters: RegExp[];
  commentFilters: RegExp[];
}
