import type { Reason } from './reason';
import type { ChannelLookup } from './rules';
import { requestMutation } from './runtime';
import type { BlockerState, ChannelEntry, VideoEntry } from './types';

export function setEnabled(enabled: boolean): Promise<BlockerState | null> {
  return requestMutation({ kind: 'setEnabled', enabled });
}

export function completeOnboarding(): Promise<BlockerState | null> {
  return requestMutation({ kind: 'completeOnboarding' });
}

export function blockVideo(entry: VideoEntry): Promise<BlockerState | null> {
  return requestMutation({ kind: 'blockVideo', entry });
}

export function unblockVideo(videoId: string): Promise<BlockerState | null> {
  return requestMutation({ kind: 'unblockVideo', videoId });
}

export function blockChannel(entry: ChannelEntry): Promise<BlockerState | null> {
  return requestMutation({ kind: 'blockChannel', entry });
}

export function unblockChannel(lookup: ChannelLookup): Promise<BlockerState | null> {
  return requestMutation({ kind: 'unblockChannel', lookup });
}

export function unblockReason(reason: Reason | null): Promise<BlockerState | null> {
  if (!reason) return Promise.resolve(null);
  return requestMutation({ kind: 'unblockReason', reason });
}
