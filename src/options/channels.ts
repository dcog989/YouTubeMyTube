import { parseBlockInput, resolveChannel } from '../shared/resolve';
import { addChannel as addChannelRule, removeChannel } from '../shared/rules';
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
      text: 'Remove',
    });
    remove.addEventListener('click', () => {
      removeChannel(draft.rules, { id: channel.id, handle: channel.handle });
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
    setStatus('channel-status', 'Paste a channel URL, @handle, or UC channel ID.', false);
    return;
  }

  const id = parsed.channelId ?? '';
  const handle = parsed.handle ?? '';
  const entry: ChannelEntry = { id, name: '', handle };
  if (!addChannelRule(draft.rules, entry)) {
    setStatus('channel-status', 'That channel is already blocked.', false);
    return;
  }

  input.value = '';
  renderChannels();
  setDirty(true);
  setStatus('channel-status', 'Looking up channel details…', true);

  try {
    const meta = await resolveChannel({ id, handle });
    if (meta.id) entry.id = meta.id;
    if (meta.name) entry.name = meta.name;
    if (meta.handle) entry.handle = meta.handle;
    renderChannels();
    setDirty(true);
    setStatus('channel-status', entry.name ? `Added ${entry.name}.` : 'Channel added.', true);
  } catch {
    setStatus('channel-status', 'Channel added. Could not fetch details.', false);
  }
}
