export interface AreaBase {
  key: string;
}

export interface RedirectArea {
  mode: 'redirect';
  path: string;
}

export interface HideArea {
  mode: 'hide';
  className: string;
}

export type AreaDefinition = AreaBase & (RedirectArea | HideArea);

export const AREA_DEFINITIONS = [
  { key: 'homePage', mode: 'hide', className: 'ytb-hide-home' },
  { key: 'trendingPage', mode: 'redirect', path: '/feed/trending' },
  { key: 'explorePage', mode: 'redirect', path: '/feed/explore' },
  { key: 'subscriptionsPage', mode: 'redirect', path: '/feed/subscriptions' },
  { key: 'shortsPage', mode: 'redirect', path: '/shorts' },
  { key: 'shortsShelf', mode: 'hide', className: 'ytb-hide-shorts-shelf' },
  { key: 'commentsSection', mode: 'hide', className: 'ytb-hide-comments' },
  { key: 'liveChat', mode: 'hide', className: 'ytb-hide-live-chat' },
  { key: 'relatedVideos', mode: 'hide', className: 'ytb-hide-related' },
  { key: 'promoSections', mode: 'hide', className: 'ytb-hide-promos' },
] as const satisfies readonly AreaDefinition[];

export type AreaKey = (typeof AREA_DEFINITIONS)[number]['key'];
export type AreaFlags = Record<AreaKey, boolean>;

export const REDIRECT_AREAS: ReadonlySet<AreaKey> = new Set(
  AREA_DEFINITIONS.filter((area) => area.mode === 'redirect').map((area) => area.key),
);
