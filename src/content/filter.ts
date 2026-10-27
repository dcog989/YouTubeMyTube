import { matchEntity } from '../shared/match';
import { scansComments } from '../shared/rules';
import type { BlockerState, CompiledRules, Entity } from '../shared/types';
import { createBatcher } from './batch';
import { closestAcrossShadow } from './dom';
import { cardEntity, commentEntity } from './entity';
import {
  CARD_SELECTOR,
  COMMENT_SELECTOR,
  HIDDEN_CLASS,
  NESTED_CARD_SELECTOR,
  REEL_SELECTOR,
} from './entity-selectors';
import type { ChannelCache } from './menu/channel-cache';
import type { Store } from './store';

export interface FilterEngine {
  hide(element: Element): void;
  show(element: Element): void;
  schedule(root: Element): void;
  rescan(): void;
}

// Shorts lockups carry no channel link, name or ID; the channel has to come
// from the video itself (oEmbed).
const SHORTS_LINK_SELECTOR = 'a[href*="/shorts/"]';

// Reels are the Shorts pager's scroll items. Hiding one collapses its snap
// point and stalls paging, so the evaluator blanks the active reel instead.
function isReel(element: Element): boolean {
  return element.matches(REEL_SELECTOR);
}

function hasChannelRules(rules: CompiledRules): boolean {
  return (
    rules.channelIds.size > 0 ||
    rules.handles.size > 0 ||
    rules.channelNames.size > 0 ||
    rules.channelFilters.length > 0
  );
}

export function createFilterEngine(deps: {
  store: Store;
  evaluate(): void;
  channelCache: ChannelCache;
}): FilterEngine {
  let seen = new WeakMap<Element, string>();
  const { channelCache } = deps;

  function setHidden(element: Element, hidden: boolean): void {
    element.classList.toggle(HIDDEN_CLASS, hidden);
  }

  function hide(element: Element): void {
    if (isReel(element)) return;
    setHidden(element, true);
  }

  function show(element: Element): void {
    setHidden(element, false);
  }

  function clearHidden(): void {
    document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((element) => {
      element.classList.remove(HIDDEN_CLASS);
    });
  }

  function entityKey(entity: Entity): string {
    const parts = [
      entity.videoId,
      entity.channelId,
      entity.handle,
      entity.channelName,
      entity.title,
      entity.commentAuthor,
      entity.commentContent,
    ].filter((part): part is string => Boolean(part));
    return parts.join('\u0000');
  }

  function outermostCard(node: Element): Element {
    if (!node.matches(NESTED_CARD_SELECTOR)) return node;
    const parent = node.parentElement;
    return parent ? (closestAcrossShadow(parent, CARD_SELECTOR) ?? node) : node;
  }

  function withCachedChannel(entity: Entity): Entity {
    if (!entity.videoId || entity.channelId || entity.handle) return entity;
    const meta = channelCache.get(entity.videoId);
    if (!meta) return entity;
    if (meta.id) entity.channelId = meta.id;
    if (meta.handle) entity.handle = meta.handle;
    if (meta.name) entity.channelName = meta.name;
    return entity;
  }

  function requestChannel(card: Element, entity: Entity, compiled: CompiledRules): void {
    if (!entity.videoId || entity.channelId || entity.handle) return;
    if (!hasChannelRules(compiled) || !card.querySelector(SHORTS_LINK_SELECTOR)) return;
    const pending = channelCache.request(entity.videoId);
    if (!pending) return;
    void pending.then(() => {
      const snapshot = deps.store.getSnapshot();
      if (snapshot && card.isConnected) processNode(card, snapshot.state, snapshot.compiled);
    });
  }

  function processNode(node: Element, state: BlockerState, compiled: CompiledRules): void {
    if (!state.settings.enabled) return;

    if (node.matches(CARD_SELECTOR)) {
      const card = outermostCard(node);
      // The active reel hosts the player; the evaluator blanks it with the cover.
      if (isReel(card)) return;
      const entity = withCachedChannel(cardEntity(card));
      const key = entityKey(entity);
      if (key && seen.get(card) === key) return;
      if (key) seen.set(card, key);
      const blocked = matchEntity(entity, compiled).blocked;
      setHidden(card, blocked);
      if (!blocked) requestChannel(card, entity, compiled);
      return;
    }

    if (scansComments(compiled) && node.matches(COMMENT_SELECTOR)) {
      const entity = commentEntity(node);
      const key = entityKey(entity);
      if (key && seen.get(node) === key) return;
      if (key) seen.set(node, key);
      setHidden(node, matchEntity(entity, compiled).blocked);
    }
  }

  function processSubtree(root: Element, state: BlockerState, compiled: CompiledRules): void {
    const card = closestAcrossShadow(root, CARD_SELECTOR);
    if (card) processNode(card, state, compiled);
    const comment = closestAcrossShadow(root, COMMENT_SELECTOR);
    if (comment) processNode(comment, state, compiled);

    root.querySelectorAll(CARD_SELECTOR).forEach((node) => {
      processNode(node, state, compiled);
    });
    if (scansComments(compiled)) {
      root.querySelectorAll(COMMENT_SELECTOR).forEach((node) => {
        processNode(node, state, compiled);
      });
    }
  }

  function hasAncestorIn(node: Element, roots: Set<Element>): boolean {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (roots.has(parent)) return true;
    }
    return false;
  }

  const batcher = createBatcher<Element>((nodes) => {
    const roots = new Set(nodes);
    const snapshot = deps.store.getSnapshot();
    if (!snapshot) return;
    for (const node of nodes) {
      if (hasAncestorIn(node, roots)) continue;
      processSubtree(node, snapshot.state, snapshot.compiled);
    }
  });

  function rescan(): void {
    clearHidden();
    seen = new WeakMap<Element, string>();
    const snapshot = deps.store.getSnapshot();
    if (snapshot?.state.settings.enabled) {
      const { state, compiled } = snapshot;
      document.querySelectorAll(CARD_SELECTOR).forEach((node) => {
        processNode(node, state, compiled);
      });
      if (scansComments(compiled)) {
        document.querySelectorAll(COMMENT_SELECTOR).forEach((node) => {
          processNode(node, state, compiled);
        });
      }
    }
    deps.evaluate();
  }

  return { hide, show, schedule: (root) => batcher.add(root), rescan };
}
