export const AREA_DEFINITIONS = [
  { key: 'homePage', path: null, redirect: false, className: 'ytb-hide-home' },
  { key: 'trendingPage', path: '/feed/trending', redirect: true, className: null },
  { key: 'explorePage', path: '/feed/explore', redirect: true, className: null },
  { key: 'subscriptionsPage', path: '/feed/subscriptions', redirect: true, className: null },
  { key: 'shortsPage', path: '/shorts', redirect: true, className: null },
  { key: 'shortsShelf', path: null, redirect: false, className: 'ytb-hide-shorts-shelf' },
  { key: 'commentsSection', path: null, redirect: false, className: 'ytb-hide-comments' },
  { key: 'liveChat', path: null, redirect: false, className: 'ytb-hide-live-chat' },
  { key: 'relatedVideos', path: null, redirect: false, className: 'ytb-hide-related' },
  { key: 'promoSections', path: null, redirect: false, className: 'ytb-hide-promos' },
] as const;

export type AreaKey = (typeof AREA_DEFINITIONS)[number]['key'];
export type AreaFlags = Record<AreaKey, boolean>;

export const REDIRECT_AREAS: ReadonlySet<AreaKey> = new Set(
  AREA_DEFINITIONS.filter((area) => area.redirect).map((area) => area.key),
);
