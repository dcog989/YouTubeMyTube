import { getRuntimeUrl } from '../../shared/runtime';
import { h } from '../../shared/ui';

const ICON_PATH = 'assets/icons/48.png';

// Layout, font and colour live in content.css so the item inherits the menu's
// own styling instead of measuring it element by element on every open.
export function createIcon(): HTMLImageElement {
  return h('img', {
    className: 'ytb-menu-item-icon',
    src: getRuntimeUrl(ICON_PATH),
    alt: '',
  });
}
