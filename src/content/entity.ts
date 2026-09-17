import { parseYouTubeUrl } from '../shared/matcher';
import type { Entity } from '../shared/types';
import { forEachShadowRoot } from './dom';

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

const OWNER_SCOPES = [
  '#owner',
  'ytd-watch-metadata #owner',
  'ytd-video-owner-renderer',
  '#upload-info',
  'ytm-slim-owner-renderer',
  'ytm-video-owner-renderer',
];

const CHANNEL_LINK_SELECTORS = [
  'ytd-channel-name a[href]',
  '#channel-name a[href]',
  '#avatar-link[href]',
  'a[href^="/@"]',
  'a[href^="/channel/"]',
  'link[itemprop="url"][href]',
  'link[href^="/@"]',
  'link[href^="/channel/"]',
  'a[href]',
  'link[href]',
];

const CHANNEL_PAGE_NAME_SELECTORS = [
  '#channel-name #text',
  '#channel-name yt-formatted-string',
  'ytd-channel-name #text',
  'ytd-channel-name yt-formatted-string',
  'yt-channel-name',
];

export const CARD_SELECTOR = ITEM_SELECTORS.join(',');
export const COMMENT_SELECTOR = COMMENT_SELECTORS.join(',');
export const HIDDEN_CLASS = 'ytb-hidden';

function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function firstText(element: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const found = element.querySelector(selector);
    const value = textOf(found);
    if (value) return value;
  }
  return '';
}

const METADATA_TEXT_SELECTORS = [
  '.yt-content-metadata-view-model__metadata-text',
  '.ytContentMetadataViewModelMetadataText',
  '.ytAttributedStringHost',
  '.yt-core-attributed-string',
];

const NON_CHANNEL_METADATA = /\bviews?\b|\bago\b|^[\d.,]+(?:\s*[KMB])?$/i;
const CHANNEL_AVATAR_LABEL = /^Go to channel\s+/i;

const METADATA_SELECTOR = METADATA_TEXT_SELECTORS.join(',');

function firstChannelText(candidates: ArrayLike<Element>): string {
  for (const candidate of Array.from(candidates)) {
    const value = textOf(candidate);
    if (value && !NON_CHANNEL_METADATA.test(value)) return value;
  }
  return '';
}

function metadataValue(root: ParentNode): string {
  const direct = root.querySelectorAll(METADATA_SELECTOR);
  if (direct.length > 0) return firstChannelText(direct);

  let found = '';
  forEachShadowRoot(root, (shadow) => {
    found = firstChannelText(shadow.querySelectorAll(METADATA_SELECTOR));
    return found === '';
  });
  return found;
}

function lockupChannelName(card: Element): string {
  const model = card.querySelector('yt-content-metadata-view-model');
  return model ? metadataValue(model) : '';
}

function channelAvatarLabel(card: Element): string {
  const avatar = card.querySelector('[aria-label^="Go to channel "]');
  const label = avatar?.getAttribute('aria-label') ?? '';
  return label.replace(CHANNEL_AVATAR_LABEL, '').trim();
}

function titleOf(card: Element): string {
  const titled = card.querySelector('a[title]');
  const attr = titled?.getAttribute('title')?.trim();
  if (attr) return attr;
  const bySelector = firstText(card, TITLE_SELECTORS);
  if (bySelector) return bySelector;
  return textOf(card).slice(0, 300);
}

function applyAnchor(entity: Entity, anchor: HTMLAnchorElement): void {
  const parsed = parseYouTubeUrl(anchor.getAttribute('href') ?? '');
  if (parsed.videoId && !entity.videoId) entity.videoId = parsed.videoId;
  if (parsed.channelId && !entity.channelId) entity.channelId = parsed.channelId;
  if (parsed.handle && !entity.handle) entity.handle = parsed.handle;
}

function applyAnchors(entity: Entity, anchors: ArrayLike<HTMLAnchorElement>): void {
  for (const anchor of Array.from(anchors)) applyAnchor(entity, anchor);
}

function hasIdentity(entity: Entity): boolean {
  return Boolean(entity.videoId) && Boolean(entity.channelId || entity.handle);
}

function applyShadowAnchors(entity: Entity, root: Element): void {
  forEachShadowRoot(root, (shadow) => {
    shadow.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      applyAnchor(entity, anchor);
    });
    return !hasIdentity(entity);
  });
}

export function cardEntity(card: Element): Entity {
  const entity: Entity = {};
  applyAnchors(entity, card.querySelectorAll<HTMLAnchorElement>('a[href]'));

  if (!hasIdentity(entity)) applyShadowAnchors(entity, card);

  entity.title = titleOf(card);
  const fallbackName = channelAvatarLabel(card) || lockupChannelName(card);
  const channelName = firstText(card, CHANNEL_TEXT_SELECTORS) || fallbackName;
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

function channelLinkIn(root: ParentNode): { channelId?: string; handle?: string } | null {
  for (const selector of CHANNEL_LINK_SELECTORS) {
    for (const link of root.querySelectorAll(selector)) {
      const parsed = parseYouTubeUrl(link.getAttribute('href') ?? '');
      if (parsed.channelId) return { channelId: parsed.channelId };
      if (parsed.handle) return { handle: parsed.handle };
    }
  }
  return null;
}

export function currentContext(): Entity {
  const entity: Entity = {};
  const page = parseYouTubeUrl(window.location.href);
  if (page.videoId) entity.videoId = page.videoId;
  if (page.channelId) entity.channelId = page.channelId;
  if (page.handle) entity.handle = page.handle;

  if (!entity.channelId && !entity.handle) {
    for (const scopeSelector of OWNER_SCOPES) {
      const scope = document.querySelector(scopeSelector);
      if (!scope) continue;
      const link = channelLinkIn(scope);
      if (!link) continue;
      if (link.channelId) entity.channelId = link.channelId;
      if (link.handle) entity.handle = link.handle;
      break;
    }
  }

  if (!entity.channelId && !entity.handle) {
    for (const selector of ['ytd-watch-metadata', 'ytd-video-primary-info-renderer']) {
      const scope = document.querySelector(selector);
      if (!scope) continue;
      const link = channelLinkIn(scope);
      if (!link) continue;
      if (link.channelId) entity.channelId = link.channelId;
      if (link.handle) entity.handle = link.handle;
      break;
    }
  }

  if (!entity.channelName) {
    for (const selector of CHANNEL_PAGE_NAME_SELECTORS) {
      const name = textOf(document.querySelector(selector));
      if (name) {
        entity.channelName = name;
        break;
      }
    }
  }

  return entity;
}
