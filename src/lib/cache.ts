// Tiny in-memory cache so navigating back to a screen is INSTANT: we render the
// last-loaded data immediately, then silently refresh in the background
// (stale-while-revalidate). Cleared on sign-out.
const store = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function cacheSet<T>(key: string, value: T): void {
  store.set(key, value);
}

export function cacheClear(prefix?: string): void {
  if (!prefix) { store.clear(); return; }
  for (const k of Array.from(store.keys())) if (k.startsWith(prefix)) store.delete(k);
}
