import { CONTEXT_REQUEST } from '../shared/constants';
import { normalizeState } from '../shared/normalize';
import { onRuntimeMessage } from '../shared/runtime';
import { loadState, onLocalStorageChanged } from '../shared/state';
import type { BlockerState } from '../shared/types';
import { applyAreas } from './apply-areas';
import { forEachShadowRoot } from './dom';
import { currentContext } from './entity';
import { createEvaluator } from './evaluate';
import { createFilterEngine } from './filter';
import { createMenuInjector } from './menu';
import { type ElementChange, onElementChanges } from './observer';
import { createOverlayFeedback } from './overlay';
import { createPlaybackGuard } from './playback';
import { store } from './store';

async function init(): Promise<void> {
  const guard = createPlaybackGuard();
  const overlay = createOverlayFeedback(guard);
  const evaluator = createEvaluator({ store, overlay });
  const filter = createFilterEngine({ store, evaluate: () => evaluator.schedule() });
  const menu = createMenuInjector({ store, filter, overlay });

  function applyState(next: BlockerState): void {
    store.setState(next);
    applyAreas(store);
    filter.rescan();
  }

  function handleChange({ added, changed }: ElementChange): void {
    const nodes = [...added, ...changed];
    for (const node of nodes) filter.schedule(node);
    for (const node of added) {
      forEachShadowRoot(node, (shadow) => {
        onElementChanges(shadow, handleChange);
      });
    }
    evaluator.onMutation(nodes);
  }

  onElementChanges(document.documentElement, handleChange);

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
