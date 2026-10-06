type StorageItems = Record<string, unknown>;

// Firefox can transiently expose no value while the extension/browser storage
// backend is still starting (bug 1543880, bug 1885297) and the storage API
// itself can throw before it is ready. Retry with backoff so a transient empty
// read is not mistaken for an absent key.
const STORAGE_RETRY_ATTEMPTS = 8;
const STORAGE_RETRY_BASE_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resolves to the stored value, `undefined` when the key is confirmed absent,
// or throws when the storage API keeps failing.
export async function getStored<T>(key: string): Promise<T | undefined> {
  let lastError: unknown;
  for (let attempt = 0; attempt < STORAGE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const stored = await browser.storage.local.get(key);
      if (stored[key] !== undefined) return stored[key] as T;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    await delay(STORAGE_RETRY_BASE_MS * (attempt + 1));
  }
  if (lastError !== undefined) throw lastError;
  return undefined;
}

export function setStored(values: StorageItems): Promise<void> {
  return browser.storage.local.set(values);
}
