/**
 * A small localStorage-backed store for per-browser UI data (settings,
 * logs). Works with useSyncExternalStore: { get, set, subscribe, reset }.
 * Values are objects; `fallback` fills missing keys. Storage errors (private
 * mode, full, blocked) only mean the data lasts for this session.
 */
export function createLocalStore(key, fallback) {
  const listeners = new Set();
  let cache;

  const read = () => {
    if (cache !== undefined) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  };

  const write = (next) => {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage blocked or full: keep it for this session only.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    get: read,
    set: (update) =>
      write(typeof update === "function" ? update(read()) : update),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset: () => {
      cache = undefined;
    },
  };
}
