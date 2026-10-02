import { t } from '../shared/i18n';
import { parseBlockInput, resolveVideoTitle } from '../shared/resolve';
import { addVideo as addVideoRule, removeVideo } from '../shared/rules';
import type { VideoEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { createTableSorter, type SortColumns } from './sort';
import { getDraft, setDirty } from './state';

function videoValue(video: VideoEntry, key: string): string {
  return key === 'title' ? video.title : video.id;
}

const VIDEO_COLUMNS: SortColumns = [
  ['id', 0],
  ['title', 1],
];

const sorter = createTableSorter<VideoEntry>('id', VIDEO_COLUMNS, videoValue);

export function wireVideoSort(onSort: () => void): void {
  sorter.wire('video-rows', onSort);
}

export function renderVideos(): void {
  const body = byId('video-rows');
  const draft = getDraft();
  body.replaceChildren();
  sorter.sort(draft.rules.videos).forEach((video) => {
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
      text: t('remove'),
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
        h('td', {
          className: 'entity-readonly',
          text: video.title || (video.lookupFailed ? t('notFound') : '—'),
        }),
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
    setStatus('video-status', t('videosPasteInvalid'), false);
    return;
  }

  const entry: VideoEntry = { id: parsed.videoId, title: '' };
  if (!addVideoRule(draft.rules, entry)) {
    setStatus('video-status', t('videosAlready'), false);
    return;
  }

  input.value = '';
  renderVideos();
  setDirty(true);
  setStatus('video-status', t('videosLooking'), true);

  try {
    const title = await resolveVideoTitle(entry.id);
    if (title) entry.title = title;
    renderVideos();
    setDirty(true);
    setStatus('video-status', entry.title ? t('addedNamed', entry.title) : t('videosAdded'), true);
  } catch {
    setStatus('video-status', t('videosFetchFailed'), false);
  }
}
