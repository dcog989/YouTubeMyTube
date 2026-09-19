import type { Entity, ParsedUrl } from '../shared/types';
import { normalizeHandle, parseYouTubeUrl } from '../shared/url';
import { forEachShadowRoot } from './dom';
import {
  CHANNEL_HEADER_SELECTORS,
  CHANNEL_LINK_SELECTORS,
  CHANNEL_PAGE_NAME_SELECTORS,
  CHANNEL_TEXT_SELECTORS,
  METADATA_SELECTOR,
  OWNER_SCOPES,
  SHADOW_ANCHOR_HOST_SELECTOR,
  TITLE_SELECTORS,
} from './entity-selectors';

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

const NON_CHANNEL_METADATA = /\bviews?\b|\bago\b|^[\d.,]+(?:\s*[KMB])?$/i;
const CHANNEL_AVATAR_LABEL = /^Go to channel\s+/i;

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

function applyParsed(entity: Entity, parsed: ParsedUrl): void {
  if (parsed.videoId && !entity.videoId) entity.videoId = parsed.videoId;
  if (parsed.channelId && !entity.channelId) entity.channelId = parsed.channelId;
  if (parsed.handle && !entity.handle) entity.handle = parsed.handle;
}

function applyAnchor(entity: Entity, anchor: HTMLAnchorElement): void {
  applyParsed(entity, parseYouTubeUrl(anchor.getAttribute('href') ?? ''));
}

function applyAnchors(entity: Entity, anchors: ArrayLike<HTMLAnchorElement>): void {
  for (const anchor of Array.from(anchors)) {
    applyAnchor(entity, anchor);
    if (hasIdentity(entity)) return;
  }
}

function hasIdentity(entity: Entity): boolean {
  return Boolean(entity.videoId) && Boolean(entity.channelId || entity.handle);
}

function applyShadowAnchors(entity: Entity, root: ParentNode): void {
  for (const host of root.querySelectorAll(SHADOW_ANCHOR_HOST_SELECTOR)) {
    const shadow = host.shadowRoot;
    if (!shadow) continue;
    shadow.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      applyAnchor(entity, anchor);
    });
    if (hasIdentity(entity)) return;
    applyShadowAnchors(entity, shadow);
    if (hasIdentity(entity)) return;
  }
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

  const entity: Entity = {};
  if (authorAnchor) applyParsed(entity, parseYouTubeUrl(authorAnchor.getAttribute('href') ?? ''));

  const authorText = textOf(thread.querySelector('#author-text')) || textOf(authorAnchor);
  if (authorText) entity.commentAuthor = authorText;

  const content =
    textOf(thread.querySelector('#content-text')) ||
    textOf(thread.querySelector('yt-attributed-string'));
  if (content) entity.commentContent = content;

  return entity;
}

function channelLinkIn(root: ParentNode): ParsedUrl | null {
  for (const selector of CHANNEL_LINK_SELECTORS) {
    for (const link of root.querySelectorAll(selector)) {
      const parsed = parseYouTubeUrl(link.getAttribute('href') ?? '');
      if (parsed.channelId || parsed.handle) return parsed;
    }
  }
  return null;
}

function ownerElementIn(scope: ParentNode): Element | null {
  for (const selector of OWNER_SCOPES) {
    const owner = scope.querySelector(selector);
    if (owner) return owner;
  }
  return null;
}

function videoScope(videoId: string): ParentNode | null {
  const watch = document.querySelector('ytd-watch-flexy');
  const attribute = watch?.getAttribute('video-id');
  if (!watch || !attribute) return document;
  return attribute === videoId ? watch : null;
}

function channelNameIn(scope: ParentNode): string {
  for (const selector of CHANNEL_PAGE_NAME_SELECTORS) {
    const name = textOf(scope.querySelector(selector));
    if (name) return name;
  }
  return '';
}

function channelHeaderMatches(scope: ParentNode, page: ParsedUrl): boolean {
  const id = page.channelId ?? '';
  const handle = page.handle ? normalizeHandle(page.handle) : '';
  for (const selector of CHANNEL_LINK_SELECTORS) {
    for (const link of scope.querySelectorAll(selector)) {
      const parsed = parseYouTubeUrl(link.getAttribute('href') ?? '');
      if (id && parsed.channelId === id) return true;
      if (handle && parsed.handle && normalizeHandle(parsed.handle) === handle) return true;
    }
  }
  return false;
}

function channelNameForPage(page: ParsedUrl): string {
  if (!page.channelId && !page.handle) return '';
  const headerSelector = CHANNEL_HEADER_SELECTORS.join(',');
  for (const selector of CHANNEL_PAGE_NAME_SELECTORS) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const header = element.closest(headerSelector);
    if (header && !channelHeaderMatches(header, page)) continue;
    const name = textOf(element);
    if (name) return name;
  }
  return '';
}

export function currentContext(): Entity {
  const entity: Entity = {};
  const page = parseYouTubeUrl(window.location.href);
  applyParsed(entity, page);

  if (entity.videoId) {
    const scope = videoScope(entity.videoId);
    if (!scope) return entity;
    const owner = ownerElementIn(scope);
    if (owner) {
      const link = channelLinkIn(owner);
      if (link) applyParsed(entity, link);
    }
    const name = channelNameIn(owner ?? scope);
    if (name) entity.channelName = name;
    return entity;
  }

  const name = channelNameForPage(page);
  if (name) entity.channelName = name;
  return entity;
}
