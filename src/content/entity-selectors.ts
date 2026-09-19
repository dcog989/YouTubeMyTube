const ITEM_SELECTORS = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-playlist-renderer',
  'ytd-radio-renderer',
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-channel-renderer',
  'ytd-grid-channel-renderer',
  'ytd-compact-channel-renderer',
  'ytd-movie-renderer',
  'ytd-compact-movie-renderer',
  'yt-lockup-view-model',
  'ytm-video-with-context-renderer',
  'ytm-compact-video-renderer',
  'ytm-video-renderer',
  'ytm-reel-item-renderer',
  'ytm-channel-renderer',
  'ytm-compact-channel-renderer',
];

const COMMENT_SELECTORS = [
  'ytd-comment-thread-renderer',
  'ytd-comment-renderer',
  'ytm-comment-thread-renderer',
  'ytm-comment-renderer',
];

export const TITLE_SELECTORS = [
  '#video-title',
  '#video-title-link',
  'a#video-title',
  '.yt-lockup-metadata-view-model__title',
  'h3 a',
];

export const CHANNEL_TEXT_SELECTORS = [
  'ytd-channel-name a',
  '#channel-name a',
  'ytm-channel-name a',
];

export const OWNER_SCOPES = [
  '#owner',
  'ytd-watch-metadata #owner',
  'ytd-video-owner-renderer',
  '#upload-info',
  'ytm-slim-owner-renderer',
  'ytm-video-owner-renderer',
  'ytd-watch-metadata',
  'ytd-video-primary-info-renderer',
];

export const CHANNEL_LINK_SELECTORS = [
  'ytd-channel-name a[href]',
  '#channel-name a[href]',
  '#avatar-link[href]',
  'a[href^="/@"]',
  'a[href^="/channel/"]',
  'link[itemprop="url"][href]',
  'link[href^="/@"]',
  'link[href^="/channel/"]',
  'a[href]',
  'link[href]',
];

export const CHANNEL_PAGE_NAME_SELECTORS = [
  '#channel-name #text',
  '#channel-name yt-formatted-string',
  'ytd-channel-name #text',
  'ytd-channel-name yt-formatted-string',
  'yt-channel-name',
];

const SHADOW_ANCHOR_HOSTS = [
  'yt-lockup-view-model',
  'yt-lockup-metadata-view-model',
  'yt-content-metadata-view-model',
  'yt-thumbnail-view-model',
  'yt-avatar-view-model',
  'yt-decorated-avatar-view-model',
];

export const SHADOW_ANCHOR_HOST_SELECTOR = SHADOW_ANCHOR_HOSTS.join(',');

export const CHANNEL_HEADER_SELECTORS = [
  'ytd-channel-header-renderer',
  'ytd-c4-tabbed-header-renderer',
  '#channel-header',
  '#channel-header-container',
];

const METADATA_TEXT_SELECTORS = [
  '.yt-content-metadata-view-model__metadata-text',
  '.ytContentMetadataViewModelMetadataText',
  '.ytAttributedStringHost',
  '.yt-core-attributed-string',
];

export const METADATA_SELECTOR = METADATA_TEXT_SELECTORS.join(',');

export const CARD_SELECTOR = ITEM_SELECTORS.join(',');
export const COMMENT_SELECTOR = COMMENT_SELECTORS.join(',');
export const HIDDEN_CLASS = 'ytb-hidden';
