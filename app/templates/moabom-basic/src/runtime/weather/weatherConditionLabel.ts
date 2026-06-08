import type { MoabomTranslateFn } from '../../i18n/moabomT';
import type { Weather_Snapshot } from './types';

/**
 * 마이페이지 날씨 토글 옆 상태 텍스트(설계: 테스트·디버그 가시화)용 조건 식별자.
 *
 * `classifyWeatherEffects` 는 "그릴 효과(비/눈/번개/안개/먼지)"만 분류하므로 맑음·흐림 같은
 * 무효과 상태를 표현하지 못한다. 본 모듈은 Open-Meteo WMO 코드를 사람이 읽는 라벨로 매핑해
 * 전체 상태(맑음~뇌우)를 i18n 키로 환원한다.
 *
 * WMO 코드 정의: https://open-meteo.com/en/docs (weather_code)
 */
export type WeatherConditionId =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezing_rain'
  | 'snow'
  | 'rain_showers'
  | 'snow_showers'
  | 'thunderstorm'
  | 'thunderstorm_hail'
  | 'unknown';

const CODE_TO_CONDITION: ReadonlyMap<number, WeatherConditionId> = new Map<number, WeatherConditionId>([
  [0, 'clear'],
  [1, 'partly_cloudy'],
  [2, 'partly_cloudy'],
  [3, 'overcast'],
  [45, 'fog'],
  [48, 'fog'],
  [51, 'drizzle'],
  [53, 'drizzle'],
  [55, 'drizzle'],
  [56, 'drizzle'],
  [57, 'drizzle'],
  [61, 'rain'],
  [63, 'rain'],
  [65, 'rain'],
  [66, 'freezing_rain'],
  [67, 'freezing_rain'],
  [71, 'snow'],
  [73, 'snow'],
  [75, 'snow'],
  [77, 'snow'],
  [80, 'rain_showers'],
  [81, 'rain_showers'],
  [82, 'rain_showers'],
  [85, 'snow_showers'],
  [86, 'snow_showers'],
  [95, 'thunderstorm'],
  [96, 'thunderstorm_hail'],
  [99, 'thunderstorm_hail'],
]);

/** i18n 키 베이스. 라벨은 `moa_mypage.weather_status.{id}`, 포맷은 `.format`. */
const STATUS_KEY_BASE = 'moa_mypage.weather_status';

/** weather_code 를 조건 식별자로 환원한다. 유한하지 않거나 미정의 코드는 `unknown`. */
export function weatherConditionId(weatherCode: number): WeatherConditionId {
  if (!Number.isFinite(weatherCode)) return 'unknown';
  return CODE_TO_CONDITION.get(weatherCode) ?? 'unknown';
}

/**
 * 스냅샷을 `"흐림 · 14°C"` 형태의 단일 라벨로 환원한다.
 * 기온이 유한하지 않으면 상태 단어만 반환한다.
 */
export function formatWeatherStatusLabel(snapshot: Weather_Snapshot, t: MoabomTranslateFn): string {
  const condition = t(`${STATUS_KEY_BASE}.${weatherConditionId(snapshot.weather_code)}`);

  if (!Number.isFinite(snapshot.temperature_2m)) {
    return condition;
  }

  return t(`${STATUS_KEY_BASE}.format`, {
    condition,
    temp: Math.round(snapshot.temperature_2m),
  });
}
