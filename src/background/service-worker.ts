import { readBackup, shouldSnapshot, writeBackup } from '../shared/backup';
import { MUTATE_REQUEST, SYNC_REQUEST } from '../shared/constants';
import { applyDnrRules, buildDnrRules, getDynamicRules, sameRules } from '../shared/dnr';
import { applyMutation, isMutation } from '../shared/mutations';
import { normalizeState, ruleCount } from '../shared/normalize';
import { onInstalled, onRuntimeMessage, openOptionsPage } from '../shared/runtime';
import { readState, saveState, seedState } from '../shared/state';
import type { BlockerState } from '../shared/types';

async function doSync(): Promise<void> {
  const state = await readState();
  // Abort on a missing key: a transient empty read must not remove every rule.
  if (!state) return;
  const { rules: addRules, dropped } = buildDnrRules(state);
  const existing = await getDynamicRules();
  if (sameRules(existing, addRules)) return;
  if (dropped > 0) {
    console.warn(
      `YouTubeMyTube: ${dropped} DNR rule(s) exceed the browser's rule limits and are enforced in-page only.`,
    );
  }
  const removeRuleIds = existing.map((rule) => rule.id);
  const failedRuleIds = await applyDnrRules(removeRuleIds, addRules);
  if (failedRuleIds.length > 0) {
    console.warn(
      `YouTubeMyTube: ${failedRuleIds.length} DNR rule(s) were rejected by the browser and skipped.`,
    );
  }
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
      // Keep the last state that still had rules so an accidental or buggy
      // wipe is recoverable from the options page.
      if (shouldSnapshot(current, await readBackup())) {
        await writeBackup(current);
      }
      await saveState(normalized);
      await syncDynamicRules();
      return normalized;
    });
  } catch (error) {
    console.error('Mutation failed', error);
    return null;
  }
}

onRuntimeMessage((message, sender, sendResponse) => {
  // Other extensions can send runtime messages too; only the extension's own
  // pages and content scripts may mutate the stored state.
  if (sender.id !== browser.runtime.id) return;
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
  // Only a first install may write defaults. On update the storage backend can
  // transiently read as empty, and seeding would replace the user's rules with
  // defaults; the sync below runs from worker startup anyway.
  if (details.reason !== 'install') return;
  void seedState().then(syncDynamicRules);
  openOptionsPage();
});

async function recoverBackup(): Promise<void> {
  // Only a confirmed-absent state is restored: an empty but present state is
  // the user's own doing and must not be silently undone.
  if (await readState()) return;
  const backup = await readBackup();
  if (!backup || ruleCount(backup.state) === 0) return;
  await saveState(backup.state);
}

async function startup(): Promise<void> {
  try {
    await recoverBackup();
  } catch (error) {
    console.error('Backup recovery failed', error);
  }
  await syncDynamicRules();
}

void startup();
