import type { BlockerState, Entity } from '../../shared/types';
import { h } from '../../shared/ui';
import { parseYouTubeUrl } from '../../shared/url';
import { createBatcher } from '../batch';
import { closestAcrossShadow } from '../dom';
import { cardEntity, currentContext } from '../entity';
import { CARD_SELECTOR, COMMENT_SELECTOR } from '../entity-selectors';
import type { FilterEngine } from '../filter';
import type { OverlayFeedback } from '../overlay';
import type { Store } from '../store';
import { actionsFor, type MenuAction } from './actions';
import { createChannelCache } from './channel-cache';
import {
  containerStart,
  type MenuContainer,
  menuItemHost,
  moveToEnd,
  parentContainer,
  popupOf,
} from './container';
import { persistAction } from './persist';
import {
  DONT_RECOMMEND_LABELS,
  INJECTED_ATTR,
  MENU_HOST_SELECTOR,
  MENU_ITEM_SELECTOR,
  MENU_TRIGGER_SELECTOR,
  MOBILE_HOST,
  NON_MENU_SELECTOR,
} from './selectors';
import { attachShadows, observeRoot, scanExisting } from './shadow';
import {
  applyItemStyle,
  computeItemStyle,
  createIcon,
  type MenuItemStyle,
  menuItemLabel,
} from './style';

export interface MenuInjector {
  init(): void;
}

