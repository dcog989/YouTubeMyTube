type StorageItems = Record<string, unknown>;

// Firefox can transiently expose no value while the extension/browser storage
// backend is still starting (bug 1543880, bug 1885297) and the storage API
// itself can throw before it is ready. Retry only thrown calls: a successful
// read with no key is a genuinely absent key (a fresh install), and treating
// it as "still starting" stalled every first read by the full backoff.
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
      return stored[key] as T | undefined;
    } catch (error) {
      lastError = error;
    }
    await delay(STORAGE_RETRY_BASE_MS * (attempt + 1));
  }
  throw lastError;
}

export function setStored(values: StorageItems): Promise<void> {
  return browser.storage.local.set(values);
}
