import { blockChannel, blockVideo, unblockChannel, unblockVideo } from '../../shared/rules-service';
import type { BlockerState, Entity } from '../../shared/types';
import { h } from '../../shared/ui';
import { parseYouTubeUrl } from '../../shared/url';
import { closestAcrossShadow } from '../dom';
import { cardEntity, currentContext } from '../entity';
import { CARD_SELECTOR, COMMENT_SELECTOR } from '../entity-selectors';
import type { FilterEngine } from '../filter';
import type { OverlayFeedback } from '../overlay';
import { applyDecision, type Store } from '../store';
import { actionsFor, type MenuAction } from './actions';
import { type ChannelCache, withCachedChannel } from './channel-cache';
import {
  containerStart,
  type MenuContainer,
  menuItemHost,
  moveToEnd,
  parentContainer,
  popupOf,
} from './container';
import type { OwnerTracker } from './owner';
import { INJECTED_ATTR, NON_MENU_SELECTOR } from './selectors';
import { createIcon } from './style';

interface ItemState {
  action: MenuAction;
  owner: Element;
}

export interface Injector {
  inject(container: MenuContainer): void;
  activate(item: Element): void;
  owns(item: Element): boolean;
}

export function createInjector(deps: {
  store: Store;
  filter: FilterEngine;
  overlay: OverlayFeedback;
  owners: OwnerTracker;
  channelCache: ChannelCache;
}): Injector {
  const itemState = new WeakMap<Element, ItemState>();
  const { channelCache } = deps;

  function currentState(): BlockerState | null {
    return deps.store.getSnapshot()?.state ?? null;
  }

  function pendingActions(entity: Entity): MenuAction[] {
    const state = currentState();
    if (!state) return [];
    return actionsFor(entity, state.rules);
  }

  function entityFor(owner: Element): Entity {
    const entity = owner.matches(CARD_SELECTOR) ? cardEntity(owner) : currentContext();
    return withCachedChannel(channelCache, entity);
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
    const resolved = container ? deps.owners.resolve(container) : null;
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
    // Another tab may have flipped the block since the label was drawn; acting
    // on the fresh mode would do the opposite of what the item says.
    return match && match.mode === stored.mode ? match : null;
  }

  function activateItem(item: Element): void {
    const action = liveActionFor(item);
    if (!action) {
      close();
      return;
    }
    const owner = ownerForItem(item) ?? undefined;
    void applyAction(action, owner);
  }

  function createItem(action: MenuAction, owner: Element): HTMLElement {
    const item = h('div', {
      className: 'ytb-menu-item',
      [INJECTED_ATTR]: '',
      role: 'menuitem',
      tabIndex: 0,
    });

    const label = h('span', { className: 'ytb-menu-item-label', text: action.label });
    item.append(createIcon(), label);
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

    const owner = deps.owners.resolve(container);
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

    for (const action of actions) {
      host.appendChild(createItem(action, owner));
    }
  }

  function close(): void {
    deps.owners.reset();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  function applyVisibility(action: MenuAction, owner: Element | undefined): void {
    const card = owner instanceof HTMLElement && owner.matches(CARD_SELECTOR) ? owner : null;
    const isCurrentVideo =
      action.kind === 'video' && parseYouTubeUrl(window.location.href).videoId === action.entry.id;

    if (action.mode === 'block') {
      if (card) {
        deps.filter.hide(card);
      } else if (isCurrentVideo) {
        deps.overlay.requestBlank(true, { kind: 'video', value: action.entry.id });
      }
      return;
    }

    if (card) {
      deps.filter.show(card);
    } else if (isCurrentVideo) {
      deps.overlay.requestBlank(false);
    }
  }

  function persistAction(action: MenuAction): Promise<BlockerState | null> {
    if (action.kind === 'video') {
      return action.mode === 'unblock' ? unblockVideo(action.entry.id) : blockVideo(action.entry);
    }
    return action.mode === 'unblock'
      ? unblockChannel({
          id: action.entry.id,
          handle: action.entry.handle,
          name: action.entry.name,
        })
      : blockChannel(action.entry);
  }

  async function applyAction(action: MenuAction, owner: Element | undefined): Promise<void> {
    applyVisibility(action, owner);
    const persisted = await persistAction(action);
    if (!persisted) {
      // The optimistic hide must be reverted when the worker rejected the write.
      deps.filter.rescan();
      close();
      return;
    }
    const applied = currentState();
    deps.store.setState(persisted);
    // The storage echo may already have applied this state and rescanned; the
    // page still needs one refilter when it did not.
    if (!applied || applyDecision(applied, persisted).refilter) deps.filter.rescan();
    close();
  }

  return {
    inject,
    activate: activateItem,
    owns: (item) => itemState.has(item),
  };
}
