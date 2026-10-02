export const STATE_KEY = 'state';

export const HANDLE_PREFIX = '@';

export const YOUTUBE_DOMAIN = 'youtube.com';
export const YOUTUBE_SHORT_DOMAIN = 'youtu.be';
export const YOUTUBE_ORIGIN = 'https://www.youtube.com';

export const YOUTUBE_HOSTS = [
  YOUTUBE_DOMAIN,
  `www.${YOUTUBE_DOMAIN}`,
  `m.${YOUTUBE_DOMAIN}`,
  `music.${YOUTUBE_DOMAIN}`,
  YOUTUBE_SHORT_DOMAIN,
] as const;

export const BLOCKED_PAGE = 'blocked.html';
export const YOUTUBE_HOME = `${YOUTUBE_ORIGIN}/`;
export const YOUTUBE_HOST_PATTERN = String.raw`https?://(?:www|m)\.youtube\.com`;
// Dynamic rules that use regexFilter are capped by the browser
// (MAX_NUMBER_OF_REGEX_RULES).
export const MAX_DNR_REGEX_RULES = 1000;

export const CONTEXT_REQUEST = 'ytb:context';
export const SYNC_REQUEST = 'ytb:sync';
export const MUTATE_REQUEST = 'ytb:mutate';
