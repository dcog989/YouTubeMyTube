type StorageItems = Record<string, unknown>;

const STORAGE_RETRY_DELAY = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getStored<T>(key: string): Promise<T | undefined> {
  // Firefox can briefly expose no value during add-on startup/reload
  // (bug 1885297), and very rarely the API itself is not ready yet.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const stored = await chrome.storage.local.get(key);
      if (stored[key] !== undefined || attempt >= 1) return stored[key] as T | undefined;
    } catch (error) {
      if (attempt >= 1) throw error;
    }
    await delay(STORAGE_RETRY_DELAY);
  }
}

export function setStored(values: StorageItems): Promise<void> {
  return chrome.storage.local.set(values);
}
