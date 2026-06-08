import { useEffect, useState } from 'react';

import type { MoabomTranslateFn } from '../../i18n/moabomT';
import {
  loadSnapshotCache,
  WEATHER_SNAPSHOT_SAVED_EVENT,
  WEATHER_SNAPSHOT_STORAGE_KEY,
} from './snapshotCache';
import { formatWeatherStatusLabel } from './weatherConditionLabel';

/**
 * 폴백 폴링 주기(ms). 평상시 갱신은 `WEATHER_SNAPSHOT_SAVED_EVENT`(같은 탭) ·
 * `storage`(다른 탭)로 near-instant 반영되고, 이 폴링은 이벤트 누락 대비 안전망일 뿐이다.
 */
const POLL_INTERVAL_MS = 15_000;

/**
 * 마이페이지 날씨 토글 옆 상태 표시용 뷰 모델.
 *  - `loading`: 토글이 켜졌지만 아직 스냅샷이 없어 로딩 인디케이터를 보여야 하는 상태.
 *  - `label`: 표시할 상태 문자열(`"흐림 · 14°C"`). 없으면 `null`.
 */
export interface WeatherStatusView {
  loading: boolean;
  label: string | null;
}

function readLabel(t: MoabomTranslateFn): string | null {
  if (typeof window === 'undefined') return null;
  const entry = loadSnapshotCache();
  return entry ? formatWeatherStatusLabel(entry.data, t) : null;
}

/**
 * 마이페이지 날씨 토글 옆에 표시할 상태 뷰를 돌려준다(테스트·디버그 가시화).
 *
 * - `enabled` 가 `false`(날씨 토글 off 또는 애니메이션 잠김)이면 `{ loading: false, label: null }`.
 * - 토글은 켜졌지만 스냅샷이 아직 없으면 `{ loading: true, label: null }` → 호출측이 로딩 표시.
 * - 스냅샷이 들어오면 `{ loading: false, label }`.
 * - 추가 HTTP 호출 없이 `localStorage` 스냅샷 캐시만 소비한다.
 *
 * @param lang 언어 변경 시 라벨을 즉시 재계산하기 위한 의존성(값 자체는 사용하지 않는다).
 */
export function useWeatherStatusLabel(
  t: MoabomTranslateFn,
  enabled: boolean,
  lang: string,
): WeatherStatusView {
  // 마운트 시 캐시가 이미 있으면 즉시 라벨로 시작해 로딩 깜빡임을 방지한다.
  const [label, setLabel] = useState<string | null>(() => (enabled ? readLabel(t) : null));

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setLabel(null);
      return () => {};
    }

    let lastFetchedAt: string | null = null;

    const refresh = (): void => {
      const entry = loadSnapshotCache();
      if (!entry) {
        if (lastFetchedAt !== null) {
          lastFetchedAt = null;
          setLabel(null);
        }
        return;
      }
      if (entry.fetchedAt === lastFetchedAt) return;
      lastFetchedAt = entry.fetchedAt;
      setLabel(formatWeatherStatusLabel(entry.data, t));
    };

    refresh();

    const onStorage = (e: StorageEvent): void => {
      if (e.key === null || e.key === WEATHER_SNAPSHOT_STORAGE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(WEATHER_SNAPSHOT_SAVED_EVENT, refresh);
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WEATHER_SNAPSHOT_SAVED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [t, enabled, lang]);

  if (!enabled) return { loading: false, label: null };
  return { loading: label === null, label };
}
