import { STATE_KEY, SYNC_REQUEST } from '../shared/constants';
import { buildDnrRules } from '../shared/dnr';
import { getDynamicRules, updateDynamicRules } from '../shared/ext';
import { ensureState, loadState } from '../shared/state';

async function doSync(): Promise<void> {
  const state = await loadState();
  const { rules: addRules, dropped } = buildDnrRules(state);
  if (dropped > 0) {
    console.warn(
      `YouTubeMyTube: ${dropped} DNR rule(s) exceed the browser's regex limit and are enforced in-page only.`,
    );
  }
  const existing = await getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  await updateDynamicRules({ removeRuleIds, addRules });
}

let queue: Promise<void> = Promise.resolve();

function syncDynamicRules(): Promise<void> {
  queue = queue.then(doSync).catch((error) => {
    console.error('DNR sync failed', error);
  });
  return queue;
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureState().then(syncDynamicRules);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STATE_KEY]) return;
  void syncDynamicRules();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  if ((message as { type?: unknown }).type !== SYNC_REQUEST) return;
  void syncDynamicRules().then(() => sendResponse({ ok: true }));
  return true;
});

void ensureState().then(syncDynamicRules);
