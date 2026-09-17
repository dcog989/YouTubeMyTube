import { isRulePresent } from '../../shared/matcher';
import type { Entity, FilterRules } from '../../shared/types';

export interface MenuAction {
  label: string;
  key: keyof FilterRules;
  value: string;
  mode: 'block' | 'unblock';
}

function pushAction(
  actions: MenuAction[],
  rules: FilterRules,
  key: keyof FilterRules,
  value: string,
): void {
  const noun = key === 'videoIds' ? 'video' : 'channel';
  const blocked = isRulePresent(rules, key, value);
  actions.push({
    label: `${blocked ? 'Unblock' : 'Block'} ${noun}`,
    key,
    value,
    mode: blocked ? 'unblock' : 'block',
  });
}

export function actionsFor(entity: Entity, rules: FilterRules): MenuAction[] {
  const actions: MenuAction[] = [];
  if (entity.videoId) pushAction(actions, rules, 'videoIds', entity.videoId);
  if (entity.channelId) {
    pushAction(actions, rules, 'channelIds', entity.channelId);
  } else if (entity.handle) {
    pushAction(actions, rules, 'handles', entity.handle.toLowerCase());
  } else if (entity.channelName) {
    pushAction(actions, rules, 'channelNames', entity.channelName);
  }
  return actions;
}
