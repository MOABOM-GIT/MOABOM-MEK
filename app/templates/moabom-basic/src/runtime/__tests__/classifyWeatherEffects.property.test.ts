// Feature: moabom-home-weather-effect, Property 4: weather_code · air-quality → effect set mapping
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { classifyWeatherEffects } from '../weather/classifyWeatherEffects';
import {
  DUST_PM10_THRESHOLD,
  DUST_RAW_THRESHOLD,
  SMOG_PM25_THRESHOLD,
  WEATHER_CODE_FOG,
  WEATHER_CODE_LIGHTNING,
  WEATHER_CODE_RAIN,
  WEATHER_CODE_SNOW,
} from '../weather/constants';
import type { Weather_Snapshot } from '../weather/types';

/**
 * Property 4 — P-Effect-Classification.
 *
 * `classifyWeatherEffects` 의 반환 집합은 설계 §4 의 6개 등가식을 동시에 만족해야 한다.
 * 특히 weather_code ∈ {95, 96, 99} 에서 rain · lightning 이 동시에 포함되고,
 * rain · snow 는 서로소여야 한다.
 *
 * Validates: Requirements 3.7, 4a.1, 4a.5, 4b.1, 4b.4, 4c.1, 4c.5, 4d.1, 4d.4, 4e.1,
 *            4e.4, 4e.5, 4f.1, 4f.4, 4f.5, 10.4.
 */

function buildSnapshot(
  weatherCode: number,
  pm2_5: number | null,
  pm10: number | null,
  dust: number | null,
): Weather_Snapshot {
  return {
    weather_code: weatherCode,
    wind_speed_10m: 0,
    wind_direction_10m: 0,
    temperature_2m: 0,
    is_day: 1,
    pm2_5,
    pm10,
    dust,
    sunrise: null,
    sunset: null,
    fetched_at: '2026-05-12T00:00:00+09:00',
    location: { lat: 0, lon: 0 },
  };
}

describe('Property 4 — P-Effect-Classification', () => {
  it('6개 등가식을 모든 weather_code × 공기질 조합에서 만족한다', () => {
    const arbNonNegOrNull = fc.oneof(
      fc.constant<number | null>(null),
      fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        arbNonNegOrNull,
        arbNonNegOrNull,
        arbNonNegOrNull,
        (code, pm25, pm10, dust) => {
          const set = classifyWeatherEffects(buildSnapshot(code, pm25, pm10, dust));

          const rainExpected = WEATHER_CODE_RAIN.has(code);
          const snowExpected = WEATHER_CODE_SNOW.has(code);
          const lightningExpected = WEATHER_CODE_LIGHTNING.has(code);
          const fogExpected = WEATHER_CODE_FOG.has(code);
          const smogExpected = pm25 !== null && pm25 >= SMOG_PM25_THRESHOLD;
          const dustExpected =
            (pm10 !== null && pm10 >= DUST_PM10_THRESHOLD)
            || (dust !== null && dust >= DUST_RAW_THRESHOLD);

          return (
            set.has('rain') === rainExpected
            && set.has('snow') === snowExpected
            && set.has('lightning') === lightningExpected
            && set.has('fog') === fogExpected
            && set.has('smog') === smogExpected
            && set.has('dust') === dustExpected
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  it('weather_code ∈ {95, 96, 99} 는 rain 과 lightning 을 동시에 포함한다(Req 4a.5 · 4c.5)', () => {
    for (const code of [95, 96, 99]) {
      const set = classifyWeatherEffects(buildSnapshot(code, null, null, null));
      expect(set.has('rain')).toBe(true);
      expect(set.has('lightning')).toBe(true);
    }
  });

  it('rain 과 snow 는 서로소이다(코드가 둘 다에 속하지 않는다)', () => {
    for (let code = 0; code <= 99; code += 1) {
      const rain = WEATHER_CODE_RAIN.has(code);
      const snow = WEATHER_CODE_SNOW.has(code);
      expect(rain && snow).toBe(false);
    }
  });

  it('임계값 경계 — smog/dust 를 정확히 on/off 한다', () => {
    // smog 경계
    expect(classifyWeatherEffects(buildSnapshot(0, SMOG_PM25_THRESHOLD - 0.01, null, null)).has('smog')).toBe(false);
    expect(classifyWeatherEffects(buildSnapshot(0, SMOG_PM25_THRESHOLD, null, null)).has('smog')).toBe(true);

    // dust — pm10 경로
    expect(classifyWeatherEffects(buildSnapshot(0, null, DUST_PM10_THRESHOLD - 1, null)).has('dust')).toBe(false);
    expect(classifyWeatherEffects(buildSnapshot(0, null, DUST_PM10_THRESHOLD, null)).has('dust')).toBe(true);

    // dust — raw dust 경로
    expect(classifyWeatherEffects(buildSnapshot(0, null, null, DUST_RAW_THRESHOLD - 0.1)).has('dust')).toBe(false);
    expect(classifyWeatherEffects(buildSnapshot(0, null, null, DUST_RAW_THRESHOLD)).has('dust')).toBe(true);
  });

  it('pm 필드가 null 이면 smog · dust 는 포함되지 않는다(Req 4e.4 · 4f.4)', () => {
    const set = classifyWeatherEffects(buildSnapshot(0, null, null, null));
    expect(set.has('smog')).toBe(false);
    expect(set.has('dust')).toBe(false);
  });
});
