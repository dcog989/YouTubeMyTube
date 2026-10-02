import { closestAcrossShadow, eventTarget } from '../dom';
import { CARD_SELECTOR } from '../entity-selectors';
import { containerStart, type MenuContainer } from './container';
import { MENU_HOST_SELECTOR, MENU_ITEM_SELECTOR, MENU_TRIGGER_SELECTOR } from './selectors';
import { attachShadows } from './shadow';

export interface OwnerTracker {
  current(): Element | null;
  resolve(container: MenuContainer): Element | null;
  track(event: MouseEvent, onItem: (element: Element) => void): void;
  reset(): void;
}

export function createOwnerTracker(): OwnerTracker {
  let lastTarget: Element | null = null;

  function resolve(container: MenuContainer): Element | null {
    const start = containerStart(container);
    if (start) {
      const card = closestAcrossShadow(start, CARD_SELECTOR);
      if (card) return card;
      const host = closestAcrossShadow(start, MENU_HOST_SELECTOR);
      if (host) return host;
    }

    if (lastTarget?.isConnected) return lastTarget;

    const expanded = document.querySelector('[aria-expanded="true"]');
    if (expanded) {
      const card = closestAcrossShadow(expanded, CARD_SELECTOR);
      if (card) return card;
      const host = closestAcrossShadow(expanded, MENU_HOST_SELECTOR);
      if (host) return host;
    }

    return null;
  }

  function track(event: MouseEvent, onItem: (element: Element) => void): void {
    const target = eventTarget(event);
    if (!target) return;

    const trigger = closestAcrossShadow(target, MENU_TRIGGER_SELECTOR);
    const owner =
      closestAcrossShadow(target, CARD_SELECTOR) ??
      closestAcrossShadow(target, MENU_HOST_SELECTOR) ??
      (trigger
        ? (closestAcrossShadow(trigger, CARD_SELECTOR) ??
          closestAcrossShadow(trigger, MENU_HOST_SELECTOR))
        : null);

    if (!owner) return;
    lastTarget = owner;

    attachShadows(owner, MENU_ITEM_SELECTOR, onItem);
  }

  return {
    current: () => lastTarget,
    resolve,
    track,
    reset: () => {
      lastTarget = null;
    },
  };
}
