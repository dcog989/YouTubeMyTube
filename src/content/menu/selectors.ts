export const MENU_ITEM_SELECTOR = [
  'ytd-menu-service-item-renderer',
  'yt-list-item-view-model',
  'ytm-menu-service-item-renderer',
  'ytm-menu-navigation-item-renderer',
  'ytm-toggle-menu-service-item-renderer',
].join(',');

export const MENU_HOST_SELECTOR = [
  'ytd-watch-metadata',
  'ytd-video-primary-info-renderer',
  'ytd-video-owner-renderer',
  'ytm-slim-video-metadata-section-renderer',
].join(',');

export const MENU_TRIGGER_SELECTOR = [
  'ytd-menu-renderer',
  'ytd-menu-renderer button',
  'ytd-menu-renderer yt-button-shape',
  'yt-button-shape',
  'yt-icon-button',
  'ytm-menu-renderer',
  'ytm-menu-renderer button',
  '[aria-haspopup]',
].join(',');

export const NON_MENU_SELECTOR = [
  'ytd-add-to-playlist-renderer',
  'ytd-playlist-add-to-option-renderer',
  'ytd-compact-link-renderer',
].join(',');

export const MENU_POPUP_SELECTOR = [
  'tp-yt-iron-dropdown',
  'ytd-menu-popup-renderer',
  'ytd-multi-page-menu-renderer',
  'ytm-bottom-sheet-renderer',
].join(',');

export const INJECTED_ATTR = 'data-ytb-menu-item';
