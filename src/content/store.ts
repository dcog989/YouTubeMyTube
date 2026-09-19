import { compileRules } from '../shared/matcher';
import type { BlockerState, CompiledRules } from '../shared/types';

export interface Snapshot {
  state: BlockerState;
  compiled: CompiledRules;
}

let snapshot: Snapshot | null = null;

export function getSnapshot(): Snapshot | null {
  return snapshot;
}

export function setState(next: BlockerState): void {
  snapshot = { state: next, compiled: compileRules(next.rules) };
}
