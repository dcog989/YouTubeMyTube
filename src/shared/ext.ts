import { SYNC_REQUEST } from './constants';

type StorageItems = Record<string, unknown>;

export function getStored<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (items) => {
      resolve(items[key] as T | undefined);
    });
  });
}

export function setStored(values: StorageItems): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}

export function getRuntimeUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

export function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
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
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: SYNC_REQUEST }, () => resolve());
  });
}

export function onLocalStorageChanged(listener: (newValue: unknown) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes.state;
    if (!change) return;
    listener(change.newValue);
  });
}

export function getDynamicRules(): Promise<chrome.declarativeNetRequest.Rule[]> {
  return new Promise((resolve) => {
    chrome.declarativeNetRequest.getDynamicRules((rules) => resolve(rules));
  });
}

export function updateDynamicRules(
  options: chrome.declarativeNetRequest.UpdateRuleOptions,
): Promise<void> {
  return new Promise((resolve) => {
    chrome.declarativeNetRequest.updateDynamicRules(options, () => resolve());
  });
}
