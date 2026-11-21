import type { ChannelMeta } from '../shared/resolve';
import type { ChannelEntry, FilterRules, VideoEntry } from '../shared/types';

export interface ChannelSnapshot {
  id: string;
  name: string;
  handle: string;
}

export type ChannelAddStep = 'stale' | 'not-found' | 'apply';

// The row a lookup started for may be edited, merged or removed while the
// request runs. Re-applying its metadata would overwrite that edit, so every
// outcome for a changed row is discarded.
export function channelAddStep(
  stored: ChannelEntry | undefined,
  before: ChannelSnapshot,
  handle: string,
  meta: ChannelMeta,
): ChannelAddStep {
  if (!stored) return 'stale';
  if (stored.id !== before.id || stored.name !== before.name || stored.handle !== before.handle) {
    return 'stale';
  }
  return handle && !meta.name && !meta.id ? 'not-found' : 'apply';
}

export function videoLookupApplies(rules: FilterRules, entry: VideoEntry, id: string): boolean {
  return rules.videos.includes(entry) && entry.id === id;
}
