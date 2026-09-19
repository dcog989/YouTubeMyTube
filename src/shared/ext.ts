import { STATE_KEY, SYNC_REQUEST } from './constants';

type StorageItems = Record<string, unknown>;

export async function getStored<T>(key: string): Promise<T | undefined> {
  const items = await chrome.storage.local.get(key);
  return items[key] as T | undefined;
}

export function setStored(values: StorageItems): Promise<void> {
  return chrome.storage.local.set(values);
}

export function getRuntimeUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

export async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export function sendTabMessage<T>(tabId: number, message: unknown): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      resolve(response as T | undefined);
    });
  });
}

export function openOptionsPage(): void {
  chrome.runtime.openOptionsPage();
}

export function requestSync(): Promise<void> {
  return chrome.runtime.sendMessage({ type: SYNC_REQUEST }).then(() => undefined);
}

export function onLocalStorageChanged(listener: (newValue: unknown) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes[STATE_KEY];
    if (!change) return;
    listener(change.newValue);
  });
}

export function getDynamicRules(): Promise<chrome.declarativeNetRequest.Rule[]> {
  return chrome.declarativeNetRequest.getDynamicRules();
}

export function updateDynamicRules(
  options: chrome.declarativeNetRequest.UpdateRuleOptions,
): Promise<void> {
  return chrome.declarativeNetRequest.updateDynamicRules(options);
}
