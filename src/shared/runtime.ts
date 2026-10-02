import { SYNC_REQUEST } from './constants';

export function getRuntimeUrl(path: string): string {
  return browser.runtime.getURL(path);
}

export function openOptionsPage(): void {
  void browser.runtime.openOptionsPage();
}

export function requestSync(): Promise<void> {
  return browser.runtime.sendMessage({ type: SYNC_REQUEST }).then(() => undefined);
}

type MessageHandler = (
  message: unknown,
  sender: browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

export function onRuntimeMessage(handler: MessageHandler): void {
  browser.runtime.onMessage.addListener(handler);
}

export function onInstalled(listener: () => void): void {
  browser.runtime.onInstalled.addListener(listener);
}
