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

type MessageHandler = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

export function onRuntimeMessage(handler: MessageHandler): void {
  chrome.runtime.onMessage.addListener(handler);
}

export function onInstalled(handler: () => void): void {
  chrome.runtime.onInstalled.addListener(handler);
}
