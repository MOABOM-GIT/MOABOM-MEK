<?php

/*
 * moabom-weather 플러그인 설정.
 *
 * 환경변수 이름은 분리 이전(moabom-system)의 MOABOM_WEATHER_* 키를 그대로 유지해
 * Cloud Run 운영 변수를 변경하지 않아도 되도록 한다(F1 호환).
 */

return [
    /*
     * IP geolocation 제공자 우선순위.
     * - cloudflare_then_ipinfo: CF 헤더 → ipinfo.io
     * - cloudflare_only       : CF 헤더만 사용
     * - disabled              : 항상 빈 결과
     */
    'ip_provider' => env('MOABOM_WEATHER_IP_PROVIDER', 'cloudflare_then_ipinfo'),
    'ipinfo_token' => env('MOABOM_WEATHER_IPINFO_TOKEN'),

    'dev_fallback_lat' => env('MOABOM_WEATHER_DEV_FALLBACK_LAT', '37.5665'),
    'dev_fallback_lon' => env('MOABOM_WEATHER_DEV_FALLBACK_LON', '126.9780'),
    'dev_fallback_city' => env('MOABOM_WEATHER_DEV_FALLBACK_CITY', 'Seoul'),
    'dev_fallback_country' => env('MOABOM_WEATHER_DEV_FALLBACK_COUNTRY', 'KR'),

    /** Open-Meteo HTTP (Forecast 는 지역·부하에 따라 3s 초과 가능 — Cloud Run 503 방지) */
    'http_timeout' => (int) env('MOABOM_WEATHER_HTTP_TIMEOUT', 12),
    'http_connect_timeout' => (int) env('MOABOM_WEATHER_HTTP_CONNECT_TIMEOUT', 5),
    'http_retries' => (int) env('MOABOM_WEATHER_HTTP_RETRIES', 2),
    'http_retry_sleep_ms' => (int) env('MOABOM_WEATHER_HTTP_RETRY_SLEEP_MS', 300),
    /** current + sunrise/sunset 만 필요 — 기본 7일 전체 예보 다운로드 방지 */
    'forecast_days' => (int) env('MOABOM_WEATHER_FORECAST_DAYS', 1),
];
