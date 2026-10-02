import { MUTATE_REQUEST, SYNC_REQUEST } from '../shared/constants';
import { buildDnrRules, type DnrRule, getDynamicRules, updateDynamicRules } from '../shared/dnr';
import { applyMutation, isMutation } from '../shared/mutations';
import { normalizeState } from '../shared/normalize';
import { onInstalled, onRuntimeMessage, openOptionsPage } from '../shared/runtime';
import { onLocalStorageChanged, readState, saveState, seedState } from '../shared/state';
import type { BlockerState } from '../shared/types';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function ruleKey(rule: DnrRule): string {
  return JSON.stringify(canonicalize(rule));
}

function sameRules(existing: DnrRule[], next: DnrRule[]): boolean {
  if (existing.length !== next.length) return false;
  const existingById = new Map(existing.map((rule) => [rule.id, rule]));
  return next.every((rule) => {
    const other = existingById.get(rule.id);
    return other !== undefined && ruleKey(rule) === ruleKey(other);
  });
}

async function doSync(): Promise<void> {
  const state = await readState();
  // Abort on a missing key: a transient empty read must not remove every rule.
  if (!state) return;
  const { rules: addRules, dropped } = buildDnrRules(state);
  const existing = await getDynamicRules();
  if (sameRules(existing, addRules)) return;
  if (dropped > 0) {
    console.warn(
      `YouTubeMyTube: ${dropped} DNR rule(s) exceed the browser's regex limit and are enforced in-page only.`,
    );
  }
  const removeRuleIds = existing.map((rule) => rule.id);
  await updateDynamicRules({ removeRuleIds, addRules });
}

let syncQueue: Promise<void> = Promise.resolve();

function syncDynamicRules(): Promise<void> {
  syncQueue = syncQueue.then(doSync).catch((error) => {
    console.error('DNR sync failed', error);
  });
  return syncQueue;
}

// All stored-state writes funnel through this queue, making the worker the
// single serialized writer across contexts.
let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function handleMutation(mutation: unknown): Promise<BlockerState | null> {
  if (!isMutation(mutation)) return null;
  try {
    return await queueWrite(async () => {
      const current = await readState();
      // Abort on a missing key: a transient empty read must not replace the
      // user's real rules with defaults plus this mutation.
      if (!current) return null;
      const next = applyMutation(current, mutation);
      if (!next) return null;
      const normalized = normalizeState(next);
      await saveState(normalized);
      await syncDynamicRules();
      return normalized;
    });
  } catch (error) {
    console.error('Mutation failed', error);
    return null;
  }
}

onLocalStorageChanged(() => {
  void syncDynamicRules();
});

onRuntimeMessage((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  const type = (message as { type?: unknown }).type;
  if (type === SYNC_REQUEST) {
    void syncDynamicRules().then(() => sendResponse());
    return true;
  }
  if (type === MUTATE_REQUEST) {
    void handleMutation((message as { mutation?: unknown }).mutation).then((state) =>
      sendResponse(state),
    );
    return true;
  }
});

onInstalled((details) => {
  void seedState().then(syncDynamicRules);
  if (details.reason === 'install') openOptionsPage();
});

void syncDynamicRules();
