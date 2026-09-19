import { matchEntity } from '../shared/match';
import { hasCommentRules } from '../shared/rules';
import type { BlockerState, CompiledRules, Entity } from '../shared/types';
import { createBatcher } from './batch';
import { cardEntity, commentEntity } from './entity';
import { CARD_SELECTOR, COMMENT_SELECTOR, HIDDEN_CLASS } from './entity-selectors';

export interface FilterEngine {
  hide(element: Element): void;
  show(element: Element): void;
  schedule(root: Element): void;
  rescan(): void;
}

export function createFilterEngine(deps: {
  getSnapshot(): { state: BlockerState; compiled: CompiledRules } | null;
  evaluate(): void;
}): FilterEngine {
  let seen = new WeakMap<Element, string>();

  function setHidden(element: Element, hidden: boolean): void {
    element.classList.toggle(HIDDEN_CLASS, hidden);
  }

  function hide(element: Element): void {
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

  function processNode(node: Element, state: BlockerState, compiled: CompiledRules): void {
    if (!state.settings.enabled) return;

    if (node.matches(CARD_SELECTOR)) {
      const entity = cardEntity(node);
      const key = entityKey(entity);
      if (key && seen.get(node) === key) return;
      if (key) seen.set(node, key);
      setHidden(node, matchEntity(entity, compiled).blocked);
      return;
    }

    if (hasCommentRules(compiled) && node.matches(COMMENT_SELECTOR)) {
      const entity = commentEntity(node);
      const key = entityKey(entity);
      if (key && seen.get(node) === key) return;
      if (key) seen.set(node, key);
      setHidden(node, matchEntity(entity, compiled).blocked);
    }
  }

  function processSubtree(root: Element, state: BlockerState, compiled: CompiledRules): void {
    const card = root.closest(CARD_SELECTOR);
    if (card) processNode(card, state, compiled);
    const comment = root.closest(COMMENT_SELECTOR);
    if (comment) processNode(comment, state, compiled);

    processNode(root, state, compiled);
    root.querySelectorAll(CARD_SELECTOR).forEach((node) => {
      processNode(node, state, compiled);
    });
    if (hasCommentRules(compiled)) {
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
    const snapshot = deps.getSnapshot();
    if (!snapshot) return;
    for (const node of nodes) {
      if (hasAncestorIn(node, roots)) continue;
      processSubtree(node, snapshot.state, snapshot.compiled);
    }
  });

  function rescan(): void {
    clearHidden();
    seen = new WeakMap<Element, string>();
    const snapshot = deps.getSnapshot();
    if (snapshot?.state.settings.enabled) {
      const { state, compiled } = snapshot;
      document.querySelectorAll(CARD_SELECTOR).forEach((node) => {
        processNode(node, state, compiled);
      });
      if (hasCommentRules(compiled)) {
        document.querySelectorAll(COMMENT_SELECTOR).forEach((node) => {
          processNode(node, state, compiled);
        });
      }
    }
    deps.evaluate();
  }

  return { hide, show, schedule: (root) => batcher.add(root), rescan };
}
