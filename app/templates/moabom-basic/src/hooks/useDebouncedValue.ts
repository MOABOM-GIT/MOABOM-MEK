import { useEffect, useState } from 'react';

/** 값 변경 후 delayMs 동안 추가 변경이 없을 때만 반영합니다 (미리보기 등 무거운 파생 계산용). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
