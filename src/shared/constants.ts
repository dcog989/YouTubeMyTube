export const STATE_KEY = 'state';
export const STATE_VERSION = 1;

export const DEFAULT_VIDEO_ID_LENGTH = 11;
export const HANDLE_PREFIX = '@';

export const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
] as const;

export const FEED_AREA_PATHS: Readonly<Record<string, string>> = {
  '/feed/trending': 'trendingPage',
  '/feed/explore': 'explorePage',
  '/feed/subscriptions': 'subscriptionsPage',
  '/shorts': 'shortsPage',
};

export const BLOCKED_PAGE = 'blocked.html';
export const YOUTUBE_HOME = 'https://www.youtube.com/';
export const MAX_DNR_RULES = 5000;
