import { t } from '../shared/i18n';
import { parseBlockInput, resolveVideoTitle } from '../shared/resolve';
import { addVideo as addVideoRule, removeVideo } from '../shared/rules';
import type { VideoEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { compareValues, createSorter, type SortState } from './sort';
import { getDraft, setDirty } from './state';

const sorter = createSorter('id');

type VideoSortKey = 'id' | 'title';

function videoValue(video: VideoEntry, key: VideoSortKey): string {
  return key === 'title' ? video.title : video.id;
}

function sortedVideos(videos: VideoEntry[], sort: SortState): VideoEntry[] {
  const key = sort.key as VideoSortKey;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...videos].sort((a, b) => factor * compareValues(videoValue(a, key), videoValue(b, key)));
}

export function wireVideoSort(onSort: () => void): void {
  const headers = byId('video-rows').closest('table')?.querySelectorAll('thead th');
  const columns: Array<[VideoSortKey, number]> = [
    ['id', 0],
    ['title', 1],
  ];
  for (const [key, index] of columns) {
    const cell = headers?.[index];
    if (!cell) continue;
    const text = cell.textContent ?? '';
    const replacement = sorter.header(key, text, onSort);
    cell.replaceWith(replacement);
  }
}

export function renderVideos(): void {
  const body = byId('video-rows');
  const draft = getDraft();
  body.replaceChildren();
  sortedVideos(draft.rules.videos, sorter.state()).forEach((video) => {
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
