# Changelog

## [0.1.3] - 2026-05-14

### Changed

- `g7_version`을 `>=7.0.0-beta.1,<8.0.0`로 조정(코어 베타·7.x 정식 전 구간, 8.x 메이저는 제외)

## [0.1.2] - 2026-05-12

### Added

- **`sw.template.js`**: `MOABOM_LAZY_PRECACHE` 메시지 — 앱 실행 시에만 전달된 URL(최대 30개, 동일 출처)을 `ASSETS_CACHE`에 `cache.add`로 적재(실패 무시). 규약: `docs/moabom-pwa-lazy-precache.md`.

### Added (tests)

- `SwTemplatePrecacheExclusionTest::sw_template_handles_moabom_lazy_precache_message`.
- `MoabomBasicPrecacheManifestScopeTest`: `image-gallery-lightbox` 지연 청크 URL이 precache에 없음을 검증.

## [0.1.1] - 2026-05-12

### Changed

- **`sw.template.js`**: precache manifest에 포함된 pathname은 런타임 `CacheFirst` 자산 라우트에서 제외해 Workbox precache와 이중 전략이 겹치지 않게 했다(로드맵 B2).
- **`sw.template.js`**: `ASSETS_CACHE`의 `ExpirationPlugin.maxEntries`를 60 → 120으로 상향(확장·청크 증가 시 LRU 여유, 로드맵 B5).

### Added

- **PHPUnit**: `SwTemplatePrecacheExclusionTest`, `MoabomBasicPrecacheManifestScopeTest` — SW 계약 및 precache에 셸/모듈·플러그인 dist 미포함 검증.

## [0.1.0] - 2026-05-08

### Added

- **`moabom-system` 모듈에서 PWA 책임을 분리해 신규 플러그인으로 추출**.
  - 컨트롤러 3종 (`PwaManifestController`, `PwaVersionController`, `PwaServiceWorkerController`) 과
    서비스 2종 (`PwaManifestBuilder`, `PwaVersionResolver`) 을 `Plugins\Moabom\Pwa` 네임스페이스로 이전했다.
  - 4개 로케일 PWA manifest 번역 (`src/lang/{ko,en,ja,zh}/pwa.php`) 도 함께 이전했고, 번역 네임스페이스를 `moabom-system::pwa.*` → `moabom-pwa::pwa.*` 로 재정렬했다.
  - Service Worker 템플릿(`resources/pwa/sw.template.js`) 도 플러그인 자산으로 이전했다.
- **공개 엔드포인트 prefix 단순화**.
  - `GET /api/plugins/moabom-pwa/manifest.webmanifest` (구 `/api/modules/moabom-system/public/pwa/manifest.webmanifest`)
  - `GET /api/plugins/moabom-pwa/version` (구 `/api/modules/moabom-system/public/pwa/version`)
- **루트 스코프 라우트 유지** — `/pwa/sw.js` 는 `Service-Worker-Allowed: /` 요건을 위해 `PwaServiceProvider::boot()` 에서 플러그인 prefix 를 우회해 직접 등록한다(이전 동작과 동일).
- **graceful degrade 유지** — `templates/moabom-basic/dist/pwa/sw.bundled.js` 가 부재한 환경에서는 no-op SW 응답.

### Notes

- 본 플러그인은 `moabom-basic` 사용자 템플릿의 `dist/pwa/` 빌드 산출물에 의존한다(구 `moabom-system` 모듈의 동일 의존을 그대로 승계).
- `PwaVersionResolver` 의 dist mtime 입력 집합에는 여전히 `templates/moabom-basic/**`, `modules/moabom-system/dist/**`, `plugins/*/dist/**` 가 포함된다.
