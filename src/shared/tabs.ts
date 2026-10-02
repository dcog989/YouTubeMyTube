export async function queryActiveTab(): Promise<browser.tabs.Tab | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function sendTabMessage<T>(tabId: number, message: unknown): Promise<T | undefined> {
  try {
    const response = await browser.tabs.sendMessage(tabId, message, { frameId: 0 });
    return response as T | undefined;
  } catch {
    return undefined;
  }
}
