import { MUTATE_REQUEST, SYNC_REQUEST } from './constants';
import type { Mutation } from './mutations';
import type { BlockerState } from './types';

export function getRuntimeUrl(path: string): string {
  return browser.runtime.getURL(path);
}

export function openOptionsPage(): void {
  void browser.runtime.openOptionsPage();
}

export function requestSync(): Promise<void> {
  return browser.runtime.sendMessage({ type: SYNC_REQUEST }).then(() => undefined);
}

// Routes a mutation to the service worker, the single writer of stored state.
export function requestMutation(mutation: Mutation): Promise<BlockerState | null> {
  return browser.runtime
    .sendMessage({ type: MUTATE_REQUEST, mutation })
    .then((response) => (response as BlockerState | null) ?? null);
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
