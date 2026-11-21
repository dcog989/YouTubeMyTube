import { CONTEXT_REQUEST } from '../shared/constants';
import { normalizeState } from '../shared/normalize';
import { onRuntimeMessage } from '../shared/runtime';
import { loadState, onLocalStorageChanged, readState } from '../shared/state';
import type { BlockerState } from '../shared/types';
import { parseYouTubeUrl } from '../shared/url';
import { applyAreas } from './apply-areas';
import { forEachShadowRoot, hasAncestorIn } from './dom';
import { currentContext } from './entity';
import { createEvaluator, PENDING_KINDS } from './evaluate';
import { createFilterEngine } from './filter';
import { createMenuInjector } from './menu';
import { createChannelCache } from './menu/channel-cache';
import { type ElementChange, onElementChanges } from './observer';
import { createOverlayFeedback, VIDEO_BLANK_CLASS } from './overlay';
import { createPlaybackGuard } from './playback';
import { applyDecision, store } from './store';

// Delay re-reads after startup so a slow storage backend that returned an empty
// read at init self-corrects without needing a navigation or a storage write.
const SETTLE_REFRESH_MS = [3000, 10000];

async function init(): Promise<void> {
  // Hide the player before storage responds; the evaluator releases it once a
  // final decision is possible, so a blocked video never reaches the screen.
  // Music has no player microdata to decide from, so it would stay hidden.
  const onMusic = window.location.hostname === 'music.youtube.com';
  if (!onMusic && PENDING_KINDS.has(parseYouTubeUrl(window.location.href).kind)) {
    document.documentElement.classList.add(VIDEO_BLANK_CLASS);
  }

  const guard = createPlaybackGuard();
  const overlay = createOverlayFeedback(guard, (state) => applyState(state));
  const channelCache = createChannelCache();
  const evaluator = createEvaluator({ store, overlay });
  const filter = createFilterEngine({ store, channelCache, evaluate: () => evaluator.schedule() });
  const menu = createMenuInjector({ store, filter, overlay, channelCache });

  let changeCount = 0;

  function applyState(next: BlockerState): void {
    const previous = store.getSnapshot();
    const decision = applyDecision(previous?.state ?? null, next);
    if (previous && !decision.rescans) return;
    store.setState(next, previous && decision.rulesEqual ? previous.compiled : undefined);
    applyAreas(store);
    if (decision.refilter) filter.rescan();
    else evaluator.schedule();
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
    const roots = new Set(added);
    for (const node of added) {
      if (hasAncestorIn(node, roots)) continue;
      forEachShadowRoot(node, (shadow) => {
        onElementChanges(shadow, handleChange);
      });
    }
    evaluator.onMutation(nodes);
  }

  onElementChanges(document.documentElement, handleChange);

  onRuntimeMessage((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
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
  for (const delay of SETTLE_REFRESH_MS) window.setTimeout(() => void refresh(), delay);
  window.addEventListener('load', () => {
    void refresh();
  });
  window.addEventListener('yt-navigate-finish', () => {
    void refresh();
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });
  window.addEventListener('popstate', () => filter.rescan());
}

void init();
