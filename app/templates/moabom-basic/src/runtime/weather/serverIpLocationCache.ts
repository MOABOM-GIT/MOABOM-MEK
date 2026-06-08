import type { Weather_Location } from './types';

/**
 * 서버 IP geolocate 결과 전용 로컬 캐시(1 시간 TTL).
 *
 * 브라우저 Geolocation 전용 `locationCache.ts` 와 분리한 이유:
 *  - 정확도·원본 출처가 다르다. browser 결과는 정확도 높은 GPS 좌표, server IP 결과는
 *    ISP 서브넷 단위로 약 10km 급. 둘을 같은 키로 뒤섞으면 프로필 설정이 바뀌어도
 *    잘못된 캐시가 남을 수 있다.
 *  - TTL 정책도 다르다. browser 는 24 시간, IP 는 1 시간.
 *
 * 저장 형태: `{ location: Weather_Location, cachedAt: ISO 8601 string }`.
 */

const STORAGE_KEY = 'moabom_weather_server_ip_cache';
const TTL_MS = 60 * 60 * 1000;

interface Entry {
  location: Weather_Location;
  cachedAt: string;
}

export function saveServerIpLocationCache(location: Weather_Location): void {
  try {
    const entry: Entry = {
      location,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota · 직렬화 실패는 silent */
  }
}

export function loadServerIpLocationCache(now: Date = new Date()): Weather_Location | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Entry>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.location || typeof parsed.cachedAt !== 'string') return null;

    const cachedAt = Date.parse(parsed.cachedAt);
    if (!Number.isFinite(cachedAt)) return null;

    const elapsed = now.getTime() - cachedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > TTL_MS) {
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
