type StorageItems = Record<string, unknown>;

export async function getStored<T>(key: string): Promise<T | undefined> {
  const items = await chrome.storage.local.get(key);
  return items[key] as T | undefined;
}

export function setStored(values: StorageItems): Promise<void> {
  return chrome.storage.local.set(values);
}
