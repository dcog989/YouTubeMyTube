import { t } from '../shared/i18n';
import { parseBlockInput, resolveChannel } from '../shared/resolve';
import { addChannel as addChannelRule, findChannel, removeChannel } from '../shared/rules';
import type { ChannelEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { getDraft, setDirty } from './state';

export function renderChannels(): void {
  const body = byId('channel-rows');
  const draft = getDraft();
  body.replaceChildren();
  draft.rules.channels.forEach((channel) => {
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
        h('td', { className: 'entity-readonly', text: channel.name || '—' }),
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

  const stored = findChannel(draft.rules, entry);
  if (!stored) {
    setStatus('channel-status', t('channelsAdded'), false);
    return;
  }

  input.value = '';
  renderChannels();
  setDirty(true);
  setStatus('channel-status', t('channelsLooking'), true);

  try {
    const meta = await resolveChannel({ id, handle });
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
