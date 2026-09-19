import { defaultState } from '../shared/defaults';
import { normalizeState } from '../shared/normalize';
import type { BlockerState } from '../shared/types';
import { byId } from '../shared/ui';

type Listener = () => void;

const listeners = new Set<Listener>();

let draft: BlockerState = defaultState();
let savedSnapshot = '';
let dirty = false;
let external: BlockerState | null = null;

export function getDraft(): BlockerState {
  return draft;
}

export function setDraft(next: BlockerState): void {
  draft = next;
}

export function isDirty(): boolean {
  return dirty;
}

export function subscribe(listener: Listener): void {
  listeners.add(listener);
}

export function notify(): void {
  for (const listener of listeners) listener();
}

export function setDirty(value: boolean): void {
  dirty = value;
  byId('dirty').hidden = !value;
  byId<HTMLButtonElement>('save').disabled = !value;
}

function showConflict(): void {
  byId('conflict-warning').hidden = false;
}

function hideConflict(): void {
  byId('conflict-warning').hidden = true;
}

export function adoptState(next: BlockerState): void {
  draft = next;
  savedSnapshot = JSON.stringify(draft);
  external = null;
  hideConflict();
  notify();
  setDirty(false);
}

export function commit(next: BlockerState): void {
  draft = next;
  savedSnapshot = JSON.stringify(draft);
  hideConflict();
}

export function handleExternalChange(value: unknown): void {
  const incoming = normalizeState(value);
  if (JSON.stringify(incoming) === savedSnapshot) return;
  external = incoming;
  if (dirty) showConflict();
  else adoptState(incoming);
}

export function reloadExternal(): void {
  if (external) adoptState(external);
  else hideConflict();
}
