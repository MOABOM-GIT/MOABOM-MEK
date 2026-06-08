import { useCallback, useState } from 'react';
import { moabomT, type MoabomTranslateFn } from './moabomT';

/**
 * 로케일 전환 후 번역 캐시가 갱신되면 epoch으로 컴포넌트가 다시 읽도록 합니다.
 * `language`는 `moabomT`·오버레이 동기화 힌트와 동일 시점에 반영된다(레이아웃 효과).
 */
export function useMoabomT(language: string): {
  t: MoabomTranslateFn;
  bumpTranslationEpoch: () => void;
} {
  const [epoch, setEpoch] = useState(0);
  const bumpTranslationEpoch = useCallback(() => {
    setEpoch(e => e + 1);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => moabomT(key, params),
    [language, epoch],
  );

  return { t, bumpTranslationEpoch };
}
