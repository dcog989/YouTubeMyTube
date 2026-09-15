import { BLOCKED_PAGE, YOUTUBE_HOME } from '../shared/constants';
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
import type { BlockerState, CompiledRules, Entity } from '../shared/types';

const ITEM_SELECTORS = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-playlist-renderer',
  'ytd-radio-renderer',
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-channel-renderer',
  'ytd-grid-channel-renderer',
  'ytd-compact-channel-renderer',
  'ytd-movie-renderer',
  'ytd-compact-movie-renderer',
  'yt-lockup-view-model',
  'ytm-video-with-context-renderer',
  'ytm-compact-video-renderer',
  'ytm-video-renderer',
  'ytm-reel-item-renderer',
  'ytm-channel-renderer',
  'ytm-compact-channel-renderer',
];

const COMMENT_SELECTORS = [
  'ytd-comment-thread-renderer',
  'ytd-comment-renderer',
  'ytm-comment-thread-renderer',
  'ytm-comment-renderer',
];

const TITLE_SELECTORS = [
  '#video-title',
  '#video-title-link',
  'a#video-title',
  '.yt-lockup-metadata-view-model__title',
  'h3 a',
];

const CHANNEL_TEXT_SELECTORS = ['ytd-channel-name a', '#channel-name a', 'ytm-channel-name a'];

const CARD_SELECTOR = ITEM_SELECTORS.join(',');
const COMMENT_SELECTOR = COMMENT_SELECTORS.join(',');
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
let scheduled = false;
const pending = new Set<Element>();

function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function firstText(element: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const found = element.querySelector(selector);
    const value = textOf(found);
    if (value) return value;
  }
  return '';
}

function titleOf(card: Element): string {
  const titled = card.querySelector('a[title]');
  const attr = titled?.getAttribute('title')?.trim();
  if (attr) return attr;
  const bySelector = firstText(card, TITLE_SELECTORS);
  if (bySelector) return bySelector;
  return textOf(card).slice(0, 300);
}

function cardEntity(card: Element): Entity {
  const entity: Entity = {};
  const anchors = card.querySelectorAll<HTMLAnchorElement>('a[href]');

  for (const anchor of anchors) {
    const parsed = parseYouTubeUrl(anchor.getAttribute('href') ?? '');
    if (parsed.videoId && !entity.videoId) entity.videoId = parsed.videoId;
    if (parsed.channelId && !entity.channelId) entity.channelId = parsed.channelId;
    if (parsed.handle && !entity.handle) entity.handle = parsed.handle;
  }

  entity.title = titleOf(card);
  const channelName = firstText(card, CHANNEL_TEXT_SELECTORS);
  if (channelName) entity.channelName = channelName;

  return entity;
}

function commentEntity(thread: Element): Entity {
  const authorAnchor = thread.querySelector<HTMLAnchorElement>(
    'a[href*="/channel/"], a[href^="/@"], a[href*="/@"]',
  );
  const parsed = authorAnchor
    ? parseYouTubeUrl(authorAnchor.getAttribute('href') ?? '')
    : undefined;

  const entity: Entity = {};
  if (parsed?.channelId) entity.channelId = parsed.channelId;
  if (parsed?.handle) entity.handle = parsed.handle;

  const authorText = textOf(thread.querySelector('#author-text')) || textOf(authorAnchor);
  if (authorText) entity.commentAuthor = authorText;

  const content =
    textOf(thread.querySelector('#content-text')) ||
    textOf(thread.querySelector('yt-attributed-string'));
  if (content) entity.commentContent = content;

  return entity;
}

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

async function init(): Promise<void> {
  applyState(await loadState());
  onLocalStorageChanged((value) => applyState(normalizeState(value)));
  observe();
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
