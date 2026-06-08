/**
 * 날씨 효과 분류 · 임계값 상수(설계 §4).
 *
 * `classifyWeatherEffects` 가 Weather_Snapshot 을 Weather_Effect_Set 으로 매핑할 때 참조한다.
 * 상수 자체를 `export` 하여 테스트와 디버그 도구에서도 동일한 기준을 공유한다.
 *
 * Open-Meteo WMO 코드 정의(공식 문서):
 *   https://open-meteo.com/en/docs#api-documentation (weather_code 섹션)
 */

/**
 * 비 계열(강수 + 진눈깨비 + 뇌우 동반 강수) weather_code 집합.
 * 51–57: Drizzle · 61–67: Rain · 80–82: Rain showers · 95–99: Thunderstorm(강수 동반).
 * 66–67(freezing rain) 은 "비" 로 처리한다(Req 4a.1).
 */
export const WEATHER_CODE_RAIN: ReadonlySet<number> = new Set<number>([
  51, 53, 55, 56, 57,
  61, 63, 65, 66, 67,
  80, 81, 82,
  95, 96, 99,
]);

/** 눈 계열 weather_code 집합(71–77: Snow fall, 85–86: Snow showers) — Req 4b.1. */
export const WEATHER_CODE_SNOW: ReadonlySet<number> = new Set<number>([
  71, 73, 75, 77,
  85, 86,
]);

/** 번개(뇌우) weather_code 집합(95: Thunderstorm, 96/99: with hail) — Req 4c.1. */
export const WEATHER_CODE_LIGHTNING: ReadonlySet<number> = new Set<number>([
  95, 96, 99,
]);

/** 안개 계열 weather_code 집합(45: Fog, 48: Depositing rime fog) — Req 4d.1. */
export const WEATHER_CODE_FOG: ReadonlySet<number> = new Set<number>([45, 48]);

/** 스모그 판정 임계값(PM2.5 ㎍/㎥, WHO "Unhealthy for Sensitive Groups") — Req 4e.1. */
export const SMOG_PM25_THRESHOLD = 35;

/** 황사 판정 임계값(PM10 ㎍/㎥) — Req 4f.1. */
export const DUST_PM10_THRESHOLD = 150;

/** 황사 판정 임계값(Open-Meteo `dust` 필드 ㎍/㎥) — Req 4f.1. */
export const DUST_RAW_THRESHOLD = 50;

/** stale-while-error 사용 가능 최대 기간(ms). 2 시간. Req 3.5. */
export const WEATHER_SNAPSHOT_STALE_MAX_MS = 2 * 60 * 60 * 1000;

/** visibility 전이 후 재페치 게이트(ms). 30 분. Req 3.2. */
export const WEATHER_VISIBLE_REFETCH_GATE_MS = 30 * 60 * 1000;

/** Weather_Location_LocalCache TTL(ms). 24 시간. Req 2.3. */
export const WEATHER_LOCATION_LOCALCACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 기본 파티클 예산(데스크톱) — Req 5.3 · 5.5. */
export const WEATHER_DEFAULT_PARTICLE_BUDGET = 400;

/** DPR 상한 — Req 5.4. */
export const WEATHER_DPR_CAP = 1.5;
