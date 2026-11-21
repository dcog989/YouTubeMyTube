import { byId, h } from '../shared/ui';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: string;
  direction: SortDirection;
}

const UP_PATH = 'M4 8l4-4 4 4';
const DOWN_PATH = 'M4 4l4 4 4-4';

function caret(path: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrow.setAttribute('d', path);
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('stroke', 'currentColor');
  arrow.setAttribute('stroke-width', '1.6');
  arrow.setAttribute('stroke-linecap', 'round');
  arrow.setAttribute('stroke-linejoin', 'round');
  svg.append(arrow);
  return svg;
}

function compareValues(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export type SortColumns = ReadonlyArray<readonly [key: string, index: number]>;

interface TableSorter<T> {
  wire(bodyId: string, onSort: () => void): void;
  sort(items: T[]): T[];
}

export function createTableSorter<T>(
  defaultKey: string,
  columns: SortColumns,
  valueAt: (item: T, key: string) => string,
): TableSorter<T> {
  let current: SortState = { key: defaultKey, direction: 'asc' };
  const cells = new Map<string, { cell: HTMLTableCellElement; up: SVGElement; down: SVGElement }>();

  function ariaSort(): string {
    return current.direction === 'asc' ? 'ascending' : 'descending';
  }

  function apply(cell: HTMLTableCellElement, up: SVGElement, down: SVGElement): void {
    const active = current.key === cell.dataset.sortKey;
    cell.setAttribute('aria-sort', active ? ariaSort() : 'none');
    cell.classList.toggle('is-sorted', active);
    up.classList.toggle('is-active', active && current.direction === 'asc');
    down.classList.toggle('is-active', active && current.direction === 'desc');
  }

  function update(): void {
    for (const entry of cells.values()) apply(entry.cell, entry.up, entry.down);
  }

  function toggle(key: string): void {
    current =
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' };
  }

  function header(key: string, text: string, onSort: () => void): HTMLTableCellElement {
    const up = caret(UP_PATH, 'th-sort-caret');
    const down = caret(DOWN_PATH, 'th-sort-caret');
    const button = h(
      'button',
      { type: 'button', className: 'th-sort' },
      h('span', { className: 'th-sort-label', text }),
      h('span', { className: 'th-sort-icons' }, up, down),
    );
    button.addEventListener('click', () => {
      toggle(key);
      update();
      onSort();
    });
    const cell = h('th', {}, button);
    cell.dataset.sortKey = key;
    cells.set(key, { cell, up, down });
    apply(cell, up, down);
    return cell;
  }

  return {
    wire(bodyId, onSort) {
      const headers = byId(bodyId).closest('table')?.querySelectorAll('thead th');
      for (const [key, index] of columns) {
        const cell = headers?.[index];
        if (!cell) continue;
        cell.replaceWith(header(key, cell.textContent ?? '', onSort));
      }
    },
    sort(items) {
      const { key, direction } = current;
      const factor = direction === 'asc' ? 1 : -1;
      return [...items].sort((a, b) => factor * compareValues(valueAt(a, key), valueAt(b, key)));
    },
  };
}
