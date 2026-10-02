import type { Reason } from './reason';
import { addChannel, addVideo, type ChannelLookup, removeChannel, removeVideo } from './rules';
import type { BlockerState, ChannelEntry, VideoEntry } from './types';
import { removeRule, ruleRefForReason } from './unblock';

export type Mutation =
  | { kind: 'setEnabled'; enabled: boolean }
  | { kind: 'completeOnboarding' }
  | { kind: 'blockVideo'; entry: VideoEntry }
  | { kind: 'unblockVideo'; videoId: string }
  | { kind: 'blockChannel'; entry: ChannelEntry }
  | { kind: 'unblockChannel'; lookup: ChannelLookup }
  | { kind: 'unblockReason'; reason: Reason }
  | { kind: 'replaceState'; state: BlockerState };

const MUTATION_KINDS = new Set<string>([
  'setEnabled',
  'completeOnboarding',
  'blockVideo',
  'unblockVideo',
  'blockChannel',
  'unblockChannel',
  'unblockReason',
  'replaceState',
]);

export function isMutation(value: unknown): value is Mutation {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && MUTATION_KINDS.has(kind);
}

type InPlaceMutation = Exclude<Mutation, { kind: 'replaceState' }>;

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
  }
}

// Reduces a serializable mutation onto the owned state. Returns the resulting
// state, or null when nothing changed (or the mutation is a no-op).
export function applyMutation(state: BlockerState, mutation: Mutation): BlockerState | null {
  if (mutation.kind === 'replaceState') return mutation.state;
  return applyInPlace(state, mutation) ? state : null;
}
