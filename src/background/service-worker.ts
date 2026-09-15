import { buildDnrRules } from '../shared/dnr';
import { getDynamicRules, updateDynamicRules } from '../shared/ext';
import { ensureState, loadState } from '../shared/state';

async function syncDynamicRules(): Promise<void> {
  const state = await loadState();
  const addRules = buildDnrRules(state);
  const existing = await getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  await updateDynamicRules({ removeRuleIds, addRules });
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureState().then(syncDynamicRules);
});

chrome.runtime.onStartup.addListener(() => {
  void syncDynamicRules();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.state) return;
  void syncDynamicRules();
});

void ensureState().then(syncDynamicRules);
