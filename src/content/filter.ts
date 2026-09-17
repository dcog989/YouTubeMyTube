import { hasCommentRules, matchEntity } from '../shared/matcher';
import type { BlockerState, CompiledRules } from '../shared/types';
import { CARD_SELECTOR, COMMENT_SELECTOR, cardEntity, commentEntity, HIDDEN_CLASS } from './entity';
import { scheduleEvaluate } from './evaluate';
import { getCompiled, getState } from './store';

let processed = new WeakSet<Element>();
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

function processNode(node: Element, state: BlockerState, compiled: CompiledRules): void {
  if (!state.settings.enabled) return;
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

function processSubtree(root: Element, state: BlockerState, compiled: CompiledRules): void {
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

function flushPending(): void {
  scheduled = false;
  const nodes = Array.from(pending);
  pending.clear();
  const state = getState();
  const compiled = getCompiled();
  if (state && compiled) {
    for (const node of nodes) processSubtree(node, state, compiled);
  }
  scheduleEvaluate();
}

export function scheduleFilter(root: Element): void {
  pending.add(root);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flushPending);
}

export function rescan(): void {
  clearHidden();
  processed = new WeakSet<Element>();
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
