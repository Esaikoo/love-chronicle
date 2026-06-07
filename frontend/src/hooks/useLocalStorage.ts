import { Dispatch, SetStateAction, useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T, legacyKey?: string): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;

      if (legacyKey) {
        const legacyRaw = window.localStorage.getItem(legacyKey);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw) as T;
          window.localStorage.setItem(key, legacyRaw);
          return parsed;
        }
      }

      return initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage may be full or unavailable; keep the UI usable.
    }
  }, [key, value]);

  return [value, setValue];
}
