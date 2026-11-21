import { closestAcrossShadow, eventTarget } from '../dom';
import { CARD_SELECTOR } from '../entity-selectors';
import { containerStart, type MenuContainer } from './container';
import { MENU_HOST_SELECTOR, MENU_ITEM_SELECTOR, MENU_TRIGGER_SELECTOR } from './selectors';
import { attachShadows } from './shadow';

export interface OwnerTracker {
  init(): void;
  isPossible(): boolean;
  resolve(container: MenuContainer): Element | null;
  track(event: MouseEvent, onItem: (element: Element) => void): void;
  reset(): void;
}

export function createOwnerTracker(): OwnerTracker {
  let lastTarget: Element | null = null;
  let observer: MutationObserver | null = null;
  let expandedOpen = false;
  let triggerPressed = false;
  const shadowOwners = new WeakSet<Element>();

  function ownerFrom(scope: Element): Element | null {
    return (
      closestAcrossShadow(scope, CARD_SELECTOR) ?? closestAcrossShadow(scope, MENU_HOST_SELECTOR)
    );
  }

  function expandedOwner(): Element | null {
    for (const expanded of document.querySelectorAll('[aria-expanded="true"]')) {
      if (!closestAcrossShadow(expanded, MENU_TRIGGER_SELECTOR)) continue;
      const owner = ownerFrom(expanded);
      if (owner) return owner;
    }
    return null;
  }

  // Cheap gate for the DOM batcher: scanning every added subtree for menu items
  // is only useful after a click on a card or while a menu is expanded. Not
  // every menu sets aria-expanded (the sheet popups do not), so a recent card
  // click also opens the gate.
  function isPossible(): boolean {
    return triggerPressed || expandedOpen || lastTarget !== null;
  }

  function resolve(container: MenuContainer): Element | null {
    const start = containerStart(container);
    if (start) {
      const owner = ownerFrom(start);
      if (owner) return owner;
    }

    if (lastTarget?.isConnected) return lastTarget;

    return expandedOwner();
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

    // A press outside any card or host must not leave an old card as the owner
    // of the next menu; that menu would block the previously clicked video.
    if (!owner) {
      lastTarget = null;
      return;
    }
    lastTarget = owner;

    if (trigger) {
      triggerPressed = true;
      if (!shadowOwners.has(owner)) {
        shadowOwners.add(owner);
        attachShadows(owner, MENU_ITEM_SELECTOR, onItem);
      }
    }
  }

  function init(): void {
    if (observer) return;
    observer = new MutationObserver(() => {
      expandedOpen = Boolean(document.querySelector('[aria-expanded="true"]'));
      if (!expandedOpen) {
        lastTarget = null;
        triggerPressed = false;
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      subtree: true,
    });
  }

  return {
    init,
    isPossible,
    resolve,
    track,
    reset: () => {
      lastTarget = null;
      triggerPressed = false;
    },
  };
}
