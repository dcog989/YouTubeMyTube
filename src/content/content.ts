import { CONTEXT_REQUEST } from '../shared/constants';
import { onLocalStorageChanged } from '../shared/ext';
import { loadState } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState } from '../shared/types';
import { applyAreas } from './areas';
import { currentContext } from './entity';
import { rescan, scheduleFilter } from './filter';
import { initMenuInjection } from './menu';
import { setState } from './store';

function applyState(next: BlockerState): void {
  setState(next);
  applyAreas();
  rescan();
}

function observe(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scheduleFilter(node as Element);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
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
