import { CONTEXT_REQUEST } from '../shared/constants';
import { onRuntimeMessage } from '../shared/runtime';
import { loadState, onLocalStorageChanged } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState } from '../shared/types';
import { applyAreas } from './areas';
import { currentContext } from './entity';
import { createEvaluator } from './evaluate';
import { createFilterEngine } from './filter';
import { createMenuInjector } from './menu';
import { onAddedElements } from './observer';
import { createOverlayFeedback } from './overlay';
import { createPlaybackGuard } from './playback';
import { getSnapshot, setState } from './store';

async function init(): Promise<void> {
  const guard = createPlaybackGuard();
  const overlay = createOverlayFeedback(guard);
  const evaluator = createEvaluator({ getSnapshot, overlay });
  const filter = createFilterEngine({ getSnapshot, evaluate: () => evaluator.schedule() });
  const menu = createMenuInjector({ filter, overlay });

  function applyState(next: BlockerState): void {
    setState(next);
    applyAreas();
    filter.rescan();
  }

  onAddedElements(document.documentElement, (nodes) => {
    for (const node of nodes) filter.schedule(node);
  });

  onRuntimeMessage((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;
    if ((message as { type?: unknown }).type !== CONTEXT_REQUEST) return;
    sendResponse(currentContext());
  });

  applyState(await loadState());
  onLocalStorageChanged((value) => applyState(normalizeState(value)));
  menu.init();
  window.addEventListener('yt-navigate-finish', () => filter.rescan());
  window.addEventListener('popstate', () => filter.rescan());
}

void init();
