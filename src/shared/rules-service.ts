import type { Reason } from './reason';
import { addChannel, addVideo, removeChannel, removeVideo } from './rules';
import { mutateState } from './state';
import type { BlockerState, ChannelEntry, VideoEntry } from './types';
import { removeRule, ruleRefForReason } from './unblock';

export function blockVideo(entry: VideoEntry): Promise<BlockerState | null> {
  return mutateState((state) => addVideo(state.rules, entry));
}

export function unblockVideo(videoId: string): Promise<BlockerState | null> {
  return mutateState((state) => removeVideo(state.rules, videoId));
}

export function blockChannel(entry: ChannelEntry): Promise<BlockerState | null> {
  return mutateState((state) => addChannel(state.rules, entry));
}

export function unblockChannel(lookup: {
  id?: string | null;
  handle?: string | null;
}): Promise<BlockerState | null> {
  return mutateState((state) => removeChannel(state.rules, lookup));
}

export function unblockReason(reason: Reason | null): Promise<BlockerState | null> {
  const ref = ruleRefForReason(reason);
  if (!ref) return Promise.resolve(null);
  return mutateState((state) => removeRule(state.rules, ref));
}
