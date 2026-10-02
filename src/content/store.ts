import { compileRules } from '../shared/rules';
import type { BlockerState, CompiledRules } from '../shared/types';

export interface Snapshot {
  state: BlockerState;
  compiled: CompiledRules;
}

let snapshot: Snapshot | null = null;

export interface Store {
  getSnapshot(): Snapshot | null;
  setState(next: BlockerState): void;
}

export const store: Store = {
  getSnapshot() {
    return snapshot;
  },
  setState(next) {
    snapshot = { state: next, compiled: compileRules(next.rules) };
  },
};
