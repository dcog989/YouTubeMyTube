import { normalizeState } from '../shared/normalize';
import { type ChannelMeta, resolveChannel, resolveVideoTitle } from '../shared/resolve';
import { saveState } from '../shared/state';
import type { ChannelEntry, VideoEntry } from '../shared/types';
import { commit, getDraft, isDirty, notify } from './state';

const MAX_BACKFILL_LOOKUPS = 25;

interface ChannelTarget {
  entry: ChannelEntry;
  id: string;
  handle: string;
}

interface VideoTarget {
  entry: VideoEntry;
  id: string;
}

function needsChannelBackfill(channel: ChannelEntry): boolean {
  return !channel.lookupFailed && !channel.name;
}

function needsVideoBackfill(video: VideoEntry): boolean {
  return !video.lookupFailed && !video.title;
}

export async function backfillMissing(): Promise<void> {
  const draft = getDraft();
  const channelTargets: ChannelTarget[] = draft.rules.channels
    .filter(needsChannelBackfill)
    .map((entry) => ({ entry, id: entry.id, handle: entry.handle }));
  const videoTargets: VideoTarget[] = draft.rules.videos
    .filter(needsVideoBackfill)
    .map((entry) => ({ entry, id: entry.id }));

  let changed = false;
  let lookups = 0;

  for (const target of channelTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!draft.rules.channels.includes(target.entry)) continue;
    if (target.entry.id !== target.id || target.entry.handle !== target.handle) continue;
    lookups += 1;

    let meta: ChannelMeta | null = null;
    try {
      meta = await resolveChannel({ id: target.id, handle: target.handle });
    } catch {
      meta = null;
    }
    if (!meta) continue;

    if (meta.id && meta.id !== target.entry.id) {
      target.entry.id = meta.id;
      changed = true;
    }
    if (meta.name && meta.name !== target.entry.name) {
      target.entry.name = meta.name;
      changed = true;
    }
    if (meta.handle && meta.handle !== target.entry.handle) {
      target.entry.handle = meta.handle;
      changed = true;
    }

    if (meta.name) {
      if (target.entry.lookupFailed) {
        delete target.entry.lookupFailed;
        changed = true;
      }
    } else if (!target.entry.lookupFailed) {
      target.entry.lookupFailed = true;
      changed = true;
    }
  }

  for (const target of videoTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!draft.rules.videos.includes(target.entry)) continue;
    if (target.entry.id !== target.id) continue;
    lookups += 1;

    let title: string | null = null;
    try {
      title = await resolveVideoTitle(target.id);
    } catch {
      title = null;
    }
    if (title === null) continue;

    if (title && title !== target.entry.title) {
      target.entry.title = title;
      changed = true;
    }

    if (title) {
      if (target.entry.lookupFailed) {
        delete target.entry.lookupFailed;
        changed = true;
      }
    } else if (!target.entry.lookupFailed) {
      target.entry.lookupFailed = true;
      changed = true;
    }
  }

  if (!changed) return;

  if (!isDirty()) {
    const normalized = normalizeState(getDraft());
    commit(normalized);
    await saveState(normalized);
  }
  notify();
}
