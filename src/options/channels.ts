import { t } from '../shared/i18n';
import { parseBlockInput, resolveChannel, resolveChannelByName } from '../shared/resolve';
import { addChannel as addChannelRule, applyResolvedMeta, findChannel } from '../shared/rules';
import type { ChannelEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { createTableSorter, type SortColumns } from './sort';
import { getDraft, setDirty } from './state';

function channelValue(channel: ChannelEntry, key: string): string {
  if (key === 'name') return channel.name;
  if (key === 'handle') return channel.handle;
  return channel.id;
}

const CHANNEL_COLUMNS: SortColumns = [
  ['id', 0],
  ['name', 1],
  ['handle', 2],
];

const sorter = createTableSorter<ChannelEntry>('id', CHANNEL_COLUMNS, channelValue);

export function wireChannelSort(onSort: () => void): void {
  sorter.wire('channel-rows', onSort);
}

export function renderChannels(): void {
  const body = byId('channel-rows');
  const draft = getDraft();
  body.replaceChildren();
  sorter.sort(draft.rules.channels).forEach((channel) => {
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
      const index = draft.rules.channels.indexOf(channel);
      if (index !== -1) draft.rules.channels.splice(index, 1);
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
  const raw = input.value.trim();
  const parsed = parseBlockInput(raw, 'channel');
  if (parsed?.kind !== 'channel') {
    setStatus('channel-status', t('channelsPasteInvalid'), false);
    return;
  }

  const id = parsed.channelId ?? '';
  const handle = parsed.handle ?? '';
  const name = parsed.name ?? '';
  const entry: ChannelEntry = { id, name, handle };
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

  const liveChannels = (): ChannelEntry[] | null => {
    const channels = getDraft().rules.channels;
    return channels.includes(stored) ? channels : null;
  };

  try {
    const bareHandle =
      Boolean(handle) && !raw.startsWith('@') && !raw.includes('/') && !raw.includes(':');
    let meta =
      id || handle ? await resolveChannel({ id, handle }) : await resolveChannelByName(name);
    if (!liveChannels()) return;
    if (bareHandle && !meta.name && !meta.id) {
      const byName = await resolveChannelByName(handle);
      if (!liveChannels()) return;
      if (byName.name || byName.id) {
        meta = byName;
        if (!meta.handle) stored.handle = '';
      }
    }
    const channels = liveChannels();
    if (!channels) return;
    if (handle && !meta.name && !meta.id) {
      const index = channels.indexOf(stored);
      if (index !== -1) channels.splice(index, 1);
      renderChannels();
      setDirty(true);
      setStatus('channel-status', t('channelsNotFound', bareHandle ? raw : `@${handle}`), false);
      return;
    }
    const outcome = applyResolvedMeta(getDraft().rules, stored, meta);
    renderChannels();
    setDirty(true);
    if (outcome === 'conflict') {
      setStatus('channel-status', t('channelsAlready'), false);
      return;
    }
    setStatus(
      'channel-status',
      stored.name ? t('addedNamed', stored.name) : t('channelsAdded'),
      true,
    );
  } catch {
    setStatus('channel-status', t('channelsFetchFailed'), false);
  }
}
