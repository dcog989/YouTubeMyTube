import { CONTEXT_REQUEST } from '../shared/constants';
import { onLocalStorageChanged } from '../shared/ext';
import { loadState } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState } from '../shared/types';
import { applyAreas } from './areas';
import { currentContext } from './entity';
import { rescan, scheduleFilter } from './filter';
import { initMenuInjection } from './menu';
import { onAddedElements } from './observer';
import { setState } from './store';

function applyState(next: BlockerState): void {
  setState(next);
  applyAreas();
  rescan();
}

function observe(): void {
  onAddedElements(document.documentElement, (nodes) => {
    for (const node of nodes) scheduleFilter(node);
  });
}

function listenForContextRequests(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;
    if ((message as { type?: unknown }).type !== CONTEXT_REQUEST) return;
    sendResponse(currentContext());
  });
}

async function init(): Promise<void> {
  applyState(await loadState());
  onLocalStorageChanged((value) => applyState(normalizeState(value)));
  observe();
  listenForContextRequests();
  initMenuInjection();
  window.addEventListener('yt-navigate-finish', () => {
    rescan();
  });
  window.addEventListener('popstate', () => {
    rescan();
  });
}

void init();
