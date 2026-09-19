export const STATE_KEY = 'state';

export const HANDLE_PREFIX = '@';

export const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
] as const;

export const BLOCKED_PAGE = 'blocked.html';
export const YOUTUBE_HOME = 'https://www.youtube.com/';
// Chrome caps dynamic rules that use regexFilter at 1000 (MAX_NUMBER_OF_REGEX_RULES).
export const MAX_DNR_REGEX_RULES = 1000;

export const CONTEXT_REQUEST = 'ytb:context';
export const SYNC_REQUEST = 'ytb:sync';