export function createMenuInjector(deps: {
  store: Store;
  filter: FilterEngine;
  overlay: OverlayFeedback;
}): MenuInjector {
  let lastMenuTarget: Element | null = null;
  const itemState = new WeakMap<Element, { action: MenuAction; owner: Element }>();
  const channelCache = createChannelCache();

  function currentState(): BlockerState | null {
    return deps.store.getSnapshot()?.state ?? null;
  }

  function pendingActions(entity: Entity): MenuAction[] {
    const state = currentState();
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
    const entity = owner.matches(CARD_SELECTOR) ? cardEntity(owner) : currentContext();
    if (entity.videoId) {
      const meta = channelCache.get(entity.videoId);
      if (meta) {
        if (!entity.channelId && meta.id) entity.channelId = meta.id;
        if (!entity.handle && meta.handle) entity.handle = meta.handle;
        if (!entity.channelName && meta.name) entity.channelName = meta.name;
      }
    }
    return entity;
  }

  function requestChannel(videoId: string, container: MenuContainer): void {
    const pending = channelCache.request(videoId);
    if (!pending) return;
    void pending.finally(() => {
      if (container.isConnected) inject(container);
    });
  }

  function ownerForItem(item: Element): Element | null {
    const container = parentContainer(item);
    const resolved = container ? resolveOwner(container) : null;
    return resolved ?? itemState.get(item)?.owner ?? null;
  }

  function liveActionFor(item: Element): MenuAction | null {
    const stored = itemState.get(item)?.action;
    if (!stored) return null;
    const state = currentState();
    if (!state) return stored;
    const owner = ownerForItem(item);
    if (!owner) return stored;
    const fresh = actionsFor(entityFor(owner), state.rules);
    const match =
      stored.kind === 'video'
        ? fresh.find((action) => action.kind === 'video')
        : fresh.find((action) => action.kind === 'channel');
    return match ?? null;
  }

  function clickDontRecommend(item: Element): void {
    const container = parentContainer(item);
    if (!container) return;
    const scope = popupOf(container) ?? container;
    for (const candidate of scope.querySelectorAll(MENU_ITEM_SELECTOR)) {
      if (candidate.hasAttribute(INJECTED_ATTR)) continue;
      const label = menuItemLabel(candidate)
        .replace(/[\u2018\u2019]/g, "'")
        .toLowerCase();
      if (!(DONT_RECOMMEND_LABELS as readonly string[]).includes(label)) continue;
      (candidate as HTMLElement).click();
      return;
    }
  }

  function activateItem(item: Element): void {
    const action = liveActionFor(item);
    if (!action) return;
    const owner = ownerForItem(item) ?? undefined;
    if (action.kind === 'channel' && action.mode === 'block') clickDontRecommend(item);
    void applyAction(action, owner);
  }

  function createItem(action: MenuAction, owner: Element, style: MenuItemStyle): HTMLElement {
    const item = h('div', {
      className: 'ytb-menu-item',
      [INJECTED_ATTR]: '',
      role: 'menuitem',
      tabIndex: 0,
    });
    applyItemStyle(item, style);

    const label = h('span', { className: 'ytb-menu-item-label', text: action.label });
    item.append(createIcon(), label);
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'var(--yt-spec-10-percent-layer, rgba(128, 128, 128, 0.2))';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      event.stopPropagation();
      activateItem(item);
    });
    itemState.set(item, { action, owner });
    return item;
  }

  function ownedItems(scope: Element, owner: Element): Element[] {
    return Array.from(scope.querySelectorAll(`[${INJECTED_ATTR}]`)).filter(
      (item) => itemState.get(item)?.owner === owner,
    );
  }

  function actionsMatch(owned: Element[], actions: MenuAction[]): boolean {
    if (owned.length !== actions.length) return false;
    return owned.every((item, index) => {
      const stored = itemState.get(item)?.action;
      const action = actions[index];
      if (!stored || !action) return false;
      return stored.kind === action.kind && stored.label === action.label;
    });
  }

  function inject(container: MenuContainer): void {
    if (!currentState()?.settings.enabled) return;

    const start = containerStart(container);
    if (!start?.isConnected) return;
    if (closestAcrossShadow(start, COMMENT_SELECTOR)) return;
    if (closestAcrossShadow(start, NON_MENU_SELECTOR)) return;

    const owner = resolveOwner(container);
    if (!owner) return;

    const scope = popupOf(container) ?? start;
    const host = menuItemHost(scope, container);

    for (const existing of Array.from(scope.querySelectorAll(`[${INJECTED_ATTR}]`))) {
      if (itemState.get(existing)?.owner !== owner) existing.remove();
    }

    const entity = entityFor(owner);
    if (entity.videoId && !entity.channelId && !entity.handle) {
      requestChannel(entity.videoId, container);
    }

    const actions = pendingActions(entity);
    const owned = ownedItems(scope, owner);
    if (actions.length === 0) {
      for (const item of owned) item.remove();
      return;
    }
    if (owned.length > 0 && actionsMatch(owned, actions)) {
      moveToEnd(host, owned);
      return;
    }
    for (const item of owned) item.remove();

    const style = computeItemStyle(container);
    for (const action of actions) {
      host.appendChild(createItem(action, owner, style));
    }
  }

  const batcher = createBatcher<Element>((nodes) => {
    if (!lastMenuTarget?.isConnected) return;

    const containers = new Set<MenuContainer>();
    for (const node of nodes) {
      const item = node.matches(MENU_ITEM_SELECTOR) ? node : node.querySelector(MENU_ITEM_SELECTOR);
      const container = item ? parentContainer(item) : null;
      if (container) containers.add(container);
    }

    for (const container of containers) {
      if (container.isConnected) inject(container);
    }
  });

  function closeMenu(): void {
    lastMenuTarget = null;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  function applyVisibility(action: MenuAction, owner: Element | undefined): void {
    const card = owner instanceof HTMLElement && owner.matches(CARD_SELECTOR) ? owner : null;
    const isCurrentVideo =
      action.kind === 'video' && parseYouTubeUrl(window.location.href).videoId === action.value;

    if (action.mode === 'block') {
      if (card) {
        deps.filter.hide(card);
      } else if (isCurrentVideo) {
        deps.overlay.requestBlank(true, { kind: 'video', value: action.value });
      }
      return;
    }

    if (card) {
      deps.filter.show(card);
    } else if (isCurrentVideo) {
      deps.overlay.requestBlank(false);
    }
  }

  async function applyAction(action: MenuAction, owner: Element | undefined): Promise<void> {
    applyVisibility(action, owner);
    const persisted = await persistAction(action);
    if (persisted) deps.store.setState(persisted);
    closeMenu();
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

    attachShadows(owner, MENU_ITEM_SELECTOR, (element) => batcher.add(element));
  }

  function handleInjectedClick(event: MouseEvent): void {
    const target = eventTarget(event);
    if (!target) return;
    const item = closestAcrossShadow(target, `[${INJECTED_ATTR}]`);
    if (!item) return;
    if (!itemState.has(item)) return;
    event.preventDefault();
    event.stopPropagation();
    activateItem(item);
  }

  function init(): void {
    if (window.top !== window) return;
    if (window.location.hostname === MOBILE_HOST) return;

    window.addEventListener('click', handleInjectedClick, true);
    window.addEventListener('pointerdown', trackMenuTrigger, true);
    observeRoot(document.documentElement, (element) => batcher.add(element));
    scanExisting(document, MENU_ITEM_SELECTOR, (element) => batcher.add(element));
  }

  return { init };
}
