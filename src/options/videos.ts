import { t } from '../shared/i18n';
import { parseBlockInput, resolveVideoTitle } from '../shared/resolve';
import { addVideo as addVideoRule } from '../shared/rules';
import type { VideoEntry } from '../shared/types';
import { byId, h } from '../shared/ui';
import { updateCounts } from './counts';
import { setStatus } from './dom';
import { focusRemove, removeLabelFor, renderEntityTable } from './entity-table';
import { videoLookupApplies } from './lookup';
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

let videoFilter = '';

function matchesVideoFilter(video: VideoEntry): boolean {
  if (!videoFilter) return true;
  return [video.id, video.title].some((field) => field.toLowerCase().includes(videoFilter));
}

export function setVideoFilter(value: string): void {
  videoFilter = value.trim().toLowerCase();
  renderVideos(true);
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
    items: sorter.sort(draft.rules.videos.filter(matchesVideoFilter)),
    idOf: (video) => video.id,
    setId: (video, value) => {
      if (video.id === value) return;
      // The title belongs to the old id.
      video.id = value;
      video.title = '';
      delete video.lookupFailed;
      setDirty(true);
    },
    placeholder: '11-character ID',
    columns: [(video) => video.title || (video.lookupFailed ? t('notFound') : '—')],
    removeLabel: (video) => removeLabelFor(video.id || video.title),
    onRemove: (video, index) => {
      const draftIndex = draft.rules.videos.indexOf(video);
      if (draftIndex !== -1) draft.rules.videos.splice(draftIndex, 1);
      renderVideos(true);
      setDirty(true);
      focusRemove('video-rows', index, 'video-add');
    },
  });
  renderAllowedVideos();
  updateCounts();
}

// Videos allowed from the player cover are not blocks, so they sit in their own
// list while staying visible and removable instead of becoming hidden state.
function renderAllowedVideos(): void {
  const draft = getDraft();
  const rows = document.createDocumentFragment();
  for (const id of draft.rules.allowedVideos) {
    const remove = h('button', { type: 'button', className: 'btn btn-danger', text: t('remove') });
    remove.setAttribute('aria-label', removeLabelFor(id));
    remove.addEventListener('click', () => {
      const index = draft.rules.allowedVideos.indexOf(id);
      if (index === -1) return;
      draft.rules.allowedVideos.splice(index, 1);
      renderAllowedVideos();
      setDirty(true);
    });
    rows.append(
      h(
        'tr',
        {},
        h('td', { className: 'entity-readonly', text: id }),
        h('td', { className: 'col-action' }, remove),
      ),
    );
  }
  byId('allowed-video-rows').replaceChildren(rows);
  byId('allowed-videos-group').hidden = draft.rules.allowedVideos.length === 0;
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
  setDirty(true);
  setStatus('video-status', t('videosLooking'), true);

  const id = entry.id;
  try {
    const title = await resolveVideoTitle(id);
    if (!videoLookupApplies(getDraft().rules, entry, id)) {
      setStatus('video-status', '', true);
      return;
    }
    if (title) entry.title = title;
    renderVideos();
    setDirty(true);
    setStatus('video-status', entry.title ? t('addedNamed', entry.title) : t('videosAdded'), true);
  } catch {
    renderVideos();
    setStatus('video-status', t('videosFetchFailed'), false);
  }
}
