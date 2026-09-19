import type { AreaKey } from '../shared/areas';

export interface AreaCopy {
  title: string;
  sub: string;
}

export const AREA_COPY: Record<AreaKey, AreaCopy> = {
  homePage: { title: 'Home page', sub: 'Hide the YouTube home feed.' },
  trendingPage: { title: 'Trending page', sub: 'Redirect /feed/trending.' },
  explorePage: { title: 'Explore page', sub: 'Redirect /feed/explore.' },
  subscriptionsPage: { title: 'Subscriptions page', sub: 'Redirect /feed/subscriptions.' },
  shortsPage: { title: 'Shorts pages', sub: 'Redirect /shorts and direct Short links.' },
  shortsShelf: { title: 'Shorts shelves', sub: 'Hide Shorts carousels across the site.' },
  commentsSection: { title: 'Comments section', sub: 'Hide the comments area on watch pages.' },
  liveChat: { title: 'Live chat', sub: 'Hide the live chat frame.' },
  relatedVideos: { title: 'Related videos', sub: 'Hide the watch-page sidebar.' },
  promoSections: {
    title: 'Promo banners',
    sub: 'Hide promotional banners such as channel memberships and Premium.',
  },
};
