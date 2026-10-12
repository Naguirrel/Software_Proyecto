import { useEffect, useState } from "react";

export default function useSessionStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored === null ? initialValue : JSON.parse(stored);
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* filters remain usable without storage */ }
  }, [key, value]);
  return [value, setValue];
}
