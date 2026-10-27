import type { Reason } from './reason';
import {
  addChannel,
  addVideo,
  applyResolvedMeta,
  type ChannelLookup,
  findChannel,
  findVideo,
  removeChannel,
  removeVideo,
} from './rules';
import type { BlockerState, ChannelEntry, FilterRules, VideoEntry } from './types';
import { removeRule, ruleRefForReason } from './unblock';

// Metadata lookups (titles, channel ids/names/handles) computed outside the
// worker. Applied by the worker to whatever state is stored when it runs, so a
// background lookup can never overwrite a block made in the meantime.
export type MetadataFix =
  | { kind: 'video'; videoId: string; title: string; failed: boolean }
  | {
      kind: 'channel';
      lookup: ChannelLookup;
      id: string;
      name: string;
      handle: string;
      failed: boolean;
    };

export type Mutation =
  | { kind: 'setEnabled'; enabled: boolean }
  | { kind: 'completeOnboarding' }
  | { kind: 'blockVideo'; entry: VideoEntry }
  | { kind: 'unblockVideo'; videoId: string }
  | { kind: 'blockChannel'; entry: ChannelEntry }
  | { kind: 'unblockChannel'; lookup: ChannelLookup }
  | { kind: 'unblockReason'; reason: Reason }
  | { kind: 'applyMetadata'; fixes: MetadataFix[] }
  | { kind: 'replaceState'; state: BlockerState };

const MUTATION_KINDS = new Set<string>([
  'setEnabled',
  'completeOnboarding',
  'blockVideo',
  'unblockVideo',
  'blockChannel',
  'unblockChannel',
  'unblockReason',
  'applyMetadata',
  'replaceState',
]);

export function isMutation(value: unknown): value is Mutation {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && MUTATION_KINDS.has(kind);
}

type InPlaceMutation = Exclude<Mutation, { kind: 'replaceState' }>;

interface LookupMarked {
  lookupFailed?: boolean;
}

function setLookupFailed(entry: LookupMarked, failed: boolean): boolean {
  if (failed === Boolean(entry.lookupFailed)) return false;
  if (failed) entry.lookupFailed = true;
  else delete entry.lookupFailed;
  return true;
}

// Applies one lookup result to a stored entry; entries added or edited since the
// lookup started are matched by their original identity (or ignored).
function applyVideoMeta(entry: VideoEntry, fix: Extract<MetadataFix, { kind: 'video' }>): boolean {
  let changed = false;
  if (fix.title && fix.title !== entry.title) {
    entry.title = fix.title;
    changed = true;
  }
  return setLookupFailed(entry, fix.failed) || changed;
}

// Merging goes through the same resolver as the Add box, so a lookup that
// collides with an existing row folds into it instead of leaving a duplicate
// that save-time normalization drops.
function applyChannelMeta(
  rules: FilterRules,
  entry: ChannelEntry,
  fix: Extract<MetadataFix, { kind: 'channel' }>,
): boolean {
  const before = { id: entry.id, name: entry.name, handle: entry.handle };
  const outcome = applyResolvedMeta(rules, entry, fix);
  const changed =
    outcome === 'conflict' ||
    entry.id !== before.id ||
    entry.name !== before.name ||
    entry.handle !== before.handle;
  return setLookupFailed(entry, fix.failed) || changed;
}

function applyMetadataFixes(rules: FilterRules, fixes: MetadataFix[]): boolean {
  let changed = false;
  for (const fix of fixes) {
    if (fix.kind === 'video') {
      const video = findVideo(rules, fix.videoId);
      if (video && applyVideoMeta(video, fix)) changed = true;
    } else {
      const channel = findChannel(rules, fix.lookup);
      if (channel && applyChannelMeta(rules, channel, fix)) changed = true;
    }
  }
  return changed;
}

function applyInPlace(state: BlockerState, mutation: InPlaceMutation): boolean {
  switch (mutation.kind) {
    case 'setEnabled':
      if (state.settings.enabled === mutation.enabled) return false;
      state.settings.enabled = mutation.enabled;
      return true;
    case 'completeOnboarding':
      if (state.settings.onboardingComplete) return false;
      state.settings.onboardingComplete = true;
      return true;
    case 'blockVideo':
      return addVideo(state.rules, mutation.entry);
    case 'unblockVideo':
      return removeVideo(state.rules, mutation.videoId);
    case 'blockChannel':
      return addChannel(state.rules, mutation.entry);
    case 'unblockChannel':
      return removeChannel(state.rules, mutation.lookup);
    case 'unblockReason': {
      const ref = ruleRefForReason(mutation.reason);
      return ref ? removeRule(state.rules, ref) : false;
    }
    case 'applyMetadata':
      return applyMetadataFixes(state.rules, mutation.fixes);
  }
}

// Reduces a serializable mutation onto the owned state. Returns the resulting
// state, or null when nothing changed (or the mutation is a no-op).
export function applyMutation(state: BlockerState, mutation: Mutation): BlockerState | null {
  if (mutation.kind === 'replaceState') return mutation.state;
  return applyInPlace(state, mutation) ? state : null;
}
