import { AREA_DEFINITIONS } from '../shared/areas';
import type { AreaKey } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { getDraft, setDirty } from './state';

const areaInputs = new Map<AreaKey, HTMLInputElement>();

export function buildAreas(): void {
  const host = byId('areas');
  const draft = getDraft();
  for (const config of AREA_DEFINITIONS) {
    const input = h('input', { type: 'checkbox', id: `area-${config.key}` });
    input.addEventListener('change', () => {
      draft.areas[config.key] = input.checked;
      setDirty(true);
      updateCounts();
    });

    host.appendChild(
      h(
        'div',
        { className: 'row row-between' },
        h(
          'div',
          {},
          h('div', { className: 'row-title', text: config.title }),
          h('div', { className: 'row-sub', text: config.sub }),
        ),
        h('label', { className: 'switch' }, input, h('span', { className: 'slider' })),
      ),
    );
    areaInputs.set(config.key, input);
  }
}

export function syncAreas(): void {
  const draft = getDraft();
  for (const [key, input] of areaInputs) {
    input.checked = draft.areas[key];
  }
}
