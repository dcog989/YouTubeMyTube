import type { BlockerState } from './types';

type Theme = BlockerState['settings']['theme'];

export function applyTheme(preference: Theme): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
}
