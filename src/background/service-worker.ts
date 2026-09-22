import { SYNC_REQUEST } from '../shared/constants';
import { buildDnrRules, type DnrRule, getDynamicRules, updateDynamicRules } from '../shared/dnr';
import { onRuntimeMessage } from '../shared/runtime';
import { ensureState, loadState, onLocalStorageChanged } from '../shared/state';

function ruleKey(rule: DnrRule): string {
  const redirect = rule.action.redirect;
  return [
    rule.id,
    rule.condition.regexFilter ?? '',
    redirect?.extensionPath ?? redirect?.url ?? '',
  ].join('\u0000');
}

function sameRules(existing: DnrRule[], next: DnrRule[]): boolean {
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

onLocalStorageChanged(() => {
  void syncDynamicRules();
});

onRuntimeMessage((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  if ((message as { type?: unknown }).type !== SYNC_REQUEST) return;
  void syncDynamicRules().then(() => sendResponse());
  return true;
});

void ensureState().then(syncDynamicRules);
