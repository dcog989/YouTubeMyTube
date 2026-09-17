import { compileRules } from '../shared/matcher';
import type { BlockerState, CompiledRules } from '../shared/types';

let state: BlockerState | null = null;
let compiled: CompiledRules | null = null;

export function getState(): BlockerState | null {
  return state;
}

export function getCompiled(): CompiledRules | null {
  return compiled;
}

export function setState(next: BlockerState): void {
  state = next;
  compiled = compileRules(next.rules);
}
