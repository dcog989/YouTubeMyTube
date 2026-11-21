import type { Entity, ParsedUrl } from '../shared/types';
import { normalizeHandle, parseYouTubeUrl } from '../shared/url';
import { closestAcrossShadow, forEachShadowRoot, shadowRootsWithin } from './dom';
import {
  ACTIVE_REEL_SELECTOR,
  CHANNEL_HEADER_SELECTORS,
  CHANNEL_LINK_SELECTORS,
  CHANNEL_PAGE_NAME_SELECTORS,
  METADATA_SELECTOR,
  OWNER_SCOPE_SELECTOR,
  OWNER_SCOPES,
  PAGE_TITLE_SCOPE_SELECTOR,
  PAGE_TITLE_SELECTORS,
  TITLE_SELECTORS,
} from './entity-selectors';

function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function firstText(element: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const value = textOf(element.querySelector(selector));
    if (value) return value;
  }
  return '';
}

const NON_CHANNEL_METADATA = /\bviews?\b|\bago\b|^[\d.,]+(?:\s*[KMB])?$/i;
const CHANNEL_HREF = /\/(?:channel\/|@)/;

// Identity of what a node or page currently shows; callers skip re-evaluating
// when it is unchanged.
export function entityKey(entity: Entity): string {
  return [
    entity.videoId,
    entity.channelId,
    entity.handle,
    entity.channelName,
    entity.title,
    entity.commentAuthor,
    entity.commentContent,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\u0000');
}

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

function titleOf(card: Element, roots: () => ShadowRoot[]): string {
  const titled = card.querySelector('a[title]');
  const attr = titled?.getAttribute('title')?.trim();
  if (attr) return attr;
  for (const selector of TITLE_SELECTORS) {
    const value = textOf(card.querySelector(selector));
    if (value) return value;
  }
  for (const selector of TITLE_SELECTORS) {
    for (const root of roots()) {
      const value = textOf(root.querySelector(selector));
      if (value) return value;
    }
  }
  return '';
}

function applyParsed(entity: Entity, parsed: ParsedUrl): void {
  if (parsed.videoId && !entity.videoId) entity.videoId = parsed.videoId;
  if (parsed.channelId && !entity.channelId) entity.channelId = parsed.channelId;
  if (parsed.handle && !entity.handle) entity.handle = parsed.handle;
}

// The watch page carries the video and channel as schema.org microdata, which
// the parser reaches before the player DOM exists. The identifier keeps SPA
// navigation's stale data from being trusted.
function applyPageMetadata(entity: Entity): void {
  const identifier = document.querySelector('meta[itemprop="identifier"]')?.getAttribute('content');
  if (!entity.videoId || identifier?.trim() !== entity.videoId) return;

  const author = document.querySelector('span[itemprop="author"]');
  const href = author?.querySelector('link[itemprop="url"]')?.getAttribute('href');
  if (href) applyParsed(entity, parseYouTubeUrl(href));
  const name = author
    ?.querySelector('link[itemprop="name"], meta[itemprop="name"]')
    ?.getAttribute('content')
    ?.trim();
  if (name && !entity.channelName) entity.channelName = name;

  // The first schema.org name is the video title; unlike document.title it does
  // not briefly turn into the site name during YouTube's re-render.
  const title = document.querySelector('meta[itemprop="name"]')?.getAttribute('content')?.trim();
  if (title && !entity.title) entity.title = title;
}

function applyAnchor(entity: Entity, anchor: HTMLAnchorElement): void {
  const href = anchor.getAttribute('href') ?? '';
  if (href.includes('/shorts/')) entity.isShorts = true;
  if (entity.videoId && !CHANNEL_HREF.test(href)) return;
  const parsed = parseYouTubeUrl(href);
  applyParsed(entity, parsed);
  // The channel anchor's own text is the display name in every UI language.
  if (!entity.channelName && (parsed.channelId || parsed.handle)) {
    const name = textOf(anchor);
    if (name) entity.channelName = name;
  }
}

function hasChannelIdentity(entity: Entity): boolean {
  return Boolean(entity.channelId || entity.handle);
}

function applyAnchors(entity: Entity, anchors: ArrayLike<HTMLAnchorElement>): void {
  for (const anchor of Array.from(anchors)) {
    applyAnchor(entity, anchor);
    if (hasChannelIdentity(entity)) return;
  }
}

function applyShadowAnchors(entity: Entity, roots: ShadowRoot[]): void {
  for (const root of roots) {
    root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      applyAnchor(entity, anchor);
    });
    if (hasChannelIdentity(entity)) return;
  }
}

export function cardEntity(card: Element): Entity {
  const entity: Entity = {};
  let roots: ShadowRoot[] | undefined;
  const cardRoots = (): ShadowRoot[] => (roots ??= shadowRootsWithin(card));

  applyAnchors(entity, card.querySelectorAll<HTMLAnchorElement>('a[href]'));

  if (!hasChannelIdentity(entity)) applyShadowAnchors(entity, cardRoots());

  entity.title = titleOf(card, cardRoots);
  const channelName = entity.channelName || lockupChannelName(card);
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

function videoScope(videoId: string, kind: ParsedUrl['kind']): ParentNode | null {
  if (kind === 'shorts') return document.querySelector(ACTIVE_REEL_SELECTOR);
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

export function isInOwnerScope(node: Element): boolean {
  return Boolean(closestAcrossShadow(node, OWNER_SCOPE_SELECTOR));
}

export function isInPageTitleScope(node: Element): boolean {
  return Boolean(closestAcrossShadow(node, PAGE_TITLE_SCOPE_SELECTOR));
}

export function currentContext(): Entity {
  const entity: Entity = {};
  const page = parseYouTubeUrl(window.location.href);
  applyParsed(entity, page);

  if (entity.videoId) {
    applyPageMetadata(entity);
    const scope = videoScope(entity.videoId, page.kind);
    if (!scope) return entity;
    const owner = ownerElementIn(scope) ?? scope;
    const link = channelLinkIn(owner);
    if (link) applyParsed(entity, link);
    const name = channelNameIn(owner);
    if (name) entity.channelName = name;
    const title = firstText(document, PAGE_TITLE_SELECTORS);
    if (title) entity.title = title;
    return entity;
  }

  const name = channelNameForPage(page);
  if (name) entity.channelName = name;
  return entity;
}
