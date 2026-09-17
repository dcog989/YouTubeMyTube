import { getRuntimeUrl, onLocalStorageChanged } from '../shared/ext';
import {
  compileRules,
  isRulePresent,
  matchEntity,
  normalizeHandle,
  parseYouTubeUrl,
} from '../shared/matcher';
import { loadState, saveState } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState, Entity, FilterRules } from '../shared/types';
import { CARD_SELECTOR, COMMENT_SELECTOR, cardEntity, currentContext } from './entity';
import { setPlayerBlank } from './overlay';

const MENU_ITEM_SELECTORS = [
  'ytd-menu-service-item-renderer',
  'yt-list-item-view-model',
  'ytm-menu-service-item-renderer',
];
const MENU_ITEM_SELECTOR = MENU_ITEM_SELECTORS.join(',');

const MENU_HOST_SELECTORS = [
  'ytd-watch-metadata',
  'ytd-video-primary-info-renderer',
  'ytd-video-owner-renderer',
  'ytm-slim-video-metadata-section-renderer',
];
const MENU_HOST_SELECTOR = MENU_HOST_SELECTORS.join(',');

const MENU_TRIGGER_SELECTOR = [
  'ytd-menu-renderer',
  'ytd-menu-renderer button',
  'ytd-menu-renderer yt-button-shape',
  'yt-button-shape',
  'yt-icon-button',
  '[aria-haspopup]',
].join(',');

const NON_MENU_SELECTOR = [
  'ytd-add-to-playlist-renderer',
  'ytd-playlist-add-to-option-renderer',
  'ytd-compact-link-renderer',
].join(',');

const INJECTED_ATTR = 'data-ytb-menu-item';
const MENU_POPUP_SELECTOR = [
  'tp-yt-iron-dropdown',
  'ytd-menu-popup-renderer',
  'ytd-multi-page-menu-renderer',
].join(',');
const MOBILE_HOST = 'm.youtube.com';
const ICON_PATH = 'assets/icons/48.png';
const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_ITEM_PADDING = 16;
const ICON_SIZE = '24px';
const ICON_GAP = '16px';
const LABEL_SELECTOR = 'yt-formatted-string, .yt-core-attributed-string, #text';
const LABEL_SELECTOR_BONUS = 100;
const MIN_LABEL_SIZE = 12;
const MAX_LABEL_SIZE = 22;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 18;

interface MenuAction {
  label: string;
  key: keyof FilterRules;
  value: string;
  mode: 'block' | 'unblock';
}

interface MenuItemStyle {
  height: number;
  paddingLeft: number;
  paddingRight: number;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: string;
}

type MenuContainer = Element | ShadowRoot;

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

function closestAcrossShadow(element: Element, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    const match = current.closest(selector);
    if (match) return match;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

function parentContainer(item: Element): MenuContainer | null {
  const parent = item.parentNode;
  if (parent instanceof ShadowRoot) return parent;
  if (parent instanceof Element) return parent;
  return null;
}

function containerStart(container: MenuContainer): Element | null {
  if (container instanceof ShadowRoot) return container.host;
  return container;
}

function popupOf(container: MenuContainer): Element | null {
  const start = containerStart(container);
  if (!start) return null;
  return closestAcrossShadow(start, MENU_POPUP_SELECTOR);
}

function menuItemHost(scope: Element, fallback: MenuContainer): MenuContainer {
  const items = scope.querySelectorAll(MENU_ITEM_SELECTOR);
  const last = items[items.length - 1];
  return (last ? parentContainer(last) : null) ?? fallback;
}

function moveToEnd(host: MenuContainer, items: Element[]): void {
  const last = items[items.length - 1];
  if (!last) return;
  const atEnd = host.lastElementChild === last && items.every((item) => item.parentNode === host);
  if (atEnd) return;
  for (const item of items) host.appendChild(item);
}

function pushAction(
  actions: MenuAction[],
  rules: FilterRules,
  key: keyof FilterRules,
  value: string,
): void {
  const noun = key === 'videoIds' ? 'video' : 'channel';
  const blocked = isRulePresent(rules, key, value);
  actions.push({
    label: `${blocked ? 'Unblock' : 'Block'} ${noun}`,
    key,
    value,
    mode: blocked ? 'unblock' : 'block',
  });
}

function actionsFor(entity: Entity, rules: FilterRules): MenuAction[] {
  const actions: MenuAction[] = [];
  if (entity.videoId) pushAction(actions, rules, 'videoIds', entity.videoId);
  if (entity.channelId) {
    pushAction(actions, rules, 'channelIds', entity.channelId);
  } else if (entity.handle) {
    pushAction(actions, rules, 'handles', entity.handle.toLowerCase());
  } else if (entity.channelName) {
    pushAction(actions, rules, 'channelNames', entity.channelName);
  }
  return actions;
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

function hasDirectText(element: Element): boolean {
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim()) return true;
  }
  return false;
}

