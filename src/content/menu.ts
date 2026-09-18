import { onLocalStorageChanged } from '../shared/ext';
import { compileRules, matchEntity, normalizeHandle, parseYouTubeUrl } from '../shared/matcher';
import { formatReason } from '../shared/reason';
import { loadState, saveState } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState, Entity } from '../shared/types';
import { closestAcrossShadow } from './dom';
import { CARD_SELECTOR, COMMENT_SELECTOR, cardEntity, currentContext } from './entity';
import { actionsFor, type MenuAction } from './menu/actions';
import {
  containerStart,
  type MenuContainer,
  menuItemHost,
  moveToEnd,
  parentContainer,
  popupOf,
} from './menu/container';
import {
  INJECTED_ATTR,
  MENU_HOST_SELECTOR,
  MENU_ITEM_SELECTOR,
  MENU_TRIGGER_SELECTOR,
  MOBILE_HOST,
  NON_MENU_SELECTOR,
} from './menu/selectors';
import { applyItemStyle, computeItemStyle, createIcon, type MenuItemStyle } from './menu/style';
import { onAddedElements } from './observer';
import { setPlayerBlank } from './overlay';

let state: BlockerState | null = null;
let lastMenuTarget: Element | null = null;
let scheduled = false;
const pending = new Set<Element>();
const itemActions = new WeakMap<Element, MenuAction>();
const itemOwner = new WeakMap<Element, Element>();
const hiddenCards = new Set<HTMLElement>();
const observedRoots = new WeakSet<Node>();

function setCardHidden(card: HTMLElement, hidden: boolean): void {
  if (hidden) card.style.setProperty('display', 'none', 'important');
  else card.style.removeProperty('display');
}

function pruneHiddenCards(): void {
  for (const card of hiddenCards) {
    if (!card.isConnected) hiddenCards.delete(card);
  }
}

function pendingActions(entity: Entity): MenuAction[] {
  if (!state) return [];
  return actionsFor(entity, state.rules);
}

function resolveOwner(container: MenuContainer): Element | null {
  const start = containerStart(container);
  if (start) {
    const card = closestAcrossShadow(start, CARD_SELECTOR);
    if (card) return card;
    const host = closestAcrossShadow(start, MENU_HOST_SELECTOR);
    if (host) return host;
  }

  if (lastMenuTarget?.isConnected) return lastMenuTarget;

  const expanded = document.querySelector('[aria-expanded="true"]');
  if (expanded) {
    const card = closestAcrossShadow(expanded, CARD_SELECTOR);
    if (card) return card;
    const host = closestAcrossShadow(expanded, MENU_HOST_SELECTOR);
    if (host) return host;
  }

  return null;
}

function entityFor(owner: Element): Entity {
  return owner.matches(CARD_SELECTOR) ? cardEntity(owner) : currentContext();
}

function ownerForItem(item: Element): Element | null {
  const container = parentContainer(item);
  const resolved = container ? resolveOwner(container) : null;
  return resolved ?? itemOwner.get(item) ?? null;
}

function liveActionFor(item: Element): MenuAction | null {
  const stored = itemActions.get(item);
  if (!stored) return null;
  if (!state) return stored;
  const owner = ownerForItem(item);
  if (!owner) return stored;
  const fresh = actionsFor(entityFor(owner), state.rules);
  const match =
    stored.key === 'videoIds'
      ? fresh.find((action) => action.key === 'videoIds')
      : fresh.find((action) => action.key !== 'videoIds');
  return match ?? null;
}

function activateItem(item: Element): void {
  const action = liveActionFor(item);
  if (!action) return;
  void applyAction(action, ownerForItem(item) ?? undefined);
}

function createItem(action: MenuAction, style: MenuItemStyle): HTMLElement {
  const item = document.createElement('div');
  item.className = 'ytb-menu-item';
  item.setAttribute(INJECTED_ATTR, '');
  item.setAttribute('role', 'menuitem');
  item.tabIndex = 0;
  applyItemStyle(item, style);

  const label = document.createElement('span');
  label.className = 'ytb-menu-item-label';
  label.textContent = action.label;

  item.append(createIcon(), label);
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = 'var(--yt-spec-10-percent-layer, rgba(128, 128, 128, 0.2))';
  });
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = 'transparent';
  });
  itemActions.set(item, action);
  return item;
}

function inject(container: MenuContainer): void {
  if (!state?.settings.enabled) return;

  const start = containerStart(container);
  if (!start?.isConnected) return;
  if (closestAcrossShadow(start, COMMENT_SELECTOR)) return;
  if (closestAcrossShadow(start, NON_MENU_SELECTOR)) return;

  const owner = resolveOwner(container);
  if (!owner) return;

  const scope = popupOf(container) ?? start;
  const host = menuItemHost(scope, container);

  for (const existing of Array.from(scope.querySelectorAll(`[${INJECTED_ATTR}]`))) {
    if (itemOwner.get(existing) !== owner) existing.remove();
  }

  const owned = Array.from(scope.querySelectorAll(`[${INJECTED_ATTR}]`)).filter(
    (item) => itemOwner.get(item) === owner,
  );
  if (owned.length > 0) {
    moveToEnd(host, owned);
    return;
  }

  const entity = entityFor(owner);
  const actions = pendingActions(entity);
  if (actions.length === 0) return;

  const style = computeItemStyle(container);
  for (const action of actions) {
    const item = createItem(action, style);
    host.appendChild(item);
    itemOwner.set(item, owner);
  }
}

