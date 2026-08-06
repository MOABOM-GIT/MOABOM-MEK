import type { Weather_Location, Weather_Snapshot } from './types';

/**
 * 서버 프록시 엔드포인트 경로(`moabom-weather` 플러그인이 제공).
 *
 * 2026-06-02 모듈 분리: `/api/modules/moabom-system/weather` →
 * `/api/plugins/moabom-weather/weather`.
 */
const WEATHER_API_BASE = '/api/plugins/moabom-weather/weather';

/** Cloud Run upstream 504(15s) 전에 클라이언트에서 끊는다 */
export const WEATHER_FETCH_TIMEOUT_MS = 8_000;

export type WeatherLang = 'ko' | 'en' | 'ja' | 'zh';

export interface FetchWeatherSnapshotOptions {
  etag?: string | null;
  ifModifiedSince?: string | null;
  signal?: AbortSignal;
}

export type FetchWeatherSnapshotResult =
  | {
    kind: 'ok';
    snapshot: Weather_Snapshot;
    etag: string | null;
    lastModified: string | null;
  }
  | {
    kind: 'not_modified';
    etag: string | null;
    lastModified: string | null;
  }
  | {
    kind: 'error';
    reason: 'network' | 'http_5xx' | 'aborted' | 'parse';
  };

/**
 * Weather_Current_API 를 호출해 Weather_Snapshot 을 가져온다(Req 3.1 · 3.4).
 *
 * - `AbortController.signal` 로 중도 취소 가능.
 * - `etag` · `ifModifiedSince` 옵션이 주어지면 조건부 요청으로 전환하고, 서버가 `304 Not Modified` 응답을 주면
 *   `{ kind: 'not_modified', etag, lastModified }` 를 돌려 기존 스냅샷을 재사용하도록 한다.
 * - 네트워크 실패 · 5xx · 파싱 실패 는 각각 별도 `reason` 으로 분류해 호출자가 stale-while-error 등 정책을 적용할 수 있게 한다.
 */
export async function fetchWeatherSnapshot(
  location: Weather_Location,
  lang: WeatherLang,
  options: FetchWeatherSnapshotOptions = {},
): Promise<FetchWeatherSnapshotResult> {
  const url = buildUrl(`${WEATHER_API_BASE}/current`, {
    lat: location.lat.toString(),
    lon: location.lon.toString(),
    lang,
  });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.ifModifiedSince) headers['If-Modified-Since'] = options.ifModifiedSince;

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), WEATHER_FETCH_TIMEOUT_MS);
  let removeCallerAbort: (() => void) | undefined;
  if (options.signal) {
    if (options.signal.aborted) {
      timeoutCtrl.abort();
    } else {
      const onCallerAbort = () => timeoutCtrl.abort();
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
      removeCallerAbort = () => options.signal?.removeEventListener('abort', onCallerAbort);
    }
  }
  const signal = timeoutCtrl.signal;

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', headers, signal, credentials: 'same-origin' });
  } catch (err) {
    if (isAbortError(err, signal) || isAbortError(err, options.signal)) {
      return { kind: 'error', reason: 'aborted' };
    }
    return { kind: 'error', reason: 'network' };
  } finally {
    clearTimeout(timeoutId);
    removeCallerAbort?.();
  }

  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');

  if (response.status === 304) {
    return { kind: 'not_modified', etag, lastModified };
  }

  if (!response.ok) {
    return { kind: 'error', reason: 'http_5xx' };
  }

  try {
    const json = (await response.json()) as { data?: Weather_Snapshot };
    if (!json || typeof json !== 'object' || !json.data) {
      return { kind: 'error', reason: 'parse' };
    }
    return { kind: 'ok', snapshot: json.data, etag, lastModified };
  } catch {
    return { kind: 'error', reason: 'parse' };
  }
}

/**
 * Weather_Geolocate_API 결과. 서버는 Req 7.9 에 따라 항상 200 OK 를 반환하므로,
 * 네트워크 실패·파싱 실패만 `error` 로 분류한다. 빈 객체 응답은 `empty`.
 */
export type FetchWeatherGeolocateResult =
  | { kind: 'ok'; location: Weather_Location }
  | { kind: 'empty' }
  | { kind: 'error' };

/** 동시·연속 geolocate 호출을 하나의 HTTP 요청으로 합친다(홈 부트 이벤트 레이스 방지). */
let geolocateInflight: Promise<FetchWeatherGeolocateResult> | null = null;

export function __resetWeatherGeolocateInflightForTest(): void {
  geolocateInflight = null;
}

export async function fetchWeatherGeolocate(signal?: AbortSignal): Promise<FetchWeatherGeolocateResult> {
  if (geolocateInflight) {
    return geolocateInflight;
  }

  geolocateInflight = (async (): Promise<FetchWeatherGeolocateResult> => {
    let response: Response;
    try {
      response = await fetch(`${WEATHER_API_BASE}/geolocate`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
        credentials: 'same-origin',
      });
    } catch (err) {
      if (isAbortError(err, signal)) return { kind: 'error' };
      return { kind: 'error' };
    }

    if (!response.ok) return { kind: 'error' };

    try {
      const json = (await response.json()) as { data?: { lat?: number; lon?: number; city?: string; country?: string } };
      const data = json?.data;
      if (!data || Array.isArray(data) || typeof data.lat !== 'number' || typeof data.lon !== 'number') {
        return { kind: 'empty' };
      }
      return {
        kind: 'ok',
        location: {
          lat: data.lat,
          lon: data.lon,
          label: typeof data.city === 'string' && data.city !== ''
            ? (typeof data.country === 'string' && data.country !== ''
              ? `${data.city}, ${data.country}`
              : data.city)
            : undefined,
        },
      };
    } catch {
      return { kind: 'error' };
    }
  })();

  try {
    return await geolocateInflight;
  } finally {
    geolocateInflight = null;
  }
}

function buildUrl(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, value);
  }
  const queryString = query.toString();
  return queryString === '' ? path : `${path}?${queryString}`;
}

function isAbortError(err: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted) return true;
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
    return true;
  }
  return false;
}
