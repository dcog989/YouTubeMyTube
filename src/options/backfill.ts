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
  kind: 'channel';
  entry: ChannelEntry;
  id: string;
  handle: string;
  name: string;
}

interface VideoTarget {
  kind: 'video';
  entry: VideoEntry;
  id: string;
}

type BackfillTarget = ChannelTarget | VideoTarget;

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

function videoTargetUnchanged(target: VideoTarget): boolean {
  return getDraft().rules.videos.includes(target.entry) && target.entry.id === target.id;
}

function collectTargets(): BackfillTarget[] {
  const draft = getDraft();
  return [
    ...draft.rules.channels.filter(needsChannelBackfill).map(
      (entry): ChannelTarget => ({
        kind: 'channel',
        entry,
        id: entry.id,
        handle: entry.handle,
        name: entry.name,
      }),
    ),
    ...draft.rules.videos
      .filter(needsVideoBackfill)
      .map((entry): VideoTarget => ({ kind: 'video', entry, id: entry.id })),
  ];
}

async function resolveChannelTarget(target: ChannelTarget): Promise<MetadataFix | null> {
  if (!channelTargetUnchanged(target)) return null;

  let meta: ChannelMeta | null = null;
  try {
    meta = await resolveChannelMeta(target.entry);
  } catch {
    meta = null;
  }
  if (!channelTargetUnchanged(target) || !meta) return null;

  return {
    kind: 'channel',
    lookup: { id: target.id, handle: target.handle, name: target.name },
    id: meta.id,
    name: meta.name,
    handle: meta.handle,
    failed: !meta.name,
  };
}

async function resolveVideoTarget(target: VideoTarget): Promise<MetadataFix | null> {
  if (!videoTargetUnchanged(target)) return null;

  let title: string | null = null;
  try {
    title = await resolveVideoTitle(target.id);
  } catch {
    title = null;
  }
  if (!videoTargetUnchanged(target) || title === null) return null;

  return { kind: 'video', videoId: target.id, title, failed: !title };
}

async function resolveTargets(targets: BackfillTarget[]): Promise<MetadataFix[]> {
  const fixes: MetadataFix[] = [];
  let lookups = 0;
  for (const target of targets) {
    if (lookups >= MAX_BACKFILL_LOOKUPS) {
      await delay(BACKFILL_BATCH_DELAY);
      lookups = 0;
    }
    lookups += 1;
    const fix =
      target.kind === 'channel'
        ? await resolveChannelTarget(target)
        : await resolveVideoTarget(target);
    if (fix) fixes.push(fix);
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

// One persist per round of lookups, so open YouTube tabs rescan once instead of
// once per 25 entries.
async function runBackfill(): Promise<void> {
  for (;;) {
    const targets = collectTargets();
    if (targets.length === 0) return;
    const fixes = await resolveTargets(targets);
    if (fixes.length === 0) return;
    if (!(await persistFixes(fixes))) return;
  }
}
