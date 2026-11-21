import { defaultState } from '../shared/defaults';
import { normalizeState } from '../shared/normalize';
import type { BlockerState } from '../shared/types';
import { byId } from '../shared/ui';
import { classifyExternalChange } from './conflict';

type Listener = () => void;

const listeners = new Set<Listener>();

let draft: BlockerState = defaultState();
let savedSnapshot = '';
let dirty = false;
let external: BlockerState | null = null;
let saving = false;
let revision = 0;

export function getDraft(): BlockerState {
  return draft;
}

export function setDraft(next: BlockerState): void {
  draft = next;
  revision += 1;
}

export function isDirty(): boolean {
  return dirty;
}

export function getRevision(): number {
  return revision;
}

export function subscribe(listener: Listener): void {
  listeners.add(listener);
}

export function notify(): void {
  for (const listener of listeners) listener();
}

export function setDirty(value: boolean): void {
  const save = byId<HTMLButtonElement>('save');
  if (value && !dirty) {
    save.classList.remove('is-attention');
    void save.offsetWidth;
    save.classList.add('is-attention');
  } else if (!value) {
    save.classList.remove('is-attention');
  }
  dirty = value;
  byId('dirty').hidden = !value;
  save.disabled = !value;
  byId<HTMLButtonElement>('discard').disabled = !value;
}

export function discardChanges(): void {
  if (!dirty) return;
  // Keep whatever is actually stored, including a write from another tab.
  const target =
    external ?? (savedSnapshot === '' ? null : (JSON.parse(savedSnapshot) as BlockerState));
  if (target) adoptState(target);
}

function showConflict(): void {
  byId('conflict-warning').hidden = false;
}

function hideConflict(): void {
  byId('conflict-warning').hidden = true;
}

function adoptState(next: BlockerState): void {
  draft = next;
  savedSnapshot = JSON.stringify(draft);
  external = null;
  revision += 1;
  hideConflict();
  notify();
  setDirty(false);
}

export function commit(next: BlockerState): void {
  draft = next;
  savedSnapshot = JSON.stringify(draft);
  external = null;
  revision += 1;
  hideConflict();
}

// The page stays editable during the write; its echo is not a conflict.
export function beginSave(): void {
  saving = true;
  revision += 1;
}

// `saved` is what the worker stored. Returns true when the draft still matches
// it, so the caller may clear the dirty flag.
export function finishSave(saved: BlockerState): boolean {
  saving = false;
  savedSnapshot = JSON.stringify(saved);
  if (external && JSON.stringify(external) === savedSnapshot) external = null;
  const clean = JSON.stringify(normalizeState(draft)) === savedSnapshot;
  if (clean) draft = saved;
  if (external) showConflict();
  else hideConflict();
  return clean;
}

export function failSave(): void {
  saving = false;
  if (external) showConflict();
}

export function handleExternalChange(value: unknown): void {
  const incoming = normalizeState(value);
  const action = classifyExternalChange(incoming, savedSnapshot, dirty, saving);
  switch (action.kind) {
    case 'ignore':
      return;
    case 'saving':
      external = incoming;
      return;
    case 'onboarding':
      if (draft.settings.onboardingComplete !== action.onboardingComplete) {
        draft.settings.onboardingComplete = action.onboardingComplete;
        notify();
      }
      savedSnapshot = JSON.stringify(incoming);
      return;
    case 'adopt':
      adoptState(incoming);
      return;
    case 'conflict':
      external = incoming;
      showConflict();
      return;
  }
}

export function reloadExternal(): void {
  if (external) adoptState(external);
  else hideConflict();
}
