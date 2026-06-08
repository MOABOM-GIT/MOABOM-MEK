import type { Weather_Location, WeatherLocationSource } from './types';

/**
 * 브라우저 Geolocation 호출 결과를 표현하는 sum type.
 * `denied` 는 권한 거부, `error` 는 타임아웃/미지원 등 기타 실패, `skipped` 는 호출을 건너뛴 경우(세션 내 이전 거부).
 */
export type BrowserGeolocationResult =
  | { kind: 'success'; location: Weather_Location }
  | { kind: 'denied' }
  | { kind: 'error' }
  | { kind: 'skipped' };

/**
 * Weather_Geolocate_API 호출 결과. `empty` 는 외부가 200 OK 로 빈 객체를 반환한 경우이다(Req 7.9).
 */
export type ServerIpGeolocationResult =
  | { kind: 'success'; location: Weather_Location }
  | { kind: 'empty' }
  | { kind: 'error' }
  | { kind: 'skipped' };

export interface ResolveWeatherLocationInput {
  browserResult: BrowserGeolocationResult;
  serverIpResult: ServerIpGeolocationResult;
  /** 현재 세션에서 Geolocation 권한이 이미 거부됐는지(Req 2.4). */
  geoDeniedInSession: boolean;
}

export interface ResolveWeatherLocationOutput {
  source: WeatherLocationSource;
  location: Weather_Location | null;
}

/**
 * Req 2.1–2.6 의 2단계 우선순위를 단일 결정적 함수로 표현한다.
 *
 * 우선순위:
 *  1. `geoDeniedInSession === false` 이고 `browserResult.kind === 'success'` → `'browser_geolocation'`.
 *  2. `serverIpResult.kind === 'success'` → `'server_ip'`.
 *  3. 그 외 → `'unavailable'` (location 은 null).
 *
 * Property 2(P-Location-Priority) 의 테스트 대상. 순수 함수이므로
 * `{ browserResult, serverIpResult, geoDeniedInSession }` 를 fast-check 로 전수 탐색 가능하다.
 */
export function resolveWeatherLocation(
  input: ResolveWeatherLocationInput,
): ResolveWeatherLocationOutput {
  if (!input.geoDeniedInSession && input.browserResult.kind === 'success') {
    return {
      source: 'browser_geolocation',
      location: { ...input.browserResult.location },
    };
  }

  if (input.serverIpResult.kind === 'success') {
    return {
      source: 'server_ip',
      location: { ...input.serverIpResult.location },
    };
  }

  return { source: 'unavailable', location: null };
}
