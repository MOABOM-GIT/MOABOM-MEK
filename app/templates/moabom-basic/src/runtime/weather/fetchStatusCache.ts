import type { WeatherLocationKey } from './types';

export const WEATHER_FETCH_ERROR_STORAGE_KEY = 'moabom_weather_fetch_error';

/** `useWeatherStatusLabel` 등이 API 오류 상태를 즉시 반영하도록 발화한다. */
export const WEATHER_FETCH_STATUS_EVENT = 'moabom:weather-fetch-status';

/** 오류 상태가 마이페이지 라벨을 점유할 수 있는 최대 시간. */
export const WEATHER_FETCH_ERROR_TTL_MS = 5 * 60 * 1000;

export type WeatherFetchErrorReason = 'network' | 'http_5xx' | 'parse' | 'location_unreliable';

export interface WeatherFetchErrorEntry {
  at: string;
  reason: WeatherFetchErrorReason;
  locationKey: WeatherLocationKey;
}

export interface WeatherFetchErrorReadOptions {
  now?: Date;
  locationKey?: WeatherLocationKey | null;
}

function dispatchFetchStatusChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WEATHER_FETCH_STATUS_EVENT));
  }
}

export function loadWeatherFetchError(): WeatherFetchErrorEntry | null {
  try {
    const raw = localStorage.getItem(WEATHER_FETCH_ERROR_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WeatherFetchErrorEntry>;
    if (
      !parsed
      || typeof parsed !== 'object'
      || typeof parsed.at !== 'string'
      || typeof parsed.reason !== 'string'
      || typeof parsed.locationKey !== 'string'
    ) {
      return null;
    }

    if (parsed.reason !== 'network' && parsed.reason !== 'http_5xx' && parsed.reason !== 'parse' && parsed.reason !== 'location_unreliable') {
      return null;
    }

    return {
      at: parsed.at,
      reason: parsed.reason,
      locationKey: parsed.locationKey,
    };
  } catch {
    return null;
  }
}

export function loadActiveWeatherFetchError(
  options: WeatherFetchErrorReadOptions = {},
): WeatherFetchErrorEntry | null {
  const entry = loadWeatherFetchError();
  if (!entry) return null;
  if (!isWeatherFetchErrorFresh(entry, options.now ?? new Date())) return null;
  if (options.locationKey && entry.locationKey !== options.locationKey) return null;
  return entry;
}

export function saveWeatherFetchError(entry: WeatherFetchErrorEntry): void {
  try {
    localStorage.setItem(WEATHER_FETCH_ERROR_STORAGE_KEY, JSON.stringify(entry));
    dispatchFetchStatusChanged();
  } catch {
    // localStorage 쿼터 초과 등은 무시한다.
  }
}

export function clearWeatherFetchError(): void {
  try {
    const had = localStorage.getItem(WEATHER_FETCH_ERROR_STORAGE_KEY) !== null;
    localStorage.removeItem(WEATHER_FETCH_ERROR_STORAGE_KEY);
    if (had) {
      dispatchFetchStatusChanged();
    }
  } catch {
    // ignore
  }
}

export function isWeatherFetchErrorFresh(
  entry: WeatherFetchErrorEntry,
  now: Date = new Date(),
): boolean {
  const startedAt = Date.parse(entry.at);
  if (!Number.isFinite(startedAt)) return false;

  const elapsed = now.getTime() - startedAt;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= WEATHER_FETCH_ERROR_TTL_MS;
}

export function weatherFetchErrorExpiresAt(entry: WeatherFetchErrorEntry): number | null {
  const startedAt = Date.parse(entry.at);
  if (!Number.isFinite(startedAt)) return null;
  return startedAt + WEATHER_FETCH_ERROR_TTL_MS;
}

export function isWeatherFetchErrorActive(options: WeatherFetchErrorReadOptions = {}): boolean {
  return loadActiveWeatherFetchError(options) !== null;
}
