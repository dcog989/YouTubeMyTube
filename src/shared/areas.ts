export const AREA_DEFINITIONS = [
  {
    key: 'homePage',
    title: 'Home page',
    sub: 'Hide the YouTube home feed.',
    path: '/',
    redirect: false,
    className: 'ytb-hide-home',
  },
  {
    key: 'trendingPage',
    title: 'Trending page',
    sub: 'Redirect /feed/trending.',
    path: '/feed/trending',
    redirect: true,
    className: null,
  },
  {
    key: 'explorePage',
    title: 'Explore page',
    sub: 'Redirect /feed/explore.',
    path: '/feed/explore',
    redirect: true,
    className: null,
  },
  {
    key: 'subscriptionsPage',
    title: 'Subscriptions page',
    sub: 'Redirect /feed/subscriptions.',
    path: '/feed/subscriptions',
    redirect: true,
    className: null,
  },
  {
    key: 'shortsPage',
    title: 'Shorts pages',
    sub: 'Redirect /shorts and direct Short links.',
    path: '/shorts',
    redirect: true,
    className: null,
  },
  {
    key: 'shortsShelf',
    title: 'Shorts shelves',
    sub: 'Hide Shorts carousels across the site.',
    path: null,
    redirect: false,
    className: 'ytb-hide-shorts-shelf',
  },
  {
    key: 'commentsSection',
    title: 'Comments section',
    sub: 'Hide the comments area on watch pages.',
    path: null,
    redirect: false,
    className: 'ytb-hide-comments',
  },
  {
    key: 'liveChat',
    title: 'Live chat',
    sub: 'Hide the live chat frame.',
    path: null,
    redirect: false,
    className: 'ytb-hide-live-chat',
  },
  {
    key: 'relatedVideos',
    title: 'Related videos',
    sub: 'Hide the watch-page sidebar.',
    path: null,
    redirect: false,
    className: 'ytb-hide-related',
  },
  {
    key: 'promoSections',
    title: 'Promo banners',
    sub: 'Hide promotional banners such as channel memberships and Premium.',
    path: null,
    redirect: false,
    className: 'ytb-hide-promos',
  },
] as const;

export type AreaKey = (typeof AREA_DEFINITIONS)[number]['key'];
export type AreaDefinition = (typeof AREA_DEFINITIONS)[number];
export type AreaFlags = Record<AreaKey, boolean>;

export const REDIRECT_AREAS: ReadonlySet<AreaKey> = new Set(
  AREA_DEFINITIONS.filter((area) => area.redirect).map((area) => area.key),
);
