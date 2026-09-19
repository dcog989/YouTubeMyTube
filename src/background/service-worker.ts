import { STATE_KEY, SYNC_REQUEST } from '../shared/constants';
import { buildDnrRules, getDynamicRules, updateDynamicRules } from '../shared/dnr';
import { ensureState, loadState } from '../shared/state';

function ruleKey(rule: chrome.declarativeNetRequest.Rule): string {
  const redirect = rule.action.redirect;
  return [
    rule.id,
    rule.condition.regexFilter ?? '',
    redirect?.extensionPath ?? redirect?.url ?? '',
  ].join('\u0000');
}

function sameRules(
  existing: chrome.declarativeNetRequest.Rule[],
  next: chrome.declarativeNetRequest.Rule[],
): boolean {
  if (existing.length !== next.length) return false;
  return existing.every((rule, index) => {
    const other = next[index];
    return other !== undefined && ruleKey(rule) === ruleKey(other);
  });
}

async function doSync(): Promise<void> {
  const state = await loadState();
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
  void syncDynamicRules().then(() => sendResponse());
  return true;
});

void ensureState().then(syncDynamicRules);
