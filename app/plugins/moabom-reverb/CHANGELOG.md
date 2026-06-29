# Changelog

## [0.1.3] - 2026-06-29

### Changed

- 신규 테넌트 시드용 Reverb 서버 엔드포인트 기본값을 Realtime VM SSOT(realtime.mek360.com:443/https)로 맞췄습니다.

## [0.1.0] - 2026-06-19

### Added

- Laravel Reverb WebSocket — 신규 테넌트 `drivers.json` 시드·런타임 hydration.
- `moabom.saas.drivers.seed_defaults` / `moabom.saas.drivers.apply_runtime` 훅으로 `moabom-system` SaaS hydrator·seeder 와만 연결.
