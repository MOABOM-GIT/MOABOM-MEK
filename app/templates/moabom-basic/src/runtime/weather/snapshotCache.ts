import type { Weather_Snapshot, WeatherLocationKey } from './types';

export const WEATHER_SNAPSHOT_STORAGE_KEY = 'moabom_weather_snapshot_cache';

/**
 * 같은 탭에서 스냅샷이 저장될 때 발화하는 커스텀 이벤트.
 *
 * `storage` 이벤트는 다른 탭에서만 발화하므로, 같은 탭 내 다른 화면(마이페이지 등)이 스냅샷 갱신을
 * 즉시 감지하려면 이 이벤트가 필요하다(폴링 지연 없이 near-instant 반영).
 */
export const WEATHER_SNAPSHOT_SAVED_EVENT = 'moabom:weather-snapshot-saved';

/**
 * localStorage 에 보관되는 Weather_Snapshot 캐시 엔트리.
 * `locationKey` 는 `{lat_0_1}:{lon_0_1}:{lang}` 의 0.1° 버킷 · 언어 조합(설계 §3.2).
 */
export interface SnapshotCacheEntry {
  data: Weather_Snapshot;
  etag: string | null;
  lastModified: string | null;
  /** ISO 8601 문자열. `Date.parse` 로 비교 가능한 포맷. */
  fetchedAt: string;
  locationKey: WeatherLocationKey;
}

/**
 * Weather_Snapshot_LocalCache 를 읽어 유효한 엔트리를 반환한다.
 * JSON 파싱 실패 · 쿼터 오류 · 키 부재는 모두 `null` 로 흡수한다.
 */
export function loadSnapshotCache(): SnapshotCacheEntry | null {
  try {
    const raw = localStorage.getItem(WEATHER_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SnapshotCacheEntry>;
    if (!parsed || typeof parsed !== 'object') return null;

    if (
      typeof parsed.fetchedAt !== 'string'
      || typeof parsed.locationKey !== 'string'
      || !parsed.data
      || typeof parsed.data !== 'object'
    ) {
      return null;
    }

    return {
      data: parsed.data as Weather_Snapshot,
      etag: typeof parsed.etag === 'string' ? parsed.etag : null,
      lastModified: typeof parsed.lastModified === 'string' ? parsed.lastModified : null,
      fetchedAt: parsed.fetchedAt,
      locationKey: parsed.locationKey,
    };
  } catch {
    return null;
  }
}

/**
 * Weather_Snapshot_LocalCache 에 덮어쓴다. 쿼터 초과·직렬화 실패는 silent failure(설계 Error Handling).
 */
export function saveSnapshotCache(entry: SnapshotCacheEntry): void {
  try {
    localStorage.setItem(WEATHER_SNAPSHOT_STORAGE_KEY, JSON.stringify(entry));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WEATHER_SNAPSHOT_SAVED_EVENT));
    }
  } catch {
    // localStorage 쿼터 초과 · JSON 직렬화 실패 는 무시한다.
  }
}

/**
 * stale-while-error 경계 판정(Req 3.5 · 3.6).
 *
 * 반환값은 다음과 정확히 동치이다(Property 6 — P-StaleWhileError):
 *   entry !== null
 *   && entry.locationKey === currentLocationKey
 *   && Number.isFinite(Date.parse(entry.fetchedAt))
 *   && (now.getTime() - Date.parse(entry.fetchedAt)) < staleMaxMs.
 *
 * 2시간 경계 직전(2h - 1ms) 은 true, 직후(2h + 1ms) 는 false 를 반환한다.
 */
export function isSnapshotCacheUsableAsStale(
  entry: SnapshotCacheEntry | null,
  now: Date,
  currentLocationKey: WeatherLocationKey,
  staleMaxMs: number,
): boolean {
  if (!entry) return false;
  if (entry.locationKey !== currentLocationKey) return false;

  const fetched = Date.parse(entry.fetchedAt);
  if (!Number.isFinite(fetched)) return false;

  const elapsed = now.getTime() - fetched;
  if (!Number.isFinite(elapsed) || elapsed < 0) return false;

  return elapsed < staleMaxMs;
}
