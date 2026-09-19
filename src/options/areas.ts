import { AREA_DEFINITIONS } from '../shared/areas';
import type { AreaKey } from '../shared/types';
import { byId, h } from '../shared/ui';
import { AREA_COPY } from './copy';
import { updateCounts } from './counts';
import { getDraft, setDirty } from './state';

const areaInputs = new Map<AreaKey, HTMLInputElement>();

export function buildAreas(): void {
  const host = byId('areas');
  const draft = getDraft();
  for (const { key } of AREA_DEFINITIONS) {
    const { title, sub } = AREA_COPY[key];
    const input = h('input', { type: 'checkbox', id: `area-${key}` });
    input.addEventListener('change', () => {
      draft.areas[key] = input.checked;
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
          h('div', { className: 'row-title', text: title }),
          h('div', { className: 'row-sub', text: sub }),
        ),
        h('label', { className: 'switch' }, input, h('span', { className: 'slider' })),
      ),
    );
    areaInputs.set(key, input);
  }
}

export function syncAreas(): void {
  const draft = getDraft();
  for (const [key, input] of areaInputs) {
    input.checked = draft.areas[key];
  }
}
