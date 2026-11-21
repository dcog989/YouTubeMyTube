import { applyMutation, type MetadataFix, type Mutation } from '../shared/mutations';
import { resolveChannelMeta, resolveVideoTitle } from '../shared/resolve';
import { isChannelComplete } from '../shared/rules';
import { requestMutation } from '../shared/runtime';
import type { ChannelEntry, VideoEntry } from '../shared/types';
import { commit, getDraft, getRevision, isDirty, notify } from './state';

const MAX_BACKFILL_LOOKUPS = 100;
const BACKFILL_LOOKUP_DELAY = 100;
const MAX_CONSECUTIVE_FAILURES = 3;

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

// isChannelComplete excludes entries whose lookup already failed; those are
// only retried after the entry is edited, which clears the flag. A name-only
// row is a deliberate broad rule, not a missing lookup, so it is never retried.
function needsChannelBackfill(channel: ChannelEntry): boolean {
  return !isChannelComplete(channel) && Boolean(channel.id || channel.handle);
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
    if (changed) notify();
    return changed;
  }
  const revision = getRevision();
  const saved = await requestMutation(mutation);
  if (saved && !isDirty() && getRevision() === revision) {
    commit(saved);
    notify();
  }
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

  const meta = await resolveChannelMeta(target.entry);
  if (!channelTargetUnchanged(target)) return null;

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

  const title = await resolveVideoTitle(target.id);
  if (!videoTargetUnchanged(target)) return null;

  return { kind: 'video', videoId: target.id, title, failed: !title };
}

interface ResolveOutcome {
  fixes: MetadataFix[];
  stopped: boolean;
}

async function resolveTargets(targets: BackfillTarget[]): Promise<ResolveOutcome> {
  const fixes: MetadataFix[] = [];
  let failures = 0;
  for (const [index, target] of targets.entries()) {
    if (index > 0) await delay(BACKFILL_LOOKUP_DELAY);
    try {
      const fix =
        target.kind === 'channel'
          ? await resolveChannelTarget(target)
          : await resolveVideoTarget(target);
      if (fix) fixes.push(fix);
      failures = 0;
    } catch {
      // Transient failures stay retryable; repeated ones mean YouTube is
      // refusing us, so stop instead of hammering it.
      failures += 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) return { fixes, stopped: true };
    }
  }
  return { fixes, stopped: false };
}

export function backfillMissing(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runBackfill().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// One persist per round of lookups, so open YouTube tabs rescan once instead of
// once per entry.
async function runBackfill(): Promise<void> {
  let used = 0;
  for (;;) {
    const targets = collectTargets();
    if (targets.length === 0) return;
    const budget = MAX_BACKFILL_LOOKUPS - used;
    if (budget <= 0) return;
    const batch = targets.slice(0, budget);
    const { fixes, stopped } = await resolveTargets(batch);
    used += batch.length;
    if (fixes.length > 0 && !(await persistFixes(fixes))) return;
    if (stopped) {
      console.warn('YouTubeMyTube: metadata backfill paused after repeated lookup failures');
      return;
    }
    if (fixes.length === 0) return;
  }
}