function findLabelElement(root: Element | ShadowRoot): Element | null {
  let best: Element | null = null;
  let bestScore = -1;

  const visit = (node: Element | ShadowRoot): void => {
    const elements = [...(node instanceof Element ? [node] : []), ...node.querySelectorAll('*')];
    for (const element of elements) {
      if (hasDirectText(element)) {
        const size = Number.parseFloat(window.getComputedStyle(element).fontSize) || 0;
        if (size >= MIN_LABEL_SIZE && size <= MAX_LABEL_SIZE) {
          const bonus = element.matches(LABEL_SELECTOR) ? LABEL_SELECTOR_BONUS : 0;
          const score = bonus + size;
          if (score > bestScore) {
            bestScore = score;
            best = element;
          }
        }
      }
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };

  visit(root);
  return best;
}

function computeItemStyle(container: MenuContainer): MenuItemStyle {
  const style: MenuItemStyle = {
    height: DEFAULT_ITEM_HEIGHT,
    paddingLeft: DEFAULT_ITEM_PADDING,
    paddingRight: DEFAULT_ITEM_PADDING,
    color: '',
    fontFamily: '',
    fontSize: MIN_FONT_SIZE,
    fontWeight: '',
    lineHeight: '',
  };

  let box: Element | null = null;
  let label: Element | null = null;
  let labelSize = 0;

  container.querySelectorAll(MENU_ITEM_SELECTOR).forEach((item) => {
    box ??= item;
    const candidate = findLabelElement(item);
    if (!candidate) return;
    const size = Number.parseFloat(window.getComputedStyle(candidate).fontSize) || 0;
    if (size > labelSize) {
      labelSize = size;
      label = candidate;
    }
  });

  if (box) {
    const boxElement = box.querySelector('tp-yt-paper-item, a') ?? box;
    const boxStyle = window.getComputedStyle(boxElement);
    const height = box.getBoundingClientRect().height;
    style.height = height > 0 ? height : DEFAULT_ITEM_HEIGHT;
    style.paddingLeft = Number.parseFloat(boxStyle.paddingLeft) || DEFAULT_ITEM_PADDING;
    style.paddingRight = Number.parseFloat(boxStyle.paddingRight) || DEFAULT_ITEM_PADDING;
  }

  if (label) {
    const textStyle = window.getComputedStyle(label);
    style.color = textStyle.color;
    style.fontFamily = textStyle.fontFamily;
    style.fontSize = Math.min(Math.max(labelSize, MIN_FONT_SIZE), MAX_FONT_SIZE);
    style.fontWeight = textStyle.fontWeight;
    style.lineHeight = textStyle.lineHeight;
  }

  return style;
}

function applyItemStyle(item: HTMLElement, style: MenuItemStyle): void {
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.style.boxSizing = 'border-box';
  item.style.width = '100%';
  item.style.whiteSpace = 'nowrap';
  item.style.cursor = 'pointer';
  item.style.pointerEvents = 'auto';
  item.style.height = `${style.height}px`;
  item.style.padding = `0 ${style.paddingRight}px 0 ${style.paddingLeft}px`;
  item.style.color = style.color;
  item.style.fontFamily = style.fontFamily;
  item.style.fontSize = `${style.fontSize}px`;
  item.style.fontWeight = style.fontWeight;
  item.style.lineHeight = style.lineHeight;
}

function createIcon(): HTMLImageElement {
  const icon = document.createElement('img');
  icon.className = 'ytb-menu-item-icon';
  icon.src = getRuntimeUrl(ICON_PATH);
  icon.alt = '';
  icon.style.flex = 'none';
  icon.style.width = ICON_SIZE;
  icon.style.height = ICON_SIZE;
  icon.style.marginRight = ICON_GAP;
  icon.style.objectFit = 'contain';
  return icon;
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
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    activateItem(item);
  });
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
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) schedule(node as Element);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
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
      setPlayerBlank(true, `video id ${action.value}`);
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
