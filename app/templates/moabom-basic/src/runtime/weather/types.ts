/**
 * 홈 셸 날씨 효과(`moabom-home-weather-effect` 스펙) 에서 공유하는 타입 모음.
 *
 * 프론트엔드 런타임 전반에서 이 모듈을 단일 진입점으로 삼아, 다른 레이어가 서로의
 * 구현 세부를 알 필요 없이 계약만 공유하도록 한다.
 */

/** 본 스펙이 관리하는 효과 식별자(Req 글로서리 Weather_Effect_Id). */
export type WeatherEffectId = 'rain' | 'snow' | 'lightning' | 'fog' | 'smog' | 'dust';

/**
 * 현재 활성화된 효과 집합. 동시 활성화가 가능한 효과 조합(Req 4a.5 · 4c.5 등) 을
 * 그대로 표현하기 위해 `ReadonlySet` 으로 전달한다.
 */
export type WeatherEffectSet = ReadonlySet<WeatherEffectId>;

/** 위치 결정 경로(Req 글로서리 Weather_Location_Source). */
export type WeatherLocationSource =
  | 'browser_geolocation'
  | 'server_ip'
  | 'unavailable';

/**
 * 위치 좌표 + 선택적 라벨. 사용자 프로필 저장본 · Geolocation 결과 · 서버 IP geolocate 결과가
 * 모두 이 shape 를 따른다.
 */
export interface Weather_Location {
  lat: number;
  lon: number;
  label?: string;
}

/**
 * `/weather/current` 응답을 정규화한 스냅샷(Req 글로서리 Weather_Snapshot · Req 7.6).
 * pm2_5 / pm10 / dust / sunrise / sunset 은 부재 시 `null` 이다(Req 3.7).
 */
export interface Weather_Snapshot {
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  temperature_2m: number;
  is_day: 0 | 1;
  pm2_5: number | null;
  pm10: number | null;
  dust: number | null;
  sunrise: string | null;
  sunset: string | null;
  fetched_at: string;
  location: { lat: number; lon: number };
}

/**
 * 서버 캐시 키 · 로컬 스냅샷 캐시 키에 사용하는 위치 버킷 문자열 유틸리티의 서명.
 * 실제 구현은 `locationKey.ts` 에 있으며, 여기서는 타입 공유만 한다.
 */
export type WeatherLocationKey = string;
