import { BLOCKED_PAGE, CONTEXT_REQUEST, YOUTUBE_HOME } from '../shared/constants';
import { getRuntimeUrl, onLocalStorageChanged } from '../shared/ext';
import {
  compileRules,
  hasCommentRules,
  matchDirectNavigation,
  matchEntity,
  parseYouTubeUrl,
} from '../shared/matcher';
import { loadState } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState, CompiledRules } from '../shared/types';
import {
  CARD_SELECTOR,
  COMMENT_SELECTOR,
  cardEntity,
  commentEntity,
  currentContext,
} from './entity';
import { initMenuInjection } from './menu';

const HIDDEN_CLASS = 'ytb-hidden';

const AREA_CLASSES: ReadonlyArray<readonly [string, keyof BlockerState['areas']]> = [
  ['ytb-hide-home', 'homePage'],
  ['ytb-hide-shorts-shelf', 'shortsShelf'],
  ['ytb-hide-comments', 'commentsSection'],
  ['ytb-hide-live-chat', 'liveChat'],
  ['ytb-hide-related', 'relatedVideos'],
];

let state: BlockerState | null = null;
let compiled: CompiledRules | null = null;
let processed = new WeakSet<Element>();
let lastHref = '';
let checkedVideoId = '';
let scheduled = false;
const pending = new Set<Element>();

function hide(element: Element): void {
  element.classList.add(HIDDEN_CLASS);
}

function clearHidden(): void {
  document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((element) => {
    element.classList.remove(HIDDEN_CLASS);
  });
}

function processNode(node: Element): void {
  if (!state || !compiled || !state.settings.enabled) return;
  if (processed.has(node)) return;

  if (node.matches(CARD_SELECTOR)) {
    processed.add(node);
    const result = matchEntity(cardEntity(node), compiled);
    if (result.blocked) hide(node);
  }

  if (hasCommentRules(compiled) && node.matches(COMMENT_SELECTOR)) {
    processed.add(node);
    const result = matchEntity(commentEntity(node), compiled);
    if (result.blocked) hide(node);
  }
}

function processSubtree(root: Element): void {
  processNode(root);
  root.querySelectorAll(CARD_SELECTOR).forEach(processNode);
  if (compiled && hasCommentRules(compiled)) {
    root.querySelectorAll(COMMENT_SELECTOR).forEach(processNode);
  }
}

function flushPending(): void {
  scheduled = false;
  const nodes = Array.from(pending);
  pending.clear();
  for (const node of nodes) processSubtree(node);
  checkWatchChannel();
}

function schedule(root: Element): void {
  pending.add(root);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flushPending);
}

function rescan(): void {
  clearHidden();
  processed = new WeakSet<Element>();
  if (!state?.settings.enabled) return;
  document.querySelectorAll(CARD_SELECTOR).forEach(processNode);
  if (compiled && hasCommentRules(compiled)) {
    document.querySelectorAll(COMMENT_SELECTOR).forEach(processNode);
  }
  checkWatchChannel();
}

function applyAreas(): void {
  const enabled = Boolean(state?.settings.enabled);
  for (const [className, key] of AREA_CLASSES) {
    document.documentElement.classList.toggle(className, enabled && Boolean(state?.areas[key]));
  }
}

function applyState(next: BlockerState): void {
  state = next;
  compiled = compileRules(next.rules);
  checkedVideoId = '';
  applyAreas();
  rescan();
}

function redirectFor(reason: string): void {
  if (reason.startsWith('area ')) {
    window.location.replace(YOUTUBE_HOME);
    return;
  }
  const url = new URL(getRuntimeUrl(BLOCKED_PAGE));
  url.searchParams.set('reason', reason);
  window.location.replace(url.toString());
}

function checkNavigation(): void {
  if (!state || !compiled || !state.settings.enabled) return;
  if (window.top !== window) return;
  const href = window.location.href;
  if (href === lastHref) return;
  lastHref = href;
  const parsed = parseYouTubeUrl(href);
  const result = matchDirectNavigation(parsed, window.location.pathname, compiled, state.areas);
  if (result.blocked && result.reason) redirectFor(result.reason);
}

function checkWatchChannel(): void {
  if (!state || !compiled || !state.settings.enabled) return;
  if (window.top !== window) return;
  if (window.location.pathname !== '/watch') return;

  const context = currentContext();
  if (!context.videoId || context.videoId === checkedVideoId) return;
  if (!context.channelId && !context.handle && !context.channelName) return;
  checkedVideoId = context.videoId;

  const result = matchEntity(context, compiled);
  if (result.blocked && result.reason) redirectFor(result.reason);
}

function observe(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) schedule(node as Element);
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
  checkNavigation();
  window.addEventListener('yt-navigate-finish', () => {
    checkNavigation();
    rescan();
  });
  window.addEventListener('popstate', () => {
    checkNavigation();
    rescan();
  });
}

void init();
