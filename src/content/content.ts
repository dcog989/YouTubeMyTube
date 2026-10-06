import { CONTEXT_REQUEST } from '../shared/constants';
import { normalizeState } from '../shared/normalize';
import { onRuntimeMessage } from '../shared/runtime';
import { loadState, onLocalStorageChanged, readState } from '../shared/state';
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

  let changeCount = 0;

  function applyState(next: BlockerState): void {
    store.setState(next);
    applyAreas(store);
    filter.rescan();
  }

  // Re-read state from storage so a transiently empty startup read cannot leave
  // the tab filtering with defaults for its whole (SPA) lifetime. A failed read
  // keeps the current snapshot, and a storage change that lands mid-read wins.
  async function refresh(): Promise<void> {
    const start = changeCount;
    let next: BlockerState | undefined;
    try {
      next = await readState();
    } catch {
      return;
    }
    if (!next || changeCount !== start) return;
    applyState(next);
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

  onLocalStorageChanged((value) => {
    changeCount += 1;
    applyState(normalizeState(value));
  });

  const start = changeCount;
  const initial = await loadState();
  if (changeCount === start) applyState(initial);

  menu.init();
  window.addEventListener('yt-navigate-finish', () => {
    void refresh();
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });
  window.addEventListener('popstate', () => filter.rescan());
}

void init();
