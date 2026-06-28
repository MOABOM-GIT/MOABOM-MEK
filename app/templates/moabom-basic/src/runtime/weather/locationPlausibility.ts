import type { Weather_Location, WeatherLocationSource } from './types';

/**
 * 브라우저 IANA 타임존 대략 경계(위도·경도).
 * IP geolocation 오판(예: 한국 사용자에게 미국 좌표)을 걸러낸다.
 */
const TIMEZONE_BOUNDS: Readonly<
  Record<string, { latMin: number; latMax: number; lonMin: number; lonMax: number }>
> = {
  'Asia/Seoul': { latMin: 33, latMax: 43, lonMin: 124, lonMax: 132 },
};

/**
 * 좌표가 브라우저 타임존과 모순되지 않는지 검사한다.
 *
 * 예: 타임존 `Asia/Seoul` 인데 Kansas City(미국) 좌표면 false.
 * 알 수 없는 타임존은 검사하지 않는다(해외 사용자 오탐 방지).
 */
export function isLocationConsistentWithBrowserTimezone(location: Weather_Location): boolean {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return true;

  let timeZone: string;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return true;
  }

  const bounds = TIMEZONE_BOUNDS[timeZone];
  if (!bounds) return true;

  const { lat, lon } = location;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  return (
    lat >= bounds.latMin
    && lat <= bounds.latMax
    && lon >= bounds.lonMin
    && lon <= bounds.lonMax
  );
}

/** `server_ip` 출처일 때만 타임존·좌표 일치를 요구한다. */
export function isServerIpLocationPlausible(
  location: Weather_Location,
  source: WeatherLocationSource,
): boolean {
  if (source !== 'server_ip') return true;
  return isLocationConsistentWithBrowserTimezone(location);
}
