import type { AreaKey } from './types';

export interface AreaDefinition {
  key: AreaKey;
  title: string;
  sub: string;
  path: string | null;
  redirect: boolean;
}

export const AREA_DEFINITIONS: readonly AreaDefinition[] = [
  {
    key: 'homePage',
    title: 'Home page',
    sub: 'Redirect the YouTube home feed.',
    path: '/',
    redirect: false,
  },
  {
    key: 'trendingPage',
    title: 'Trending page',
    sub: 'Redirect /feed/trending.',
    path: '/feed/trending',
    redirect: true,
  },
  {
    key: 'explorePage',
    title: 'Explore page',
    sub: 'Redirect /feed/explore.',
    path: '/feed/explore',
    redirect: true,
  },
  {
    key: 'subscriptionsPage',
    title: 'Subscriptions page',
    sub: 'Redirect /feed/subscriptions.',
    path: '/feed/subscriptions',
    redirect: true,
  },
  {
    key: 'shortsPage',
    title: 'Shorts pages',
    sub: 'Redirect /shorts and direct Short links.',
    path: '/shorts',
    redirect: true,
  },
  {
    key: 'shortsShelf',
    title: 'Shorts shelves',
    sub: 'Hide Shorts carousels across the site.',
    path: null,
    redirect: false,
  },
  {
    key: 'commentsSection',
    title: 'Comments section',
    sub: 'Hide the comments area on watch pages.',
    path: null,
    redirect: false,
  },
  {
    key: 'liveChat',
    title: 'Live chat',
    sub: 'Hide the live chat frame.',
    path: null,
    redirect: false,
  },
  {
    key: 'relatedVideos',
    title: 'Related videos',
    sub: 'Hide the watch-page sidebar.',
    path: null,
    redirect: false,
  },
];

export const REDIRECT_AREAS: ReadonlySet<AreaKey> = new Set(
  AREA_DEFINITIONS.filter((area) => area.redirect).map((area) => area.key),
);
