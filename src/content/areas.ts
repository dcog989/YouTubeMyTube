import type { BlockerState } from '../shared/types';
import { getState } from './store';

const AREA_CLASSES: ReadonlyArray<readonly [string, keyof BlockerState['areas']]> = [
  ['ytb-hide-home', 'homePage'],
  ['ytb-hide-shorts-shelf', 'shortsShelf'],
  ['ytb-hide-comments', 'commentsSection'],
  ['ytb-hide-live-chat', 'liveChat'],
  ['ytb-hide-related', 'relatedVideos'],
  ['ytb-hide-promos', 'promoSections'],
];

export function applyAreas(): void {
  const state = getState();
  const enabled = Boolean(state?.settings.enabled);
  for (const [className, key] of AREA_CLASSES) {
    document.documentElement.classList.toggle(className, enabled && Boolean(state?.areas[key]));
  }
}
