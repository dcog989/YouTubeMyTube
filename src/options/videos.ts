import { t } from '../shared/i18n';
import { parseBlockInput, resolveVideoTitle } from '../shared/resolve';
import { addVideo as addVideoRule } from '../shared/rules';
import type { VideoEntry } from '../shared/types';
import { byId } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { removeLabelFor, renderEntityTable } from './entity-table';
import { createTableSorter, type SortColumns } from './sort';
import { getDraft, isDirty, setDirty } from './state';

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

export function renderVideos(force = false): void {
  const body = byId('video-rows');
  if (!force && isDirty() && body.contains(document.activeElement)) {
    updateCounts();
    return;
  }
  const draft = getDraft();
  renderEntityTable({
    bodyId: 'video-rows',
    items: sorter.sort(draft.rules.videos),
    idOf: (video) => video.id,
    setId: (video, value) => {
      video.id = value;
      delete video.lookupFailed;
      setDirty(true);
    },
    placeholder: '11-character ID',
    columns: [(video) => video.title || (video.lookupFailed ? t('notFound') : '—')],
    removeLabel: (video) => removeLabelFor(video.id || video.title),
    onRemove: (video) => {
      const index = draft.rules.videos.indexOf(video);
      if (index !== -1) draft.rules.videos.splice(index, 1);
      renderVideos(true);
      setDirty(true);
    },
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
  renderVideos(true);
  setDirty(true);
  setStatus('video-status', t('videosLooking'), true);

  try {
    const title = await resolveVideoTitle(entry.id);
    if (!getDraft().rules.videos.includes(entry)) {
      setStatus('video-status', '', true);
      return;
    }
    if (title) entry.title = title;
    renderVideos();
    setDirty(true);
    setStatus('video-status', entry.title ? t('addedNamed', entry.title) : t('videosAdded'), true);
  } catch {
    setStatus('video-status', t('videosFetchFailed'), false);
  }
}
