/** localStorage that never throws: private windows, blocked site data and previews all make it fail. */
export const store = {
  read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // not saved: the app works for this visit and asks again next time
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing to remove
    }
  },
};
