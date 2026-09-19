import { parseBlockInput, resolveVideoTitle } from '../shared/resolve';
import { addVideo as addVideoRule, removeVideo } from '../shared/rules';
import type { VideoEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { getDraft, setDirty } from './state';

export function renderVideos(): void {
  const body = byId('video-rows');
  const draft = getDraft();
  body.replaceChildren();
  draft.rules.videos.forEach((video) => {
    const idInput = h('input', {
      className: 'input entity-input',
      value: video.id,
      placeholder: '11-character ID',
      autocomplete: 'off',
    });
    idInput.addEventListener('input', () => {
      video.id = idInput.value.trim();
      delete video.lookupFailed;
      setDirty(true);
    });

    const remove = h('button', {
      type: 'button',
      className: 'btn btn-danger',
      text: 'Remove',
    });
    remove.addEventListener('click', () => {
      removeVideo(draft.rules, video.id);
      renderVideos();
      setDirty(true);
    });

    body.appendChild(
      h(
        'tr',
        {},
        h('td', {}, idInput),
        h('td', { className: 'entity-readonly', text: video.title || '—' }),
        h('td', { className: 'col-action' }, remove),
      ),
    );
  });
  updateCounts();
}

export async function addVideo(): Promise<void> {
  const draft = getDraft();
  const input = byId<HTMLInputElement>('video-add');
  const parsed = parseBlockInput(input.value, 'video');
  if (parsed?.kind !== 'video') {
    setStatus('video-status', 'Paste a video URL or an 11-character video ID.', false);
    return;
  }

  const entry: VideoEntry = { id: parsed.videoId, title: '' };
  if (!addVideoRule(draft.rules, entry)) {
    setStatus('video-status', 'That video is already blocked.', false);
    return;
  }

  input.value = '';
  renderVideos();
  setDirty(true);
  setStatus('video-status', 'Looking up title…', true);

  try {
    const title = await resolveVideoTitle(entry.id);
    if (title) entry.title = title;
    renderVideos();
    setDirty(true);
    setStatus('video-status', entry.title ? `Added ${entry.title}.` : 'Video added.', true);
  } catch {
    setStatus('video-status', 'Video added. Could not fetch title.', false);
  }
}
