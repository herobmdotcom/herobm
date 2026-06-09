import { useState, useEffect } from 'react';

export function usePersistedFilter(key: string, defaultValue: string) {
  const [value, setValue] = useState(defaultValue);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        setValue(saved);
      }
    } catch (e) {
      // ignore
    }
    setIsReady(true);
  }, [key]);

  useEffect(() => {
    if (isReady) {
      try {
        sessionStorage.setItem(key, value);
      } catch (e) {
        // ignore
      }
    }
  }, [value, isReady, key]);

  return [value, setValue, isReady] as const;
}
