import { AREA_DEFINITIONS } from '../shared/areas';
import { getSnapshot } from './store';

export function applyAreas(): void {
  const state = getSnapshot()?.state;
  const enabled = Boolean(state?.settings.enabled);
  for (const area of AREA_DEFINITIONS) {
    if (area.mode !== 'hide') continue;
    document.documentElement.classList.toggle(
      area.className,
      enabled && Boolean(state?.areas[area.key]),
    );
  }
}
