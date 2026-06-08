// Feature: moabom-home-weather-effect, Property 2: location priority (browser → ip → unavailable)
import { describe, it } from 'vitest';
import fc from 'fast-check';

import {
  resolveWeatherLocation,
  type BrowserGeolocationResult,
  type ServerIpGeolocationResult,
} from '../weather/resolveWeatherLocation';
import type { Weather_Location } from '../weather/types';

/**
 * Property 2 — P-Location-Priority.
 *
 * `resolveWeatherLocation` 이 다음 3단계 우선순위를 항상 따른다:
 *   1. geoDeniedInSession === false && browserResult === success → 'browser_geolocation'
 *   2. serverIpResult === success → 'server_ip'
 *   3. 그 외 → 'unavailable' (location === null)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.2.
 */

const arbLocation = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  label: fc.option(fc.string(), { nil: undefined }),
}) as fc.Arbitrary<Weather_Location>;

const arbBrowserResult: fc.Arbitrary<BrowserGeolocationResult> = fc.oneof(
  arbLocation.map((location) => ({ kind: 'success' as const, location })),
  fc.constant({ kind: 'denied' as const }),
  fc.constant({ kind: 'error' as const }),
  fc.constant({ kind: 'skipped' as const }),
);

const arbServerIpResult: fc.Arbitrary<ServerIpGeolocationResult> = fc.oneof(
  arbLocation.map((location) => ({ kind: 'success' as const, location })),
  fc.constant({ kind: 'empty' as const }),
  fc.constant({ kind: 'error' as const }),
  fc.constant({ kind: 'skipped' as const }),
);

describe('Property 2 — P-Location-Priority', () => {
  it('세션 거부 없음 && browser success → browser_geolocation 을 선택한다', () => {
    fc.assert(
      fc.property(
        arbLocation,
        arbServerIpResult,
        (browserLoc, serverIpResult) => {
          const out = resolveWeatherLocation({
            browserResult: { kind: 'success', location: browserLoc },
            serverIpResult,
            geoDeniedInSession: false,
          });
          return out.source === 'browser_geolocation'
            && out.location?.lat === browserLoc.lat
            && out.location?.lon === browserLoc.lon;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('세션 거부 상태면 browser success 를 무시하고 server_ip 로 내려간다', () => {
    fc.assert(
      fc.property(
        arbLocation,
        arbLocation,
        (browserLoc, serverLoc) => {
          const out = resolveWeatherLocation({
            browserResult: { kind: 'success', location: browserLoc },
            serverIpResult: { kind: 'success', location: serverLoc },
            geoDeniedInSession: true,
          });
          return out.source === 'server_ip'
            && out.location?.lat === serverLoc.lat
            && out.location?.lon === serverLoc.lon;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('browser 가 비어있고 server_ip 만 success → server_ip 를 선택한다', () => {
    fc.assert(
      fc.property(
        arbLocation,
        fc.constantFrom(
          { kind: 'denied' as const },
          { kind: 'error' as const },
          { kind: 'skipped' as const },
        ),
        fc.boolean(),
        (serverLoc, nonSuccessBrowser, geoDeniedInSession) => {
          const out = resolveWeatherLocation({
            browserResult: nonSuccessBrowser,
            serverIpResult: { kind: 'success', location: serverLoc },
            geoDeniedInSession,
          });
          return out.source === 'server_ip'
            && out.location?.lat === serverLoc.lat
            && out.location?.lon === serverLoc.lon;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('세 경로 모두 success 가 없는 모든 조합은 unavailable · location === null', () => {
    const nonSuccessBrowser = fc.oneof(
      fc.constant({ kind: 'denied' as const }),
      fc.constant({ kind: 'error' as const }),
      fc.constant({ kind: 'skipped' as const }),
    );
    const nonSuccessServer = fc.oneof(
      fc.constant({ kind: 'empty' as const }),
      fc.constant({ kind: 'error' as const }),
      fc.constant({ kind: 'skipped' as const }),
    );

    fc.assert(
      fc.property(
        nonSuccessBrowser,
        nonSuccessServer,
        fc.boolean(),
        (browserResult, serverIpResult, geoDeniedInSession) => {
          const out = resolveWeatherLocation({
            browserResult,
            serverIpResult,
            geoDeniedInSession,
          });
          return out.source === 'unavailable' && out.location === null;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('임의 입력의 결합 기본 속성 — 각 source 에 맞는 location 필드를 반환한다', () => {
    fc.assert(
      fc.property(
        arbBrowserResult,
        arbServerIpResult,
        fc.boolean(),
        (browserResult, serverIpResult, geoDeniedInSession) => {
          const out = resolveWeatherLocation({
            browserResult,
            serverIpResult,
            geoDeniedInSession,
          });
          switch (out.source) {
            case 'browser_geolocation':
              return (
                browserResult.kind === 'success'
                && !geoDeniedInSession
                && out.location?.lat === browserResult.location.lat
                && out.location?.lon === browserResult.location.lon
              );
            case 'server_ip':
              return (
                serverIpResult.kind === 'success'
                && out.location?.lat === serverIpResult.location.lat
                && out.location?.lon === serverIpResult.location.lon
              );
            case 'unavailable':
              return out.location === null;
            default:
              return false;
          }
        },
      ),
      { numRuns: 300 },
    );
  });

});
