import { getRuntimeUrl } from '../../shared/ext';
import { h } from '../../shared/ui';
import { walkShadowRoots } from '../dom';
import type { MenuContainer } from './container';
import { MENU_ITEM_SELECTOR } from './selectors';

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

export interface MenuItemStyle {
  height: number;
  paddingLeft: number;
  paddingRight: number;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: string;
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

  walkShadowRoots(root, (element) => {
    if (!hasDirectText(element)) return;
    const size = Number.parseFloat(window.getComputedStyle(element).fontSize) || 0;
    if (size < MIN_LABEL_SIZE || size > MAX_LABEL_SIZE) return;
    const bonus = element.matches(LABEL_SELECTOR) ? LABEL_SELECTOR_BONUS : 0;
    const score = bonus + size;
    if (score > bestScore) {
      bestScore = score;
      best = element;
    }
  });

  return best;
}

export function computeItemStyle(container: MenuContainer): MenuItemStyle {
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

  for (const item of container.querySelectorAll(MENU_ITEM_SELECTOR)) {
    box ??= item;
    const candidate = findLabelElement(item);
    if (!candidate) continue;
    const size = Number.parseFloat(window.getComputedStyle(candidate).fontSize) || 0;
    if (size > labelSize) {
      labelSize = size;
      label = candidate;
    }
  }

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

export function applyItemStyle(item: HTMLElement, style: MenuItemStyle): void {
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

export function createIcon(): HTMLImageElement {
  return h('img', {
    className: 'ytb-menu-item-icon',
    src: getRuntimeUrl(ICON_PATH),
    alt: '',
    style: {
      flex: 'none',
      width: ICON_SIZE,
      height: ICON_SIZE,
      marginRight: ICON_GAP,
      objectFit: 'contain',
    },
  });
}
