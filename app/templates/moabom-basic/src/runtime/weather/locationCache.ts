import type { Weather_Location } from './types';
import { WEATHER_LOCATION_LOCALCACHE_TTL_MS } from './constants';

const STORAGE_KEY = 'moabom_weather_browser_location_cache';

interface LocationCacheEntry {
  location: Weather_Location;
  /** ISO 8601 문자열. `Date.parse` 로 비교 가능. */
  cachedAt: string;
}

/**
 * 브라우저 Geolocation 결과를 24 시간 TTL 로 캐시한다(Req 2.3).
 * 쿼터 초과 · JSON 직렬화 실패 등은 silent failure 로 처리한다.
 */
export function saveLocationCache(location: Weather_Location): void {
  try {
    const entry: LocationCacheEntry = {
      location,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

/**
 * TTL 이내의 유효한 위치 캐시를 반환한다. 만료 · 파싱 실패 · 손상은 모두 `null`.
 */
export function loadLocationCache(now: Date = new Date()): Weather_Location | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocationCacheEntry>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.location || typeof parsed.cachedAt !== 'string') return null;

    const cachedAt = Date.parse(parsed.cachedAt);
    if (!Number.isFinite(cachedAt)) return null;

    const elapsed = now.getTime() - cachedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > WEATHER_LOCATION_LOCALCACHE_TTL_MS) {
      return null;
    }

    const { lat, lon, label } = parsed.location;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

    return {
      lat,
      lon,
      label: typeof label === 'string' ? label : undefined,
    };
  } catch {
    return null;
  }
}
