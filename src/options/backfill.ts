import { applyMutation, type MetadataFix, type Mutation } from '../shared/mutations';
import { type ChannelMeta, resolveChannelMeta, resolveVideoTitle } from '../shared/resolve';
import { isChannelComplete } from '../shared/rules';
import { requestMutation } from '../shared/runtime';
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

function needsVideoBackfill(video: VideoEntry): boolean {
  return !video.lookupFailed && !video.title;
}

// A failed lookup is only retried after the entry is edited, which clears the flag.
function needsChannelBackfill(channel: ChannelEntry): boolean {
  return !channel.lookupFailed && !isChannelComplete(channel);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fixes go through the worker's mutation queue so they land on whatever state
// is stored when they run; they can never replace a block made meanwhile. With
// unsaved edits in this page they stay in the draft, and Save persists them.
async function persistFixes(fixes: MetadataFix[]): Promise<boolean> {
  const mutation: Mutation = { kind: 'applyMetadata', fixes };
  if (isDirty()) {
    const changed = applyMutation(getDraft(), mutation) !== null;
    notify();
    return changed;
  }
  const saved = await requestMutation(mutation);
  if (saved && !isDirty()) commit(saved);
  notify();
  return saved !== null;
}

function channelTargetUnchanged(target: ChannelTarget): boolean {
  return (
    getDraft().rules.channels.includes(target.entry) &&
    target.entry.id === target.id &&
    target.entry.handle === target.handle &&
    target.entry.name === target.name
  );
}

async function collectFixes(): Promise<MetadataFix[]> {
  const draft = getDraft();
  const channelTargets: ChannelTarget[] = draft.rules.channels
    .filter(needsChannelBackfill)
    .map((entry) => ({ entry, id: entry.id, handle: entry.handle, name: entry.name }));
  const videoTargets: VideoTarget[] = draft.rules.videos
    .filter(needsVideoBackfill)
    .map((entry) => ({ entry, id: entry.id }));

  const fixes: MetadataFix[] = [];
  let lookups = 0;

  for (const target of channelTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!channelTargetUnchanged(target)) continue;
    lookups += 1;

    let meta: ChannelMeta | null = null;
    try {
      meta = await resolveChannelMeta(target.entry);
    } catch {
      meta = null;
    }
    if (!channelTargetUnchanged(target) || !meta) continue;

    fixes.push({
      kind: 'channel',
      lookup: { id: target.id, handle: target.handle, name: target.name },
      id: meta.id,
      name: meta.name,
      handle: meta.handle,
      failed: !meta.name,
    });
  }

  for (const target of videoTargets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) break;
    if (!getDraft().rules.videos.includes(target.entry)) continue;
    if (target.entry.id !== target.id) continue;
    lookups += 1;

    let title: string | null = null;
    try {
      title = await resolveVideoTitle(target.id);
    } catch {
      title = null;
    }
    if (!getDraft().rules.videos.includes(target.entry) || title === null) continue;
    if (target.entry.id !== target.id) continue;

    fixes.push({ kind: 'video', videoId: target.id, title, failed: !title });
  }

  return fixes;
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
    const fixes = await collectFixes();
    if (fixes.length === 0) return;
    if (!(await persistFixes(fixes))) return;
    await delay(BACKFILL_BATCH_DELAY);
  }
}
