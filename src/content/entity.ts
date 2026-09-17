import { parseYouTubeUrl } from '../shared/matcher';
import type { Entity } from '../shared/types';

export const ITEM_SELECTORS = [
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

export const COMMENT_SELECTORS = [
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

const OWNER_SELECTORS = [
  '#owner ytd-channel-name a',
  'ytd-video-owner-renderer a[href]',
  '#owner a[href]',
  'ytm-slim-owner-renderer a[href]',
  'ytm-video-owner-renderer a[href]',
];

export const CARD_SELECTOR = ITEM_SELECTORS.join(',');
export const COMMENT_SELECTOR = COMMENT_SELECTORS.join(',');

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

export function cardEntity(card: Element): Entity {
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

export function commentEntity(thread: Element): Entity {
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

export function currentContext(): Entity {
  const entity: Entity = {};
  const page = parseYouTubeUrl(window.location.href);
  if (page.videoId) entity.videoId = page.videoId;
  if (page.channelId) entity.channelId = page.channelId;
  if (page.handle) entity.handle = page.handle;

  if (!entity.channelId && !entity.handle) {
    for (const selector of OWNER_SELECTORS) {
      const anchor = document.querySelector<HTMLAnchorElement>(selector);
      if (!anchor) continue;
      const parsed = parseYouTubeUrl(anchor.getAttribute('href') ?? '');
      if (parsed.channelId) entity.channelId = parsed.channelId;
      if (parsed.handle) entity.handle = parsed.handle;
      const name = textOf(anchor);
      if (name) entity.channelName = name;
      if (entity.channelId || entity.handle || entity.channelName) break;
    }
  }

  return entity;
}
