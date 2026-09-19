import { normalizeHandle } from '../../shared/matcher';
import { findChannel, hasVideoId } from '../../shared/rules';
import type { ChannelEntry, Entity, FilterRules, VideoEntry } from '../../shared/types';

export interface MenuAction {
  label: string;
  kind: 'video' | 'channel';
  mode: 'block' | 'unblock';
  value: string;
  entry: VideoEntry | ChannelEntry;
}

export function actionsFor(entity: Entity, rules: FilterRules): MenuAction[] {
  const actions: MenuAction[] = [];

  if (entity.videoId) {
    const blocked = hasVideoId(rules, entity.videoId);
    actions.push({
      label: `${blocked ? 'Unblock' : 'Block'} video`,
      kind: 'video',
      mode: blocked ? 'unblock' : 'block',
      value: entity.videoId,
      entry: { id: entity.videoId, title: entity.title ?? '' },
    });
  }

  if (entity.channelId || entity.handle) {
    const id = entity.channelId ?? '';
    const handle = entity.handle ? normalizeHandle(entity.handle) : '';
    const blocked = findChannel(rules, { id, handle }) !== undefined;
    actions.push({
      label: `${blocked ? 'Unblock' : 'Block'} channel`,
      kind: 'channel',
      mode: blocked ? 'unblock' : 'block',
      value: id || handle,
      entry: { id, name: entity.channelName ?? '', handle },
    });
  }

  return actions;
}
