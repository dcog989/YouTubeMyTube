export interface ChannelEntry {
  id: string;
  name: string;
  handle: string;
}

export interface VideoEntry {
  id: string;
  title: string;
}

export interface FilterRules {
  channels: ChannelEntry[];
  channelFilters: string[];
  videos: VideoEntry[];
  titleFilters: string[];
  commentFilters: string[];
}

export interface AreaFlags {
  homePage: boolean;
  trendingPage: boolean;
  explorePage: boolean;
  subscriptionsPage: boolean;
  shortsPage: boolean;
  shortsShelf: boolean;
  commentsSection: boolean;
  liveChat: boolean;
  relatedVideos: boolean;
  promoSections: boolean;
}

export interface Settings {
  enabled: boolean;
  theme: 'system' | 'light' | 'dark';
  blockMessage: string;
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
}

export interface MatchResult {
  blocked: boolean;
  reason?: string;
}

export type UrlKind =
  | 'video'
  | 'shorts'
  | 'live'
  | 'embed'
  | 'channel'
  | 'handle'
  | 'playlist'
  | 'feed'
  | 'search'
  | 'other';

export interface ParsedUrl {
  kind: UrlKind;
  videoId?: string;
  channelId?: string;
  handle?: string;
  playlistId?: string;
  feed?: string;
}

export interface CompiledPattern {
  test(value: string): boolean;
}

export interface CompiledRules {
  videoIds: Set<string>;
  channelIds: Set<string>;
  handles: Set<string>;
  titleFilters: CompiledPattern[];
  channelFilters: CompiledPattern[];
  commentFilters: CompiledPattern[];
}

export type AreaKey = keyof AreaFlags;
