import { blockChannel, blockVideo, unblockChannel, unblockVideo } from '../../shared/rules-service';
import type { BlockerState } from '../../shared/types';
import type { MenuAction } from './actions';

export function persistAction(action: MenuAction): Promise<BlockerState | null> {
  if (action.kind === 'video') {
    return action.mode === 'unblock' ? unblockVideo(action.entry.id) : blockVideo(action.entry);
  }
  return action.mode === 'unblock'
    ? unblockChannel({ id: action.entry.id, handle: action.entry.handle, name: action.entry.name })
    : blockChannel(action.entry);
}
