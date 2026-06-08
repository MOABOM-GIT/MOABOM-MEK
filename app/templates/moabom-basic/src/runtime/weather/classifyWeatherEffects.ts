import {
  DUST_PM10_THRESHOLD,
  DUST_RAW_THRESHOLD,
  SMOG_PM25_THRESHOLD,
  WEATHER_CODE_FOG,
  WEATHER_CODE_LIGHTNING,
  WEATHER_CODE_RAIN,
  WEATHER_CODE_SNOW,
} from './constants';
import type { Weather_Snapshot, WeatherEffectId, WeatherEffectSet } from './types';

/**
 * Weather_Snapshot 을 현재 활성화되어야 할 Weather_Effect_Set 으로 해석하는 **순수 함수**(설계 §4 · Req 4a~4f).
 *
 * 6 개 등가식(Property 4 — P-Effect-Classification):
 *   rain       ∈ S ⇔ weather_code ∈ WEATHER_CODE_RAIN
 *   snow       ∈ S ⇔ weather_code ∈ WEATHER_CODE_SNOW
 *   lightning  ∈ S ⇔ weather_code ∈ WEATHER_CODE_LIGHTNING
 *   fog        ∈ S ⇔ weather_code ∈ WEATHER_CODE_FOG
 *   smog       ∈ S ⇔ pm2_5 != null ∧ pm2_5 ≥ SMOG_PM25_THRESHOLD
 *   dust       ∈ S ⇔ (pm10  != null ∧ pm10  ≥ DUST_PM10_THRESHOLD)
 *                   ∨ (dust  != null ∧ dust  ≥ DUST_RAW_THRESHOLD)
 *
 * 동시 포함 계약: weather_code ∈ {95, 96, 99} 인 경우 rain 과 lightning 이 모두 포함된다(Req 4a.5 / 4c.5).
 * WEATHER_CODE_RAIN ∩ WEATHER_CODE_SNOW = ∅ 이므로 rain · snow 는 서로소다.
 */
export function classifyWeatherEffects(snapshot: Weather_Snapshot): WeatherEffectSet {
  const set = new Set<WeatherEffectId>();
  const code = Number.isFinite(snapshot.weather_code) ? snapshot.weather_code : -1;

  if (WEATHER_CODE_RAIN.has(code)) set.add('rain');
  if (WEATHER_CODE_SNOW.has(code)) set.add('snow');
  if (WEATHER_CODE_LIGHTNING.has(code)) set.add('lightning');
  if (WEATHER_CODE_FOG.has(code)) set.add('fog');

  if (snapshot.pm2_5 !== null && snapshot.pm2_5 >= SMOG_PM25_THRESHOLD) {
    set.add('smog');
  }

  const pm10HitsDust = snapshot.pm10 !== null && snapshot.pm10 >= DUST_PM10_THRESHOLD;
  const rawHitsDust = snapshot.dust !== null && snapshot.dust >= DUST_RAW_THRESHOLD;
  if (pm10HitsDust || rawHitsDust) {
    set.add('dust');
  }

  return set;
}
