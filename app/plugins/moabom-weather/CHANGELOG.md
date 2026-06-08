# Changelog

## [0.1.0] - 2026-06-02

### Added

- `moabom-system`에서 분리한 공개 날씨 프록시 플러그인 신규 추가.
- Open-Meteo Forecast/Air-Quality 기반 현재 날씨 조회 API: `/api/plugins/moabom-weather/weather/current`.
- Cloudflare 헤더 → ipinfo.io 순서의 IP geolocation API: `/api/plugins/moabom-weather/weather/geolocate`.
- 환경변수(`MOABOM_WEATHER_*`)는 기존 값 그대로 호환 유지.