function schedule(element: Element): void {
  pending.add(element);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flush);
}

function scanExisting(root: ParentNode): void {
  root.querySelectorAll(MENU_ITEM_SELECTOR).forEach((item) => {
    schedule(item);
  });
}

function observeRoot(root: Document | ShadowRoot | Element): void {
  if (observedRoots.has(root)) return;
  observedRoots.add(root);
  onAddedElements(root, (nodes) => {
    for (const node of nodes) schedule(node);
  });
}

function observeShadowTree(root: ParentNode): void {
  for (const element of root.querySelectorAll('*')) {
    const shadow = element.shadowRoot;
    if (!shadow || observedRoots.has(shadow)) continue;
    observeRoot(shadow);
    scanExisting(shadow);
    observeShadowTree(shadow);
  }
}

function attachMenuShadows(owner: Element): void {
  const root = owner.getRootNode();
  if (root instanceof ShadowRoot && !observedRoots.has(root)) {
    observeRoot(root);
    scanExisting(root);
  }
  observeShadowTree(owner);
  scanExisting(owner);
}

function flush(): void {
  scheduled = false;
  pruneHiddenCards();
  const nodes = Array.from(pending);
  pending.clear();

  const containers = new Set<MenuContainer>();
  for (const node of nodes) {
    const element = node as Element;
    const item = element.matches(MENU_ITEM_SELECTOR)
      ? element
      : element.querySelector(MENU_ITEM_SELECTOR);
    const container = item ? parentContainer(item) : null;
    if (container) containers.add(container);
  }

  for (const container of containers) {
    if (container.isConnected) inject(container);
  }
}

function closeMenu(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

async function applyAction(action: MenuAction, owner: Element | undefined): Promise<void> {
  const card = owner instanceof HTMLElement && owner.matches(CARD_SELECTOR) ? owner : null;
  const isCurrentVideo =
    action.key === 'videoIds' && parseYouTubeUrl(window.location.href).videoId === action.value;

  if (action.mode === 'block') {
    if (card) {
      setCardHidden(card, true);
      hiddenCards.add(card);
    } else if (isCurrentVideo) {
      setPlayerBlank(true, formatReason('video', action.value));
    }
  } else {
    if (card) {
      setCardHidden(card, false);
      hiddenCards.delete(card);
    } else if (isCurrentVideo) {
      setPlayerBlank(false);
    }
  }

  const current = await loadState();
  const list = current.rules[action.key];
  const index =
    action.key === 'handles'
      ? list.findIndex((entry) => normalizeHandle(entry) === action.value)
      : list.indexOf(action.value);

  if (action.mode === 'unblock') {
    if (index === -1) {
      closeMenu();
      return;
    }
    list.splice(index, 1);
  } else {
    if (index !== -1) {
      closeMenu();
      return;
    }
    list.push(action.value);
  }

  await saveState(current);
  state = current;
  closeMenu();
}

function refreshHiddenCards(): void {
  if (!state) return;
  const compiled = compileRules(state.rules);
  for (const card of hiddenCards) {
    if (!card.isConnected) {
      hiddenCards.delete(card);
      continue;
    }
    if (matchEntity(cardEntity(card), compiled).blocked) {
      setCardHidden(card, true);
    } else {
      setCardHidden(card, false);
      hiddenCards.delete(card);
    }
  }
}

function eventTarget(event: Event): Element | null {
  return event.composedPath().find((node): node is Element => node instanceof Element) ?? null;
}

function trackMenuTrigger(event: MouseEvent): void {
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
  lastMenuTarget = owner;

  attachMenuShadows(owner);
  queueMicrotask(() => {
    if (lastMenuTarget === owner) attachMenuShadows(owner);
  });
  setTimeout(() => {
    if (lastMenuTarget === owner) attachMenuShadows(owner);
  }, 100);
}

function handleInjectedClick(event: MouseEvent): void {
  const target = eventTarget(event);
  if (!target) return;
  const item = closestAcrossShadow(target, `[${INJECTED_ATTR}]`);
  if (!item) return;
  if (!itemActions.has(item)) return;
  event.preventDefault();
  event.stopPropagation();
  activateItem(item);
}

export function initMenuInjection(): void {
  if (window.top !== window) return;
  if (window.location.hostname === MOBILE_HOST) return;

  void (async () => {
    state = await loadState();
    onLocalStorageChanged((value) => {
      state = normalizeState(value);
      refreshHiddenCards();
    });
  })();

  window.addEventListener('click', trackMenuTrigger, true);
  window.addEventListener('click', handleInjectedClick, true);
  window.addEventListener('pointerdown', trackMenuTrigger, true);
  observeRoot(document.documentElement);
  scanExisting(document);
}
