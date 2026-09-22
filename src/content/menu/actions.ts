import { t } from '../../shared/i18n';
import { findChannel, hasVideoId } from '../../shared/rules';
import type { ChannelEntry, Entity, FilterRules, VideoEntry } from '../../shared/types';
import { normalizeHandle } from '../../shared/url';

interface MenuActionBase {
  label: string;
  mode: 'block' | 'unblock';
  value: string;
}

export interface VideoMenuAction extends MenuActionBase {
  kind: 'video';
  entry: VideoEntry;
}

export interface ChannelMenuAction extends MenuActionBase {
  kind: 'channel';
  entry: ChannelEntry;
}

export type MenuAction = VideoMenuAction | ChannelMenuAction;

export function actionsFor(entity: Entity, rules: FilterRules): MenuAction[] {
  const actions: MenuAction[] = [];

  if (entity.videoId) {
    const blocked = hasVideoId(rules, entity.videoId);
    actions.push({
      label: t(blocked ? 'menuUnblockVideo' : 'menuBlockVideo'),
      kind: 'video',
      mode: blocked ? 'unblock' : 'block',
      value: entity.videoId,
      entry: { id: entity.videoId, title: entity.title ?? '' },
    });
  }

  if (entity.channelId || entity.handle || entity.channelName) {
    const id = entity.channelId ?? '';
    const handle = entity.handle ? normalizeHandle(entity.handle) : '';
    const name = entity.channelName ?? '';
    const blocked = findChannel(rules, { id, handle, name }) !== undefined;
    actions.push({
      label: t(blocked ? 'menuUnblockChannel' : 'menuBlockChannel'),
      kind: 'channel',
      mode: blocked ? 'unblock' : 'block',
      value: id || handle || name,
      entry: { id, name, handle },
    });
  }

  return actions;
}
