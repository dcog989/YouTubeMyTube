import { addChannel, addVideo, removeChannel, removeVideo } from '../../shared/rules';
import { loadState, saveState } from '../../shared/state';
import type { BlockerState, ChannelEntry, FilterRules, VideoEntry } from '../../shared/types';
import type { MenuAction } from './actions';

function applyVideo(rules: FilterRules, entry: VideoEntry, mode: MenuAction['mode']): void {
  if (mode === 'unblock') removeVideo(rules, entry.id);
  else addVideo(rules, entry);
}

function applyChannel(rules: FilterRules, entry: ChannelEntry, mode: MenuAction['mode']): void {
  if (mode === 'unblock') removeChannel(rules, { id: entry.id, handle: entry.handle });
  else addChannel(rules, entry);
}

export async function persistAction(action: MenuAction): Promise<BlockerState> {
  const current = await loadState();
  if (action.kind === 'video') {
    applyVideo(current.rules, action.entry, action.mode);
  } else {
    applyChannel(current.rules, action.entry, action.mode);
  }
  await saveState(current);
  return current;
}
