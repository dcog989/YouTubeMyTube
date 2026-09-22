import { normalizeState } from '../shared/normalize';
import {
  type ChannelMeta,
  resolveChannel,
  resolveChannelByName,
  resolveVideoTitle,
} from '../shared/resolve';
import { saveState } from '../shared/state';
import type { ChannelEntry, VideoEntry } from '../shared/types';
import { commit, getDraft, isDirty, notify } from './state';

const MAX_BACKFILL_LOOKUPS = 25;
const BACKFILL_BATCH_DELAY = 250;

let inFlight: Promise<void> | null = null;

interface ChannelTarget {
  entry: ChannelEntry;
  id: string;
  handle: string;
  name: string;
}

interface VideoTarget {
  entry: VideoEntry;
  id: string;
}

function needsChannelBackfill(channel: ChannelEntry): boolean {
  if (channel.lookupFailed) return false;
  if (!channel.name) return true;
  return !channel.id && !channel.handle;
}

function needsVideoBackfill(video: VideoEntry): boolean {
  return !video.lookupFailed && !video.title;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistChanges(): Promise<void> {
  if (!isDirty()) {
    const normalized = normalizeState(getDraft());
    commit(normalized);
    await saveState(normalized);
  }
  notify();
}

async function backfillBatch(): Promise<{ changed: boolean; definitive: number }> {
  const draft = getDraft();
  const channelTargets: ChannelTarget[] = draft.rules.channels
    .filter(needsChannelBackfill)
    .map((entry) => ({ entry, id: entry.id, handle: entry.handle, name: entry.name }));
  const videoTargets: VideoTarget[] = draft.rules.videos
    .filter(needsVideoBackfill)
    .map((entry) => ({ entry, id: entry.id }));

  let changed = false;
  let definitive = 0;
  let lookups = 0;

  for (const target of channelTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!draft.rules.channels.includes(target.entry)) continue;
    if (
      target.entry.id !== target.id ||
      target.entry.handle !== target.handle ||
      target.entry.name !== target.name
    ) {
      continue;
    }
    lookups += 1;

    const nameOnly = !target.id && !target.handle;
    let meta: ChannelMeta | null = null;
    try {
      meta = nameOnly
        ? await resolveChannelByName(target.name)
        : await resolveChannel({ id: target.id, handle: target.handle });
    } catch {
      meta = null;
    }
    if (!meta) continue;
    definitive += 1;

    if (meta.id && meta.id !== target.entry.id) {
      target.entry.id = meta.id;
      changed = true;
    }
    if (meta.name && !nameOnly && meta.name !== target.entry.name) {
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
    } else if (!nameOnly && !target.entry.lookupFailed) {
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
    definitive += 1;

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

  return { changed, definitive };
}

export function backfillMissing(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runBackfill().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runBackfill(): Promise<void> {
  for (;;) {
    const { changed, definitive } = await backfillBatch();
    if (changed) await persistChanges();
    if (definitive === 0) return;
    await delay(BACKFILL_BATCH_DELAY);
  }
}
