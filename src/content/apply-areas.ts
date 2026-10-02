import { AREA_DEFINITIONS } from '../shared/areas';
import type { Store } from './store';

export function applyAreas(store: Store): void {
  const state = store.getSnapshot()?.state;
  const enabled = Boolean(state?.settings.enabled);
  for (const area of AREA_DEFINITIONS) {
    if (area.mode !== 'hide') continue;
    document.documentElement.classList.toggle(
      area.className,
      enabled && Boolean(state?.areas[area.key]),
    );
  }
}
