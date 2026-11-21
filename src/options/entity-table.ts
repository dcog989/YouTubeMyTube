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
  onRemove: (item: T) => void;
}

export function removeLabelFor(name: string): string {
  return name ? `${t('remove')}: ${name}` : t('remove');
}

export function renderEntityTable<T>(options: EntityTableOptions<T>): void {
  const body = byId(options.bodyId);
  body.replaceChildren();
  for (const item of options.items) {
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
    remove.addEventListener('click', () => options.onRemove(item));

    body.appendChild(
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
  }
}
