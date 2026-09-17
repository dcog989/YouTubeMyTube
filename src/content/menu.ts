import { getRuntimeUrl, onLocalStorageChanged } from '../shared/ext';
import { loadState, saveState } from '../shared/state';
import { normalizeState } from '../shared/storage';
import type { BlockerState, Entity, FilterRules } from '../shared/types';
import { CARD_SELECTOR, COMMENT_SELECTOR, cardEntity, currentContext } from './entity';

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
const INJECTION_DEDUPE_MS = 1000;
const INJECTION_MAX_AGE_MS = 60000;

interface MenuAction {
  label: string;
  key: keyof FilterRules;
  value: string;
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
const injectedAt = new WeakMap<Element, number>();
const injectedItems = new Set<HTMLElement>();
const observedRoots = new WeakSet<Node>();

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

function actionsFor(entity: Entity): MenuAction[] {
  const actions: MenuAction[] = [];
  if (entity.videoId) {
    actions.push({ label: 'Block video', key: 'videoIds', value: entity.videoId });
  }
  if (entity.channelId) {
    actions.push({ label: 'Block channel', key: 'channelIds', value: entity.channelId });
  } else if (entity.handle) {
    actions.push({ label: 'Block channel', key: 'handles', value: entity.handle.toLowerCase() });
  }
  return actions;
}

function pendingActions(entity: Entity): MenuAction[] {
  if (!state) return [];
  const actions = actionsFor(entity);
  return actions.filter((action) => !state?.rules[action.key].includes(action.value));
}

function hasInjectedAction(action: MenuAction): boolean {
  const now = Date.now();
  for (const item of injectedItems) {
    const age = now - (injectedAt.get(item) ?? 0);
    if (!item.isConnected || age > INJECTION_MAX_AGE_MS) {
      injectedItems.delete(item);
      itemActions.delete(item);
      continue;
    }
    const existing = itemActions.get(item);
    if (!existing || existing.key !== action.key || existing.value !== action.value) continue;
    if (age < INJECTION_DEDUPE_MS || item.getClientRects().length > 0) return true;
  }
  return false;
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
  return null;
}

function entityFor(owner: Element): Entity {
  return owner.matches(CARD_SELECTOR) ? cardEntity(owner) : currentContext();
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
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = 'var(--yt-spec-10-percent-layer, rgba(128, 128, 128, 0.2))';
  });
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = 'transparent';
  });
  itemActions.set(item, action);
  injectedAt.set(item, Date.now());
  injectedItems.add(item);
  return item;
}

function inject(container: MenuContainer): void {
  if (!state?.settings.enabled) return;
  if (container.querySelector(`[${INJECTED_ATTR}]`)) return;

  const start = containerStart(container);
  if (start && closestAcrossShadow(start, COMMENT_SELECTOR)) return;
  if (start && closestAcrossShadow(start, NON_MENU_SELECTOR)) return;

  const owner = resolveOwner(container);
  if (!owner) return;

  const actions = pendingActions(entityFor(owner)).filter((action) => !hasInjectedAction(action));
  if (actions.length === 0) return;

  const style = computeItemStyle(container);
  for (const action of actions) {
    container.appendChild(createItem(action, style));
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

async function applyAction(action: MenuAction): Promise<void> {
  const current = await loadState();
  if (current.rules[action.key].includes(action.value)) return;
  current.rules[action.key].push(action.value);
  await saveState(current);
  state = current;
  closeMenu();
}

function eventTarget(event: Event): Element | null {
  return event.composedPath().find((node): node is Element => node instanceof Element) ?? null;
}

function trackMenuTrigger(event: MouseEvent): void {
  const target = eventTarget(event);
  if (!target) return;
  const trigger = closestAcrossShadow(target, MENU_TRIGGER_SELECTOR);
  if (!trigger) return;
  const owner =
    closestAcrossShadow(trigger, CARD_SELECTOR) ?? closestAcrossShadow(trigger, MENU_HOST_SELECTOR);
  lastMenuTarget = owner;
  if (!owner) return;

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
  const action = itemActions.get(item);
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  void applyAction(action);
}

export function initMenuInjection(): void {
  if (window.top !== window) return;
  if (window.location.hostname === MOBILE_HOST) return;

  void (async () => {
    state = await loadState();
    onLocalStorageChanged((value) => {
      state = normalizeState(value);
    });
  })();

  document.addEventListener('click', trackMenuTrigger, true);
  document.addEventListener('click', handleInjectedClick, true);
  observeRoot(document.documentElement);
  scanExisting(document);
}
