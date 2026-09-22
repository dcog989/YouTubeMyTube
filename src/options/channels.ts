import { t } from '../shared/i18n';
import { parseBlockInput, resolveChannel } from '../shared/resolve';
import {
  addChannel as addChannelRule,
  channelMatches,
  findChannel,
  removeChannel,
} from '../shared/rules';
import type { ChannelEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { compareValues, createSorter, type SortState } from './sort';
import { getDraft, setDirty } from './state';

const sorter = createSorter('id');

type ChannelSortKey = 'id' | 'name' | 'handle';

function channelValue(channel: ChannelEntry, key: ChannelSortKey): string {
  if (key === 'name') return channel.name;
  if (key === 'handle') return channel.handle;
  return channel.id;
}

function sortedChannels(channels: ChannelEntry[], sort: SortState): ChannelEntry[] {
  const key = sort.key as ChannelSortKey;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...channels].sort(
    (a, b) => factor * compareValues(channelValue(a, key), channelValue(b, key)),
  );
}

export function wireChannelSort(onSort: () => void): void {
  const headers = byId('channel-rows').closest('table')?.querySelectorAll('thead th');
  const columns: Array<[ChannelSortKey, number]> = [
    ['id', 0],
    ['name', 1],
    ['handle', 2],
  ];
  for (const [key, index] of columns) {
    const cell = headers?.[index];
    if (!cell) continue;
    const text = cell.textContent ?? '';
    const replacement = sorter.header(key, text, onSort);
    cell.replaceWith(replacement);
  }
}

export function renderChannels(): void {
  const body = byId('channel-rows');
  const draft = getDraft();
  body.replaceChildren();
  sortedChannels(draft.rules.channels, sorter.state()).forEach((channel) => {
    const idInput = h('input', {
      className: 'input entity-input',
      value: channel.id,
      placeholder: 'UC…',
      autocomplete: 'off',
    });
    idInput.addEventListener('input', () => {
      channel.id = idInput.value.trim();
      delete channel.lookupFailed;
      setDirty(true);
    });

    const remove = h('button', {
      type: 'button',
      className: 'btn btn-danger',
      text: t('remove'),
    });
    remove.addEventListener('click', () => {
      removeChannel(draft.rules, { id: channel.id, handle: channel.handle, name: channel.name });
      renderChannels();
      setDirty(true);
    });

    body.appendChild(
      h(
        'tr',
        {},
        h('td', {}, idInput),
        h('td', {
          className: 'entity-readonly',
          text: channel.name || (channel.lookupFailed ? t('notFound') : '—'),
        }),
        h('td', {
          className: 'entity-readonly',
          text: channel.handle ? `@${channel.handle}` : '—',
        }),
        h('td', { className: 'col-action' }, remove),
      ),
    );
  });
  updateCounts();
}

export async function addChannel(): Promise<void> {
  const draft = getDraft();
  const input = byId<HTMLInputElement>('channel-add');
  const parsed = parseBlockInput(input.value, 'channel');
  if (parsed?.kind !== 'channel') {
    setStatus('channel-status', t('channelsPasteInvalid'), false);
    return;
  }

  const id = parsed.channelId ?? '';
  const handle = parsed.handle ?? '';
  const entry: ChannelEntry = { id, name: '', handle };
  if (!addChannelRule(draft.rules, entry)) {
    setStatus('channel-status', t('channelsAlready'), false);
    return;
  }

  input.value = '';
  renderChannels();
  setDirty(true);

  const stored = findChannel(draft.rules, entry);
  if (!stored) {
    setStatus('channel-status', t('channelsAdded'), true);
    return;
  }

  setStatus('channel-status', t('channelsLooking'), true);

  try {
    const meta = await resolveChannel({ id, handle });
    if (handle && !meta.name && !meta.id) {
      const index = draft.rules.channels.indexOf(stored);
      if (index !== -1) draft.rules.channels.splice(index, 1);
      renderChannels();
      setDirty(true);
      setStatus('channel-status', t('channelsNotFound', `@${handle}`), false);
      return;
    }
    const conflict = draft.rules.channels.find(
      (channel) =>
        channel !== stored && channelMatches(channel, { id: meta.id, handle: meta.handle }),
    );
    if (conflict) {
      const index = draft.rules.channels.indexOf(stored);
      if (index !== -1) draft.rules.channels.splice(index, 1);
      if (meta.id && !conflict.id) conflict.id = meta.id;
      if (meta.name && !conflict.name) conflict.name = meta.name;
      if (meta.handle && !conflict.handle) conflict.handle = meta.handle;
      renderChannels();
      setDirty(true);
      setStatus('channel-status', t('channelsAlready'), false);
      return;
    }
    if (meta.id) stored.id = meta.id;
    if (meta.name) stored.name = meta.name;
    if (meta.handle) stored.handle = meta.handle;
    renderChannels();
    setDirty(true);
    setStatus(
      'channel-status',
      stored.name ? t('addedNamed', stored.name) : t('channelsAdded'),
      true,
    );
  } catch {
    setStatus('channel-status', t('channelsFetchFailed'), false);
  }
}
