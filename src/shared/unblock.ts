import type { Reason } from './reason';
import { removeChannel, removeVideo } from './rules';
import type { FilterRules } from './types';
import { normalizeHandle } from './url';

export type RuleRefKind = 'video' | 'channel' | 'handle';

export interface RuleRef {
  kind: RuleRefKind;
  value: string;
}

export function ruleRefForReason(reason: Reason | null): RuleRef | null {
  if (!reason) return null;
  switch (reason.kind) {
    case 'video':
      return { kind: 'video', value: reason.value };
    case 'channel':
      return { kind: 'channel', value: reason.value };
    case 'handle': {
      const value = normalizeHandle(reason.value);
      return value ? { kind: 'handle', value } : null;
    }
    default:
      return null;
  }
}

export function removeRule(rules: FilterRules, ref: RuleRef): boolean {
  if (ref.kind === 'video') return removeVideo(rules, ref.value);
  if (ref.kind === 'channel') return removeChannel(rules, { id: ref.value });
  return removeChannel(rules, { handle: ref.value });
}
