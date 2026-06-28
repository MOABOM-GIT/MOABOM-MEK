import { useEffect, useState } from 'react';

import type { MoabomTranslateFn } from '../../i18n/moabomT';
import {
  loadActiveWeatherFetchError,
  weatherFetchErrorExpiresAt,
  WEATHER_FETCH_ERROR_STORAGE_KEY,
  WEATHER_FETCH_STATUS_EVENT,
  type WeatherFetchErrorEntry,
} from './fetchStatusCache';
import {
  isSnapshotCacheUsableAsStale,
  loadSnapshotCache,
  WEATHER_SNAPSHOT_SAVED_EVENT,
  WEATHER_SNAPSHOT_STORAGE_KEY,
  type SnapshotCacheEntry,
} from './snapshotCache';
import { formatWeatherStatusLabel } from './weatherConditionLabel';
import { isLocationConsistentWithBrowserTimezone } from './locationPlausibility';
import { WEATHER_SNAPSHOT_STALE_MAX_MS } from './constants';

/**
 * 스냅샷 대기 중 bounded 재시도(ms). 이벤트 누락·청크 로드 직후 API 지연 대비.
 * 상시 폴링 대신 최대 3회만 스케줄해 CPU·storage 읽기를 최소화한다.
 */
const STATUS_RETRY_DELAYS_MS = [800, 2500, 6000] as const;

/**
 * 마이페이지 날씨 토글 옆 상태 표시용 뷰 모델.
 *  - `loading`: 토글이 켜졌지만 아직 스냅샷이 없어 로딩 인디케이터를 보여야 하는 상태.
 *  - `label`: 표시할 상태 문자열(`"흐림 · 14°C"`). 없으면 `null`.
 */
export interface WeatherStatusView {
  loading: boolean;
  label: string | null;
}

interface WeatherStatusReadResult {
  label: string | null;
  errorExpiresAt: number | null;
}

function fetchErrorLabel(entry: WeatherFetchErrorEntry, t: MoabomTranslateFn): string {
  return t(`moa_mypage.weather_status.error_${entry.reason}`);
}

function loadDisplayableSnapshot(now: Date): SnapshotCacheEntry | null {
  const entry = loadSnapshotCache();
  if (!entry) return null;
  if (!isSnapshotCacheUsableAsStale(entry, now, entry.locationKey, WEATHER_SNAPSHOT_STALE_MAX_MS)) {
    return null;
  }
  if (entry.data.location && !isLocationConsistentWithBrowserTimezone(entry.data.location)) {
    return null;
  }
  return entry;
}

function readStatus(t: MoabomTranslateFn, now: Date = new Date()): WeatherStatusReadResult {
  if (typeof window === 'undefined') return { label: null, errorExpiresAt: null };

  const displayableSnapshot = loadDisplayableSnapshot(now);
  if (displayableSnapshot) {
    return {
      label: formatWeatherStatusLabel(displayableSnapshot.data, t),
      errorExpiresAt: null,
    };
  }

  const latestSnapshot = loadSnapshotCache();
  const latestSnapshotUsable = latestSnapshot
    ? isSnapshotCacheUsableAsStale(latestSnapshot, now, latestSnapshot.locationKey, WEATHER_SNAPSHOT_STALE_MAX_MS)
    : false;
  const errorEntry = loadActiveWeatherFetchError({
    now,
    locationKey: latestSnapshotUsable ? latestSnapshot?.locationKey ?? null : null,
  });
  if (errorEntry) {
    return {
      label: fetchErrorLabel(errorEntry, t),
      errorExpiresAt: weatherFetchErrorExpiresAt(errorEntry),
    };
  }

  if (
    latestSnapshot
    && latestSnapshotUsable
    && latestSnapshot.data.location
    && !isLocationConsistentWithBrowserTimezone(latestSnapshot.data.location)
  ) {
    return {
      label: t('moa_mypage.weather_status.error_location_unreliable'),
      errorExpiresAt: null,
    };
  }

  return { label: null, errorExpiresAt: null };
}

function readView(t: MoabomTranslateFn): WeatherStatusView {
  const status = readStatus(t);
  return { loading: status.label === null, label: status.label };
}

/**
 * 마이페이지 날씨 토글 옆에 표시할 상태 뷰를 돌려준다(테스트·디버그 가시화).
 *
 * - `enabled` 가 `false`(날씨 토글 off 또는 애니메이션 잠김)이면 `{ loading: false, label: null }`.
 * - 표시 가능한 스냅샷이 있으면 오류 캐시보다 스냅샷 라벨을 우선 표시한다.
 * - 현재 위치의 활성 오류가 있으면 오류 이유별 상태 라벨을 표시한다.
 * - 토글은 켜졌지만 스냅샷이 아직 없으면 `{ loading: true, label: null }` → 호출측이 로딩 표시.
 * - 스냅샷이 들어오면 `{ loading: false, label }`.
 * - 추가 HTTP 호출 없이 `localStorage` 스냅샷·오류 상태만 소비한다.
 *
 * @param lang 언어 변경 시 라벨을 즉시 재계산하기 위한 의존성(값 자체는 사용하지 않는다).
 */
export function useWeatherStatusLabel(
  t: MoabomTranslateFn,
  enabled: boolean,
  lang: string,
): WeatherStatusView {
  // 마운트 시 캐시가 이미 있으면 즉시 라벨로 시작해 로딩 깜빡임을 방지한다.
  const [view, setView] = useState<WeatherStatusView>(() => (
    enabled ? readView(t) : { loading: false, label: null }
  ));

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setView({ loading: false, label: null });
      return () => {};
    }

    let errorExpiryTimer: number | null = null;

    const clearErrorExpiryTimer = (): void => {
      if (errorExpiryTimer !== null) {
        window.clearTimeout(errorExpiryTimer);
        errorExpiryTimer = null;
      }
    };

    const scheduleErrorExpiryRefresh = (expiresAt: number | null): void => {
      clearErrorExpiryTimer();
      if (expiresAt === null) return;
      const delay = expiresAt - Date.now() + 50;
      if (!Number.isFinite(delay) || delay <= 0) return;
      errorExpiryTimer = window.setTimeout(refresh, delay);
    };

    function refresh(): void {
      const status = readStatus(t);
      scheduleErrorExpiryRefresh(status.errorExpiresAt);
      setView({
        loading: status.label === null,
        label: status.label,
      });
    }

    refresh();

    const onStorage = (e: StorageEvent): void => {
      if (
        e.key === null
        || e.key === WEATHER_SNAPSHOT_STORAGE_KEY
        || e.key === WEATHER_FETCH_ERROR_STORAGE_KEY
      ) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(WEATHER_SNAPSHOT_SAVED_EVENT, refresh);
    window.addEventListener(WEATHER_FETCH_STATUS_EVENT, refresh);
    const retryTimers = STATUS_RETRY_DELAYS_MS.map((ms) => window.setTimeout(refresh, ms));

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WEATHER_SNAPSHOT_SAVED_EVENT, refresh);
      window.removeEventListener(WEATHER_FETCH_STATUS_EVENT, refresh);
      clearErrorExpiryTimer();
      for (const timer of retryTimers) {
        window.clearTimeout(timer);
      }
    };
  }, [t, enabled, lang]);

  if (!enabled) return { loading: false, label: null };
  return view;
}
