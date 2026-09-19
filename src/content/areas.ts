import { AREA_DEFINITIONS } from '../shared/areas';
import { getState } from './store';

export function applyAreas(): void {
  const state = getState();
  const enabled = Boolean(state?.settings.enabled);
  for (const { key, className } of AREA_DEFINITIONS) {
    if (!className) continue;
    document.documentElement.classList.toggle(className, enabled && Boolean(state?.areas[key]));
  }
}
