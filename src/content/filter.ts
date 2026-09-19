import { hasCommentRules, matchEntity } from '../shared/matcher';
import type { BlockerState, CompiledRules, Entity } from '../shared/types';
import { CARD_SELECTOR, COMMENT_SELECTOR, cardEntity, commentEntity, HIDDEN_CLASS } from './entity';
import { scheduleEvaluate } from './evaluate';
import { getCompiled, getState } from './store';

let seen = new WeakMap<Element, string>();
let scheduled = false;
const pending = new Set<Element>();

function setHidden(element: Element, hidden: boolean): void {
  element.classList.toggle(HIDDEN_CLASS, hidden);
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

function flushPending(): void {
  scheduled = false;
  const nodes = Array.from(pending);
  pending.clear();
  const roots = new Set(nodes);
  const state = getState();
  const compiled = getCompiled();
  if (state && compiled) {
    for (const node of nodes) {
      if (hasAncestorIn(node, roots)) continue;
      processSubtree(node, state, compiled);
    }
  }
}

export function scheduleFilter(root: Element): void {
  pending.add(root);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flushPending);
}

export function rescan(): void {
  clearHidden();
  seen = new WeakMap<Element, string>();
  const state = getState();
  const compiled = getCompiled();
  if (state?.settings.enabled && compiled) {
    document.querySelectorAll(CARD_SELECTOR).forEach((node) => {
      processNode(node, state, compiled);
    });
    if (hasCommentRules(compiled)) {
      document.querySelectorAll(COMMENT_SELECTOR).forEach((node) => {
        processNode(node, state, compiled);
      });
    }
  }
  scheduleEvaluate();
}
