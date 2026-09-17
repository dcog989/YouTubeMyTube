import { closestAcrossShadow } from '../dom';
import { MENU_ITEM_SELECTOR, MENU_POPUP_SELECTOR } from './selectors';

export type MenuContainer = Element | ShadowRoot;

export function parentContainer(item: Element): MenuContainer | null {
  const parent = item.parentNode;
  if (parent instanceof ShadowRoot) return parent;
  if (parent instanceof Element) return parent;
  return null;
}

export function containerStart(container: MenuContainer): Element | null {
  if (container instanceof ShadowRoot) return container.host;
  return container;
}

export function popupOf(container: MenuContainer): Element | null {
  const start = containerStart(container);
  if (!start) return null;
  return closestAcrossShadow(start, MENU_POPUP_SELECTOR);
}

export function menuItemHost(scope: Element, fallback: MenuContainer): MenuContainer {
  const items = scope.querySelectorAll(MENU_ITEM_SELECTOR);
  const last = items[items.length - 1];
  return (last ? parentContainer(last) : null) ?? fallback;
}

export function moveToEnd(host: MenuContainer, items: Element[]): void {
  const last = items[items.length - 1];
  if (!last) return;
  const atEnd = host.lastElementChild === last && items.every((item) => item.parentNode === host);
  if (atEnd) return;
  for (const item of items) host.appendChild(item);
}
