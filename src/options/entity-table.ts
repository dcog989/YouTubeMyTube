import { t } from '../shared/i18n';
import { byId, h } from '../shared/ui';

export interface EntityTableOptions<T> {
  bodyId: string;
  items: T[];
  idOf: (item: T) => string;
  setId: (item: T, value: string) => void;
  placeholder: string;
  columns: Array<(item: T) => string>;
  removeLabel: (item: T) => string;
  onRemove: (item: T, index: number) => void;
}

export function removeLabelFor(name: string): string {
  return name ? `${t('remove')}: ${name}` : t('remove');
}

// Keeps keyboard focus on the same row after a remove re-renders the table.
export function focusRemove(bodyId: string, index: number, fallbackId: string): void {
  const buttons = byId(bodyId).querySelectorAll<HTMLButtonElement>('button');
  const target =
    index >= 0 && buttons.length > 0 ? buttons.item(Math.min(index, buttons.length - 1)) : null;
  (target ?? byId<HTMLButtonElement>(fallbackId)).focus();
}

export function renderEntityTable<T>(options: EntityTableOptions<T>): void {
  const body = byId(options.bodyId);
  const rows = document.createDocumentFragment();
  options.items.forEach((item, index) => {
    const idInput = h('input', {
      className: 'input entity-input',
      value: options.idOf(item),
      placeholder: options.placeholder,
      autocomplete: 'off',
    });
    idInput.addEventListener('input', () => options.setId(item, idInput.value.trim()));

    const remove = h('button', {
      type: 'button',
      className: 'btn btn-danger',
      text: t('remove'),
    });
    remove.setAttribute('aria-label', options.removeLabel(item));
    remove.addEventListener('click', () => options.onRemove(item, index));

    rows.appendChild(
      h(
        'tr',
        {},
        h('td', {}, idInput),
        ...options.columns.map((column) =>
          h('td', { className: 'entity-readonly', text: column(item) }),
        ),
        h('td', { className: 'col-action' }, remove),
      ),
    );
  });
  body.replaceChildren(rows);
}
