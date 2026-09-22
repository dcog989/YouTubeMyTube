export const MENU_ITEM_SELECTOR = [
  'ytd-menu-service-item-renderer',
  'yt-list-item-view-model',
  'ytm-menu-service-item-renderer',
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
].join(',');

export const INJECTED_ATTR = 'data-ytb-menu-item';
export const MOBILE_HOST = 'm.youtube.com';

export const DONT_RECOMMEND_LABELS = [
  "don't recommend channel",
  'do not recommend channel',
  "don't recommend this channel",
  "don't recommend posts from channel",
  'no recomendar el canal',
  'no recomanar el canal',
  'ne pas recommander cette chaîne',
  'kanal nicht empfehlen',
  'diesen kanal nicht empfehlen',
  'non consigliare il canale',
  'não recomendar o canal',
  'não recomendar este canal',
  'यह चैनल न सुझाएं',
  'चैनल का सुझाव न दें',
  'не рекомендовать этот канал',
  'не рекомендую этот канал',
  'этот канал не рекомендовать',
  'このチャンネルをおすすめしない',
  'このチャンネルをおすすめに表示しない',
  '이 채널을 추천하지 않음',
  '이 채널의 동영상을 추천하지 않음',
  'kanaal niet aanbevelen',
  'dit kanaal niet aanbevelen',
  'nie polecaj tego kanału',
  'nie polecaj kanału',
  'kanalı önerme',
  'bu kanalı önerme',
  'jangan rekomendasikan saluran ini',
  'jangan rekomendasikan channel ini',
  'عدم اقتراح القناة',
  'لا توصي بهذه القناة',
  'لا أنصح بهذه القناة',
  '不推荐此频道',
  '不要推荐此频道',
  'không đề xuất kênh này',
  'không gợi ý kênh này',
  'ไม่แนะนำช่องนี้',
  'rekommendera inte kanalen',
  'anbefal ikke kanalen',
  'ikke anbefal kanalen',
  'älä suosittele kanavaa',
  'nedoporučovat kanál',
  'να μην προτείνεται το κανάλι',
  'לא להמליץ על הערוץ',
  'не рекомендувати цей канал',
  'nu recomanda canalul',
  'ne ajánlja a csatornát',
] as const;
