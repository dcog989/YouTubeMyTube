import { type Reason, type RuleRef, reasonSpec } from './reason';
import { removeChannel, removeVideo } from './rules';
import type { FilterRules } from './types';

export type { RuleRef, RuleRefKind } from './reason';

export function ruleRefForReason(reason: Reason | null): RuleRef | null {
  if (!reason) return null;
  return reasonSpec(reason.kind).ref?.(reason.value) ?? null;
}

export function removeRule(rules: FilterRules, ref: RuleRef): boolean {
  if (ref.kind === 'video') return removeVideo(rules, ref.value);
  if (ref.kind === 'channel') return removeChannel(rules, { id: ref.value });
  return removeChannel(rules, { handle: ref.value });
}
