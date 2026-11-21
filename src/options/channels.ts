import { t } from '../shared/i18n';
import { type ChannelMeta, parseBlockInput, resolveChannelMeta } from '../shared/resolve';
import { addChannel as addChannelRule, applyResolvedMeta, findChannel } from '../shared/rules';
import type { ChannelEntry } from '../shared/types';
import { byId } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { removeLabelFor, renderEntityTable } from './entity-table';
import { createTableSorter, type SortColumns } from './sort';
import { getDraft, isDirty, setDirty } from './state';

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

export function renderChannels(force = false): void {
  const body = byId('channel-rows');
  if (!force && isDirty() && body.contains(document.activeElement)) {
    updateCounts();
    return;
  }
  const draft = getDraft();
  renderEntityTable({
    bodyId: 'channel-rows',
    items: sorter.sort(draft.rules.channels),
    idOf: (channel) => channel.id,
    setId: (channel, value) => {
      channel.id = value;
      delete channel.lookupFailed;
      setDirty(true);
    },
    placeholder: 'UC…',
    columns: [
      (channel) => channel.name || (channel.lookupFailed ? t('notFound') : '—'),
      (channel) => (channel.handle ? `@${channel.handle}` : '—'),
    ],
    removeLabel: (channel) => removeLabelFor(channel.id || channel.name || channel.handle),
    onRemove: (channel) => {
      const index = draft.rules.channels.indexOf(channel);
      if (index !== -1) draft.rules.channels.splice(index, 1);
      renderChannels(true);
      setDirty(true);
    },
  });
  updateCounts();
}

// Legacy /c/ and /user/ URLs carry no id or handle, so the page has to say
// which channel they belong to before an entry can be added.
async function addLegacyChannel(path: string, raw: string): Promise<void> {
  setStatus('channel-status', t('channelsLooking'), true);

  let meta: ChannelMeta | null;
  try {
    meta = await resolveChannelMeta({ path });
  } catch {
    setStatus('channel-status', t('channelsFetchFailed'), false);
    return;
  }
  if (!meta || (!meta.id && !meta.name)) {
    setStatus('channel-status', t('channelsNotFound', raw), false);
    return;
  }

  const added = addChannelRule(getDraft().rules, {
    id: meta.id,
    name: meta.name,
    handle: meta.handle,
  });
  if (!added) {
    setStatus('channel-status', t('channelsAlready'), false);
    return;
  }

  byId<HTMLInputElement>('channel-add').value = '';
  renderChannels(true);
  setDirty(true);
  setStatus('channel-status', meta.name ? t('addedNamed', meta.name) : t('channelsAdded'), true);
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

  if (parsed.path) {
    await addLegacyChannel(parsed.path, raw);
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
  renderChannels(true);
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
    const meta = await resolveChannelMeta({ id, handle, name });
    const channels = liveChannels();
    if (!channels) {
      setStatus('channel-status', '', true);
      return;
    }
    if (handle && !meta.name && !meta.id) {
      const index = channels.indexOf(stored);
      if (index !== -1) channels.splice(index, 1);
      renderChannels();
      setDirty(true);
      setStatus('channel-status', t('channelsNotFound', bareHandle ? raw : `@${handle}`), false);
      return;
    }
    const outcome = applyResolvedMeta(getDraft().rules, stored, meta);
    if (outcome === 'merged' && !meta.handle) stored.handle = '';
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
