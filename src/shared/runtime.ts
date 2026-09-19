import { SYNC_REQUEST } from './constants';

export function getRuntimeUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

export function openOptionsPage(): void {
  chrome.runtime.openOptionsPage();
}

export function requestSync(): Promise<void> {
  return chrome.runtime.sendMessage({ type: SYNC_REQUEST }).then(() => undefined);
}
