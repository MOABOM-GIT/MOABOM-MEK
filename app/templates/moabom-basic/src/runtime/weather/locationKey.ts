import type { Weather_Location, WeatherLocationKey } from './types';

/**
 * Weather_Location + 언어 로케일로부터 캐시 키를 구성한다.
 *
 * 서버 캐시(`moabom_weather_current:{lat_0_1}:{lon_0_1}:{lang}`) 와 동일한 정규화 규칙을
 * 프론트엔드에서도 재사용하여, `Weather_Snapshot_LocalCache` 엔트리의 `locationKey` 비교 시
 * 같은 버킷으로 묶인 요청들이 stale-while-error 계약을 공유하도록 한다.
 */
export function buildWeatherLocationKey(location: Weather_Location, lang: string): WeatherLocationKey {
  const lat = roundToOneDecimal(location.lat);
  const lon = roundToOneDecimal(location.lon);
  return `${lat}:${lon}:${lang}`;
}

function roundToOneDecimal(value: number): string {
  const n = Math.round(value * 10) / 10;
  // `-0` 을 `0` 으로 정규화해 키 안정성을 확보한다.
  return (Object.is(n, -0) ? 0 : n).toFixed(1);
}
