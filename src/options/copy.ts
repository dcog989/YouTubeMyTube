import type { AreaKey } from '../shared/areas';
import { t } from '../shared/i18n';

export interface AreaCopy {
  title: string;
  sub: string;
}

function areaCopy(title: string, sub: string): AreaCopy {
  return { title: t(title), sub: t(sub) };
}

export const AREA_COPY: Record<AreaKey, AreaCopy> = {
  homePage: areaCopy('areaHomePageTitle', 'areaHomePageSub'),
  trendingPage: areaCopy('areaTrendingPageTitle', 'areaTrendingPageSub'),
  explorePage: areaCopy('areaExplorePageTitle', 'areaExplorePageSub'),
  subscriptionsPage: areaCopy('areaSubscriptionsPageTitle', 'areaSubscriptionsPageSub'),
  shortsPage: areaCopy('areaShortsPageTitle', 'areaShortsPageSub'),
  shortsShelf: areaCopy('areaShortsShelfTitle', 'areaShortsShelfSub'),
  commentsSection: areaCopy('areaCommentsSectionTitle', 'areaCommentsSectionSub'),
  liveChat: areaCopy('areaLiveChatTitle', 'areaLiveChatSub'),
  relatedVideos: areaCopy('areaRelatedVideosTitle', 'areaRelatedVideosSub'),
  promoSections: areaCopy('areaPromoSectionsTitle', 'areaPromoSectionsSub'),
};
