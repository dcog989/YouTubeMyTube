import { createBatcher } from '../batch';
import { closestAcrossShadow, eventTarget } from '../dom';
import type { FilterEngine } from '../filter';
import type { OverlayFeedback } from '../overlay';
import type { Store } from '../store';
import { type MenuContainer, parentContainer } from './container';
import { createInjector } from './inject';
import { createOwnerTracker } from './owner';
import { INJECTED_ATTR, MENU_ITEM_SELECTOR, MOBILE_HOST } from './selectors';
import { observeRoot, scanExisting } from './shadow';

export interface MenuInjector {
  init(): void;
}

export function createMenuInjector(deps: {
  store: Store;
  filter: FilterEngine;
  overlay: OverlayFeedback;
}): MenuInjector {
  const owners = createOwnerTracker();
  const injector = createInjector({ ...deps, owners });

  const batcher = createBatcher<Element>((nodes) => {
    if (!owners.current()?.isConnected) return;

    const containers = new Set<MenuContainer>();
    for (const node of nodes) {
      const item = node.matches(MENU_ITEM_SELECTOR) ? node : node.querySelector(MENU_ITEM_SELECTOR);
      const container = item ? parentContainer(item) : null;
      if (container) containers.add(container);
    }

    for (const container of containers) {
      if (container.isConnected) injector.inject(container);
    }
  });

  function handleInjectedClick(event: MouseEvent): void {
    const target = eventTarget(event);
    if (!target) return;
    const item = closestAcrossShadow(target, `[${INJECTED_ATTR}]`);
    if (!item || !injector.owns(item)) return;
    event.preventDefault();
    event.stopPropagation();
    injector.activate(item);
  }

  function init(): void {
    if (window.top !== window) return;
    if (window.location.hostname === MOBILE_HOST) return;

    window.addEventListener('click', handleInjectedClick, true);
    window.addEventListener(
      'pointerdown',
      (event) => owners.track(event, (element) => batcher.add(element)),
      true,
    );
    observeRoot(document.documentElement, (element) => batcher.add(element));
    scanExisting(document, MENU_ITEM_SELECTOR, (element) => batcher.add(element));
  }

  return { init };
}
