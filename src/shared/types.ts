export interface FilterRules {
  videoIds: string[];
  channelIds: string[];
  handles: string[];
  channelNames: string[];
  titles: string[];
  commentAuthors: string[];
  commentContents: string[];
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
}

export interface Settings {
  enabled: boolean;
  theme: 'system' | 'light' | 'dark';
  blockMessage: string;
}

export interface BlockerState {
  version: number;
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
  channelNames: CompiledPattern[];
  titles: CompiledPattern[];
  commentAuthors: CompiledPattern[];
  commentContents: CompiledPattern[];
}

export type AreaKey = keyof AreaFlags;
