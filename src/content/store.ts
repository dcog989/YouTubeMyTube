import { compileRules } from '../shared/rules';
import type { BlockerState, CompiledRules } from '../shared/types';

export interface Snapshot {
  state: BlockerState;
  compiled: CompiledRules;
}

let snapshot: Snapshot | null = null;

export interface Store {
  getSnapshot(): Snapshot | null;
  // Pass `compiled` to reuse rules that did not change instead of recompiling them.
  setState(next: BlockerState, compiled?: CompiledRules): void;
}

export const store: Store = {
  getSnapshot() {
    return snapshot;
  },
  setState(next, compiled) {
    snapshot = { state: next, compiled: compiled ?? compileRules(next.rules) };
  },
};

export interface ApplyDecision {
  // Whether the page must re-run filtering and the block evaluation.
  rescans: boolean;
  // Whether the card/comment filter must re-run; area-only changes need none.
  refilter: boolean;
  // Whether the previous compiled rules can be reused.
  rulesEqual: boolean;
}

// Theme and onboarding changes cannot change what is hidden or where a page redirects.
export function applyDecision(previous: BlockerState | null, next: BlockerState): ApplyDecision {
  if (!previous) return { rescans: true, refilter: true, rulesEqual: false };
  const rulesEqual = JSON.stringify(previous.rules) === JSON.stringify(next.rules);
  const enabledChanged = previous.settings.enabled !== next.settings.enabled;
  const areasChanged = JSON.stringify(previous.areas) !== JSON.stringify(next.areas);
  return {
    rulesEqual,
    refilter: !rulesEqual || enabledChanged,
    rescans: !rulesEqual || enabledChanged || areasChanged,
  };
}
