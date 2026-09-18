import { compileRules, matchEntity } from '../shared/matcher';
import type { BlockerState } from '../shared/types';
import { cardEntity } from './entity';

const hiddenCards = new Set<HTMLElement>();

function applyVisibility(card: HTMLElement, hidden: boolean): void {
  if (hidden) card.style.setProperty('display', 'none', 'important');
  else card.style.removeProperty('display');
}

export function hideCard(card: HTMLElement): void {
  applyVisibility(card, true);
  hiddenCards.add(card);
}

export function showCard(card: HTMLElement): void {
  applyVisibility(card, false);
  hiddenCards.delete(card);
}

export function pruneHiddenCards(): void {
  for (const card of hiddenCards) {
    if (!card.isConnected) hiddenCards.delete(card);
  }
}

export function refreshHiddenCards(state: BlockerState): void {
  const compiled = compileRules(state.rules);
  for (const card of hiddenCards) {
    if (!card.isConnected) {
      hiddenCards.delete(card);
      continue;
    }
    if (matchEntity(cardEntity(card), compiled).blocked) {
      applyVisibility(card, true);
    } else {
      applyVisibility(card, false);
      hiddenCards.delete(card);
    }
  }
}
