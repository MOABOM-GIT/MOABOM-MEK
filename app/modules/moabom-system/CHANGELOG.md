# Changelog

## [0.8.22] - 2026-06-30

### Fixed

- 플랫폼 **Realtime VM** 대시보드 — platform DB에 구형 layout(v1.0.2 등)이나 `admin_realtime_vm` 단축명 orphan·stale template override가 남아 WebSocket·런타임·프로세스·인프라 패널이 비어 보이던 문제. `moabom:saas:sync-module-layouts` 가 filesystem v1.0.6 으로 강제 정합·캐시 무효화하도록 보강.

## [0.8.21] - 2026-06-30

### Changed

- 관리자 **마이페이지 설정 → 메뉴 구성**에서 메뉴명·설명을 `defaults.json` 카탈로그 SSOT로 고정 — 테넌트 저장본의 구 명칭(앱 보관함·내 활동 등)이 조회·저장 시 자동으로 라이브러리·게시글 관리 등 최신 명칭으로 덮어씌워집니다.
- 셸 **활동 순위** API 성공 메시지를 UI 명칭(활동 순위)과 맞게 정리했습니다.

## [0.8.20] - 2026-06-29

### Fixed

- 플랫폼 **Realtime VM** 대시보드 layout `1.0.4` — 패널별 `_computed`를 스칼라 키로 통일하고 `P`+`text` 바인딩으로 교체해 WebSocket·런타임·프로세스·인프라 카드가 비어 보이던 문제 수정.
- `RealtimeVmHealthService` WebSocket probe — Cloud Run PHP curl이 Pusher 프레임을 못 읽어도 HTTP 101이면 정상으로 판정 (브라우저 wss와 정합).

## [0.8.19] - 2026-06-29

### Fixed

- 플랫폼 **Realtime VM** 대시보드 — `moabom-admin_basic`에 없는 `Dl`/`Dt`/`Dd` 컴포넌트를 `Div`/`Span`으로 교체해 WebSocket·런타임·프로세스·인프라 카드가 비어 보이던 문제 수정.
- WebSocket probe 실패 시 `error` 사유를 API·대시보드에 노출해 전체 상태 **이상** 판정 원인을 확인할 수 있도록 보강.

## [0.8.18] - 2026-06-29

### Fixed

- 플랫폼 **Realtime VM** 대시보드 — `computed`가 다른 computed 키를 참조해 수치가 비어 보이던 문제와 UI `_computed.` 바인딩 누락을 수정하고, VM 메트릭 데이터 소스를 blocking 로드로 맞춰 초기 렌더 시 게이지·프로세스·컨테이너 지표가 함께 표시되도록 정합.

## [0.8.17] - 2026-06-29

### Changed

- 회원가입 환영 알림 database 채널 `click_url`을 `/me/account`로 정규화해 계정 정보 입력 화면으로 연결.

## [0.8.16] - 2026-06-29

### Fixed

- 플랫폼 **Realtime VM** 대시보드 — `computed`가 데이터 소스가 아닌 다른 computed 키를 참조하고 UI 바인딩이 `_computed.` 접두사 없이 작성되어 전체·WebSocket·VM 메트릭 수치가 비어 보이던 문제 수정 (앱 리뷰 목록·업체 목록 레이아웃 패턴과 동일).

## [0.8.15] - 2026-06-29

### Changed

- 플랫폼 **Realtime VM** 대시보드 — FCM 패널·SSH/docker stats 안내 제거, VM CPU/메모리/디스크 게이지·프로세스·Docker 컨테이너 지표 표시.
- `RealtimeVmHealthService` — VM 메트릭 15s 캐시·기본 URL·`GET platform/realtime-vm/metrics` 경량 API.

## [0.8.14] - 2026-06-29

### Added

- 업체 추가 화면에서 슬러그 입력 시 예상 호스트 사용 가능 여부를 실시간으로 표시 (기존 테넌트·시스템 예약 슬러그·보호 슬러그 포함).
- `GET platform/saas/hospitals/slug-availability` API 및 `SaasSlugAvailabilityService` SSOT.
- 업체 생성 요청 시 슬러그 호스트 중복·예약명 서버 검증.

## [0.8.13] - 2026-06-29

### Added

- 플랫폼 관리자 **Realtime VM** 대시보드 (`/admin/platform/realtime-vm`) — WebSocket probe·런타임 엔드포인트·FCM 상태.
- `RealtimeVmHealthService` — 30s 캐시, curl 101 + Pusher handshake probe.
- `moabom-system.realtime.read` 권한·플랫폼 API `GET/POST platform/realtime-vm`.

## [0.8.12] - 2026-06-28

### Added

- `moabom:saas:normalize-driver-settings` 커맨드 추가 — platform/tenant `drivers` DB·GCS 설정을 Cloud Run 운영 env 기준으로 1회 정규화.

### Changed

- 관리자 `drivers` 정규화 기준을 stale DB 적용값이 아니라 env 우선으로 보강.

## [0.8.11] - 2026-06-28

### Fixed

- 관리자 환경설정 `drivers` 탭의 cache/session/queue/log/websocket 표시·저장값을 Cloud Run 운영 env 와 정규화해 UI 선택값과 실제 런타임 드라이버가 어긋나지 않도록 보정.

## [0.8.9] - 2026-06-26

### Changed

- 지연 확장 URL 맵(`extensionDeferredRegistry`)을 moabom-basic·관리자 표면 **모든 요청**에 병합해 Ghost·직접 진입(/shop 등)이 동일한 deferred 복원 경로를 쓰도록 정렬.
- `MoabomExtensionDeferredRegistrySupport`로 Ghost Composer·`MoabomTemplateComposer`의 registry·epoch 병합 로직을 공통화.

## [0.8.8] - 2026-06-25

### Changed

- 앱 셸 랭킹을 **전기간 누적** 사용량 버킷 합산으로 전환 — `period_hours: 0`.
- 앱·유저 등락 화살표는 누적 순위 대비 **최근 24시간**(설정 `shell_rankings.period_hours`) 활동 순위로 계산.

## [0.8.7] - 2026-06-25

### Changed

- 유저 셸 랭킹을 **누적 적립 포인트** 기준으로 전환 — `moabom_credit_balances.ranking_points` 상위 30명, `period_hours: 0`(기간 제한 없음).

## [0.8.6] - 2026-06-25

### Changed

- 유저 셸 랭킹 집계를 크레딧 적립 원장(`moabom_credit_transactions`) 합산으로 전환 — 셸 앱 사용량·게시판 건수 가중치 제거.
- `shell_rankings.user_activity` 설정 제거.

## [0.8.4] - 2026-06-22

### Added

- 사용자 설정 API `shell.home.mainAppOrderCustomized` — 메인 그리드 빈 배열을 의도적 빈 레이아웃으로 저장.

## [Unreleased]

## [0.8.3] - 2026-06-21

### Changed

- 셸 랭킹 **등락**을 DB 스냅샷 대신 테넌트 캐시의 직전 순위 맵과 비교.
- `shell-boot`에 `shell_rankings.usage_ingest_token` 제공(시간별 HMAC, 캐시 밖 갱신).

### Added

- usage ingest **IP rate limit** + 선택적 signed token 검증(`ShellUsageIngestGuard`).
- post-deploy migration allowlist 기본값에 `moabom-system` 포함.
- 배포 스모크: `GET .../shell/rankings/apps` 검증.

## [0.8.2] - 2026-06-21

### Fixed

- 셸 usage 수집 성공 시 랭킹 API 캐시 무효화.
- 유저 랭킹: 비활성 계정을 건너뛰며 상위 N명을 채우도록 정렬 루프 보정.
- usage FormRequest 상한을 `shell_rankings` config와 동기화.

## [0.8.1] - 2026-06-21

### Changed

- 홈 셸 **유저 랭킹**을 크레딧 잔액 대신 **활동지수**(글·댓글·앱 사용, CPAP 측정 제외)로 집계.
- 앱 사용량 수집 API에 `optional.sanctum` 적용 — 로그인 시 유저별 시간 버킷(`moabom_shell_user_usage_buckets`)에 합산.

### Added

- `moabom_shell_user_usage_buckets` 마이그레이션·집계 API.

## [0.8.0] - 2026-06-21

### Added

- 홈 셸 **앱·유저 랭킹** 실데이터 API — 시간 버킷 집계(오픈 HIT + 활성 사용시간), 24시간 순위·등락, 공개 조회·사용량 수집 엔드포인트.

## [0.7.9] - 2026-06-21

### Changed

- 관리자 사이드바 **플랫폼 환경설정**을 **플랫폼 메뉴**로 명칭 변경하고 대시보드 위(order 0)로 이동.
- **업체 관리**를 플랫폼 메뉴 하위(order 10)로 재배치 — 마스터 Host 전용 규칙은 `TenantAdminMenuPolicy` 로 유지.
- 테넌트 repair 필수 메뉴에 AI 생성 앱·마스크피팅 관리 slug 추가.

### Added

- 플랫폼 메뉴 재구성 DB 반영 업그레이드 스텝(`Upgrade_0_7_9`).

## [0.7.8] - 2026-06-19

### Changed

- **구조 정리 (셸·admin SSOT)**: 알림 URL·레거시 mypage 경로 유틸을 `moabom-basic` 템플릿으로 이전 — 모듈에 둘 UI 라우팅 책임 제거.
- **admin composite 중복 제거**: `HomeBackgroundManager`·`SortableMypageMenuList`·deferred plugin prefetch 는 `moabom-admin_basic` SSOT 만 사용. 모듈 `module.json` assets·Cloud Build `moabom-system` npm 빌드 제거.
- **shell-boot 저결합**: `social_providers`·공개 API 캐시 revision 을 `moabom.shell_boot.social_providers`·`moabom.public_api.cache_fragment.social_providers` 훅으로 분리 (`moabom-social-auth` 가 기여).
- **Reverb 분리**: `Broadcasting/*` → `moabom-reverb` 플러그인. `TenantSettingsSeeder`·`SaasCoreSettingsHydrator` 는 `moabom.saas.drivers.seed_defaults` / `apply_runtime` 훅만 사용.
- 업체 기본 패키지에 `moabom-reverb` 플러그인 추가.

## [0.7.6] - 2026-06-18

### Added

- 사용자 설정 API `shell.home.mainAppOrder` — 홈 셸 메인 앱 그리드 순서(일반·AI 생성 앱 id)를 계정에 저장·동기화.

## [0.7.5] - 2026-06-07

### Changed

- `SiteLogoAttachmentListener`: site_logo 업로드 후처리를 `AttachmentRepositoryInterface` 위임으로 변경(Model 직접 `update()` 제거)하고 Listener 의 `request()` 직접 접근을 제거 — 코어 계층 분리 규약(Listener 데이터 접근) 준수. 업로드 시 `source_identifier` 가 이미 모델에 영속화되므로 **동작 변경 없음**.

## [0.7.4] - 2026-06-06

> 0.7.2 ~ 0.7.4 변경을 일괄 기록(manifest version 이 CHANGELOG 보다 앞서 있던 간극 정합화).

### Added

- **큐 잡 테넌트 격리 토대(C1)**: `Saas/Queue/TenantQueueBootstrapper`(스택 기반 singleton) + `TenantAwareJob` 권장 베이스/`InteractsWithTenant` 트레이트. `Queue::createPayloadUsing` 로 디스패치 시 tenant slug 주입, 워커에서 `TenantRuntimeBootstrap::bootstrapTenantBySlug` 로 복원·`restorePlatformContext` 로 직전 컨텍스트 복귀. `TenantContextSwitcher` 인터페이스 도입(테스트 격리).
- **앱 SDK shell-boot 통합(Phase 4)**: `PublicShellBootController` 가 `moabom.shell_boot.apps` 필터를 적용해 활성 앱 모듈 매니페스트를 `apps[]` 로 출력(시스템 모듈이 앱 모듈을 직접 알지 않는 저결합 구조).

### Changed

- **셸 테마 단일 소스화(C8)**: `moabomSystemStore` 에 셸 테마 SSOT `applyMoabomSystemThemeMode`(`data-moa-theme` + `.dark` 일괄) 신설, `applyMoabomSystemAppearance` 가 이를 재사용. 레거시 테마 토글 경로의 `data-theme`/`.dark` 직접 토글 desync 제거.

## [0.7.1] - 2026-06-02

### Changed

- `module.json` description 을 현재 책임(SaaS 런타임·업체 관리·설정·부트 API)에 맞게 간략화. 날씨·AI 앱·CPAP 등 분리 모듈 문구 제거.
- `moabom:module-sync-declarations` 가 `module.json` 의 name·version·description 을 DB modules row 에도 반영 (관리자 모듈 목록 SSOT).

## [0.6.11] - 2026-06-01

### Changed

- `TenantSocialAuthSettingsSeeder`: GCS/modules JSON write 제거 → tenant DB `social_auth_settings` seed (`TenantSocialAuthDatabaseSeeder` 위임).
- `moabom:saas:tenant-sync-social-auth`: DB seed/정규화로 재작성, `--all` active tenant 백필 추가.
- `TenantRegistry::listActive()` 추가.

## [0.6.10] - 2026-05-14

### Changed

- `g7_version`을 `>=7.0.0-beta.1,<8.0.0`로 조정 — 코어 베타/rc/7.x 정식은 별도 매니페스트 수정 없이 통과, 차기 메이저(8)는 명시적 포팅 전까지 설치 차단

## [0.6.9] - 2026-05-14

### Added

- MIT `LICENSE` 및 순정 이식 절차 안내 `modules/_bundled/README-MOABOM.md`

## [0.6.8] - 2026-05-14

### Added

- `MoabomExtensionMenuSyncHelper`: 코어 수정 없이 `parent_slug` 해석 — `ExtensionMenuSyncHelper` 싱글톤 DI 교체 (`SystemServiceProvider`)
- 관리자 메뉴: `platform-settings` 부모를 **이 모듈이 단일 등록**, 마이페이지 설정은 `parent_slug`로 동일 부모 하위 형제

### Changed

- 코어 `ExtensionMenuSyncHelper`에 넣었던 `parent_slug` 로직 제거(업스트림 초기화 대비) → Moabom 전용 서브클래스로 이전

## [0.6.7] - 2026-05-14

### Changed

- 관리자 메뉴: `getAdminMenus()`에 **마이페이지 설정**을 `parent_slug` → `platform-settings`로 선언(부모 단일화·DI 교체는 0.6.8에서 완료)
- `getDynamicMenuSlugs()` 제거

## [0.6.6] - 2026-05-12

### Added

- `tests/Feature/MoabomBasicBootJsonPayloadTest.php` — `moabom-basic` 부트용 `config`·`lang`·`components`·`routes` API가 200이며 응답 바이트가 상한 이하인지 회귀 검증.

### Fixed

- 동일 테스트: `CoreVersionChecker`는 `APP_VERSION` env 우선 — `putenv`/`$_ENV`/`$_SERVER`로 테스트 시 코어 버전 맞춤; `components`·`lang` 응답은 래퍼 없음을 반영해 검증 수정.

## [0.6.5] - 2026-05-12

### Added

- `GET .../public/template-routes-shell` — 셸용 축소 `routes.json` 스냅샷(선택 `scope=shell|full`). `MoabomShellRoutesFilter`로 `moabom-basic`에서 이커머스 경로·레이아웃 제외.
- `MoabomShellRoutesFilterTest`, `PublicTemplateRoutesShellControllerTest` — 위 동작 PHPUnit.

### Added (i18n)

- `messages.shell_routes.*` (ko/en).

## [0.6.4] - 2026-05-12

### Changed

- **서비스 컨테이너 교체(코어 `app/` 비수정)**: `ModuleSettingsService` → `MoabomModuleSettingsService`, `PluginSettingsService` → `MoabomPluginSettingsService`, `UserTemplateComposer` → `MoabomUserTemplateComposer`, `TemplateComposer` → `MoabomTemplateComposer`; `MoabomExtensionAssetGroupService`로 확장 에셋 맵을 DB `findActiveByIdentifier` 기준으로 정제한다.
- **제거**: `MoabomBladeG7ExtensionSanitizerComposer` 및 `g7_view_sanitizer` 설정(동일 목적을 DI로 이전).

### Added

- `tests/Unit/Providers/MoabomServiceContainerBindingsTest.php` — 위 바인딩이 컨테이너에서 기대대로 해석되는지 검증.

## [0.6.3] - 2026-05-12

### Added

- `MoabomBladeG7ExtensionSanitizerComposer`: `app`·`admin` 뷰에서 코어 Composer가 채운 `moduleAssets` / `deferredModuleAssets` / `pluginAssets` / `deferredPluginAssets` 및 `moduleSettings` / `pluginSettings` 중 DB 비활성 확장 항목을 제거한다(코어 `app/` 수정 없이 Ghost 이전에 실행).
- 설정 `moabom-system.g7_view_sanitizer.enabled` 및 환경변수 `MOABOM_G7_VIEW_SANITIZER`.

## [0.6.2] - 2026-05-12

### Added

- `ExtensionCatalogBuilder` / `ExtensionCatalogBuilderInterface` — 로그인 사용자 기준 노출 가능한 활성 모듈 식별자 목록(훅 `moabom.extension_catalog.module_identifiers`).
- `GET .../public/extension-boot-meta` 공개 API 및 응답 스키마 문서 `docs/extension-boot-meta-api.md`.
- Ghost View Composer가 `appConfig.moabom.extensionDeferredRegistry`·`extension_epoch`를 병합해, 루트 Ghost 이후에도 `sirsoftEcommerceLayoutPrefetch`가 지연 에셋을 복원·로드할 수 있게 했다.

## [0.6.1] - 2026-05-12

### Added

- `app` 뷰용 `MoabomUserBootDeferredAssetsGhostComposer`를 등록해, `moabom-basic` 템플릿에서 설정한 경로(기본 루트 `/`) 최초 페인트 시 `deferredModuleAssets`·`deferredPluginAssets`를 화이트리스트 기준으로만 남기도록 했다(Phase D2 Ghost / On-Demand). 설정 키: `config/moabom-system.php` 의 `boot_asset_ghost`, 환경변수 `MOABOM_BOOT_ASSET_GHOST*`.

## [0.6.0] - 2026-05-08

### Added

- 홈 셸 reference 앱 연동을 위한 AI 앱 생성 API와 생성 앱 저장 API를 추가했다.
- 양압기 마스크 피팅 앱의 측정 결과 저장·최근 결과 조회 API와 저장 테이블을 추가했다.
- `moabom-system` AI provider 설정(`MOABOM_AI_PROVIDER`, `MOABOM_OPENAI_API_KEY`, `MOABOM_OPENAI_MODEL`, `MOABOM_AI_TIMEOUT`)을 추가했다.
- AI 앱 생성 API를 레퍼런스 앱과 동일한 3개 모델(`claude-sonnet`, `gpt-4o`, `gemini-flash`) 자동 라우팅 구조로 확장하고 수정 요청용 `current_html` 입력을 추가했다.

## [0.5.2] - 2026-05-08

### Removed

- 날씨 효과에서 수동 지역/도시 입력을 제거함에 따라 `GET /api/modules/moabom-system/weather/geocode` 엔드포인트와 관련 컨트롤러, 요청, 서비스, 인터페이스 바인딩을 삭제했다.
- 사용자 설정 저장 요청에서 `profile.weather_location` 검증 규칙을 제거했다. 날씨 위치는 브라우저 Geolocation 또는 IP 기반 geolocation 으로만 결정된다.

## [0.5.1] - 2026-05-08

### Changed

- `config/settings/defaults.json` — 시스템 옵션 `haptic` 의 `on_by_default` 를 `moabom-basic` 템플릿 `DEFAULT_MOABOM_SYSTEM` 과 동일하게 `true` 로 맞춤.

## [0.5.0] - 2026-05-08

### Removed (BREAKING)

- **PWA(매니페스트·서비스워커·버전) 책임을 신규 플러그인 `moabom-pwa`로 분리**했다. 본 모듈은 더 이상 PWA 엔드포인트를 제공하지 않는다.
  - 삭제된 컨트롤러: `Pwa\PwaManifestController`, `Pwa\PwaServiceWorkerController`, `Pwa\PwaVersionController`.
  - 삭제된 서비스: `Services\Pwa\PwaManifestBuilder`, `Services\Pwa\PwaVersionResolver`.
  - 삭제된 다국어: `src/lang/{ko,en,ja,zh}/pwa.php`.
  - 삭제된 자산: `resources/pwa/sw.template.js` (플러그인으로 이전됨).
  - 삭제된 라우트: `Route::prefix('public/pwa')` 그룹(`manifest.webmanifest`, `version`).
  - 삭제된 메서드: `SystemServiceProvider::registerPwaServiceWorkerRoute()` (루트 스코프 `/pwa/sw.js` 등록은 플러그인의 `PwaServiceProvider::boot()` 가 승계).
  - 삭제된 테스트: `tests/Feature/Pwa/{PwaManifestController,PwaServiceWorker,PwaVersionController,AdminShellBypass}Test.php` (플러그인 테스트로 이전됨).
- **공개 엔드포인트 URL 변경**:
  - 구: `GET /api/modules/moabom-system/public/pwa/manifest.webmanifest`
  - 신: `GET /api/plugins/moabom-pwa/manifest.webmanifest`
  - 구: `GET /api/modules/moabom-system/public/pwa/version`
  - 신: `GET /api/plugins/moabom-pwa/version`
  - 그대로: 루트 스코프 `GET /pwa/sw.js` (플러그인이 동일 경로/계약으로 승계).

### Changed

- `module.json` description 을 갱신해 PWA 책임이 분리되었음을 반영하고, 잔여 책임(My Page UX + Weather 프록시) 만 명시했다.

### Migration

- 자동 동작: `moabom-pwa` 플러그인을 설치/활성화하면 동일한 매니페스트·SW 응답이 새 URL 로 제공된다.
- 프론트엔드: `templates/moabom-basic` 가 0.6.0 부터 새 URL 을 참조하므로 `template:update --force` 와 함께 적용한다.
- DB/마이그레이션 영향 없음: PWA 는 stateless 공개 엔드포인트라 모듈 마이그레이션을 수정하지 않는다.

## [0.4.7] - 2026-05-08

### Changed

- `module.json` description을 모듈의 실제 책임(마이페이지 환경설정 + PWA + 홈 날씨 효과 프록시) 전체를 정확히 반영하도록 갱신했다. 기존 설명은 "마이페이지와 사용자 환경 설정"만 언급해 PWA·Weather 책임이 누락되어 있었다.
- description에 PWA 서비스워커가 `templates/moabom-basic/dist/pwa` 빌드 산출물에 의존하며, 부재 시 no-op SW로 graceful degrade 한다는 점을 명시했다(코드는 기존부터 폴백 동작). 이는 코어가 manifest의 `dependencies.templates` 키를 검증하지 않으므로 description으로 명시하는 절충안이다.

## [0.4.6] - 2026-05-07

### Fixed

- PWA manifest icons 경로를 실제 사용자 템플릿 asset API 경로(`/api/templates/assets/moabom-basic/pwa/icons/...`)로 정렬해 아이콘 404를 방지했다.

## [0.4.5] - 2026-05-07

### Changed

- PWA Service Worker에서 템플릿 메타 JSON(`lang`, `routes`, `components`) CacheFirst 라우트를 제거하고, 응답을 만들지 않는 빈 fetch 리스너도 삭제했다. 정적 에셋/공개 레이아웃/HTML 문서만 SW가 담당하도록 범위를 좁혀 초기 부트스트랩 JSON 요청의 `script + sw.js` 이중 처리 표시와 불필요한 fetch 이벤트 비용을 줄인다.

## [0.4.4] - 2026-05-07

### Changed

- PWA Service Worker에서 `/api/*` 전체를 NetworkOnly로 가로채던 catch-all 라우트를 제거했다. 캐시 가치가 있는 공개 JSON만 명시적으로 처리하고, 동적 API는 브라우저 기본 네트워크에 맡겨 DevTools의 `sw.js` 중복 행과 Service Worker 관여 범위를 줄인다.
- 공개 레이아웃 JSON(`/api/layouts/{template}/{layout}.json`)을 `CacheFirst` 대상으로 추가하고, 캐시 키에서 `v`를 보존해 버전 변경 시 새 JSON이 안전하게 로드되도록 했다.

## [0.4.3] - 2026-05-07

### Changed

- PWA Service Worker에서 `frontend-defaults` 공개 기본값 엔드포인트를 `NetworkFirst`에서 60초 TTL `CacheFirst`로 조정했다. 사용자별 저장 API는 계속 network-only이며, 게스트 초기 셸 로딩의 불필요한 네트워크 대기를 줄인다.

## [0.4.2] - 2026-05-07

### Fixed

- PWA Service Worker 템플릿에서 `config.json`은 cache_version 기준점으로 최신 네트워크 확인이 필요하므로 CacheFirst 대상에서 제외했다. `lang`, `routes`, `components` JSON만 버전 쿼리 기반 CacheFirst로 유지한다.

## [0.4.1] - 2026-05-07

### Changed

- PWA Service Worker 라우팅 최적화 — 버전 쿼리로 무효화되는 템플릿/플러그인 정적 에셋과 템플릿 메타 JSON(`lang`, `routes`, `components`, `config`)을 `CacheFirst`로 전환해 초기 부트 시 백그라운드 재검증 중복 요청을 줄였다.

## [0.4.0] - 2026-05-07

### Added

- **PWA 공개 엔드포인트** (`moabom-pwa-service-worker` 스펙) — `manifest.webmanifest`, `version`, 루트 스코프 `/pwa/sw.js` 응답을 추가했다.
- **PWA 서비스 레이어** — `PwaManifestBuilder` 와 `PwaVersionResolver` 로 Accept-Language 기반 manifest 조립과 dist mtime 기반 결정적 버전 산출을 제공한다.
- **Service Worker 템플릿과 다국어** — Workbox SW 템플릿(`resources/pwa/sw.template.js`) 과 `pwa.name`/`short_name`/`description` 4개 로케일 번역을 추가했다.

## [0.3.0] - 2026-05-07

### Added

- **홈 셸 날씨 효과 서버 프록시** (`moabom-home-weather-effect` 스펙) — 3 개 공개 엔드포인트 추가.
  - `GET /api/modules/moabom-system/weather/current` — Open-Meteo Forecast + Air-Quality 병렬 호출, 0.1° 그리드 · 언어별 `Cache::remember` 600 초, Forecast 실패 시 `503 Service Unavailable`(캐시 기록 금지), Air-Quality 실패 시 `pm2_5/pm10/dust = null` 로 graceful degrade. `throttle:60,1`.
  - `GET /api/modules/moabom-system/weather/geolocate` — D1-A 결정대로 Cloudflare 헤더(`CF-IPLatitude/Longitude/Country/City`) 1 순위 + `ipinfo.io` 2 순위 fallback. `/24` 서브넷 · 제공자별 `Cache::remember` 3600 초. 외부 실패 · 빈 결과를 포함한 모든 상태에서 `200 OK` 로 `{ data: {} }` 반환(Req 7.9). `throttle:60,1`.
  - `GET /api/modules/moabom-system/weather/geocode` — Open-Meteo Geocoding 중계, `q` 정규화(연속 공백 단일화 + 소문자) 후 언어별 `Cache::remember` 86400 초, 상위 5 개 반환, 외부 실패 시 `503 Service Unavailable`. `throttle:30,1`.
- **Weather 관련 신규 파일**: `Http/Controllers/Weather/*Controller.php` 3 개, `Http/Requests/Weather/GetWeather*Request.php` 2 개, `Services/Weather/OpenMeteoClient.php` · `WeatherCurrentService.php` · `WeatherGeocodeService.php` · `IpGeolocationService.php` · `Dto/WeatherSnapshotDto.php`, `Contracts/Weather/*Interface.php` 3 개, `Exceptions/UpstreamUnavailableException.php`.
- **사용자 프로필 네임스페이스** (`user_system_settings.settings.profile`) — D4-A 결정에 따른 신규 JSON 경로.
  - `StoreUserSystemSettingsRequest` 에 `profile.weather_location.{lat|lon|label}` 검증 추가(범위·라벨 최대 120자 · nullable → 비우기).
  - `user_system_settings.settings` JSON 컬럼 스키마는 확장만 이뤄지고 기존 `preferences.*` / `appearance.*` / `layout.*` 은 손대지 않음(Req 8.4 · 8.5).
- **모듈 config** `config/moabom-system.php` — `weather.ip_provider` · `weather.ipinfo_token` 설정 + `.env.example` 추가(`MOABOM_WEATHER_IP_PROVIDER`, `MOABOM_WEATHER_IPINFO_TOKEN`).
- **다국어 메시지 키** `messages.weather.upstream_unavailable` — ko/en.

### Changed

- `SystemServiceProvider` — 모듈 config 를 `mergeConfigFrom` 으로 로드하고 Weather 관련 3 개 인터페이스 바인딩 추가.

## [0.2.0] - 2026-05-06

### Added

- **시스템 옵션 사용자 저장 요청에 잠금/미지정 검증 추가** (`StoreUserSystemSettingsRequest`, Req 8.1 / 8.2 / 8.4):
  - `prepareForValidation()` 에서 `SystemSettingsServiceInterface::getAllSettings()` 를 호출해 현재 관리자 측 `preferences.system_options` 를 `id => ['user_editable','on_by_default']` 형태로 색인한다.
  - `preferences.systemOptions` 필드에 closure 규칙을 추가해, 사용자 요청 본문에 포함된 id 가 (a) 관리자 색인에 존재하지 않거나 (b) `user_editable === false` 로 잠겨 있으면 422 `Unprocessable Entity` 응답을 발행한다.
  - 개별 필드(`preferences.systemOptions.*.sound` 등) 의 boolean 규칙은 그대로 유지되어 Req 8.3 의 기존 저장 계약이 깨지지 않는다.
- **다국어 키 2종** (`src/lang/ko/validation.php`, `src/lang/en/validation.php`) — `moabom-system::validation.system_option_locked`, `moabom-system::validation.system_option_unknown` (placeholder `:id`).

### Note

- 본 릴리즈는 `moabom-system-options-runtime-apply` 스펙의 서버 레이어 구현분이다. 프론트엔드 런타임 적용 레이어(Effective 값 계산 · animation/sound/haptic/toast/weather 가드 · iOS 햅틱 UI 미노출) 는 `moabom-basic` 템플릿 `0.3.0` 에서 별도로 릴리즈된다.
- 관리자 저장 요청(`StoreSystemSettingsRequest`) · `defaults.json` 의 `preferences.system_options` 엔트리 · `SystemSettingsService::getFrontendSettings()` 출력 필드 집합은 Req 9 에 따라 변경 없음.

## [0.1.24] - 2026-05-06

### Changed

- **홈 배경 이미지 원본 품질 90 → 85** (`HomeBackgroundService.php`) — 업로드 배경 full 변형의 JPEG 품질을 한 단계 내려 스토리지·전송량 절감. 시각적 차이는 거의 없으면서 용량은 약 25–30% 감소한다. 썸네일(`82`) 은 그대로 유지.

### Note
- `admin_mypage_settings.json` 의 `computed.pointColorPresetsSafe` 는 유지(`Array.isArray` 보조)하되, 사용자 쪽 화면 장애 재발 방지를 위해 composite `pointColorPresets` prop 은 기존 `{{_local.form?.appearance?.point_color_presets ?? []}}` 을 primary 로 사용할 수 있도록 바인딩을 검토 필요(다음 릴리즈에서 UI 라이브러리 Select 드롭아웃 교체와 함께 반영).

## [0.1.23] - 2026-05-06

### Fixed

- `HomeBackgroundManager` 의 `pointColorPresets` prop 이 빈 배열로 도달하던 문제 (`admin_mypage_settings.json`) — composite prop 바인딩에서 옵셔널 체이닝(`?.`)과 `??` 조합이 빈 배열로 fallback 되던 엣지 케이스. `computed.pointColorPresetsSafe` 를 도입해 `Array.isArray` 로 확정 후 단순 경로(`{{_computed.pointColorPresetsSafe}}`)로 composite 에 주입하도록 우회.

## [0.1.22] - 2026-05-06

### Added

- **홈 배경 항목에 `mode`·`point_color` 필드 도입** — `home_background_items[].mode`(`light`|`dark`) 와 `home_background_items[].point_color`(`#rrggbb` | null) 저장 지원. 이전 스키마(id 만)와 호환.
  - `StoreSystemSettingsRequest` 규칙 추가: `home_background_items.*.mode` (light/dark only), `home_background_items.*.point_color` (nullable hex).
  - `SystemSettingsService::stripAppearanceForStorage`: 저장 시 mode 누락은 `light` 로, 잘못된 hex 는 `null` 로 정규화. **포인트 컬러 유일성 강제** — 같은 hex 가 여러 배경에 지정되면 첫 항목만 유지하고 나머지는 null.
  - `SystemSettingsService::enrichAppearanceForResponse`: 조회 응답에 mode/point_color 를 항상 완전한 형태로 반환(구 저장본 호환). URL 부착 기존 동작 유지.
- **관리자 레이아웃 (`admin_mypage_settings.json`)**: `HomeBackgroundManager` 에 `pointColorPresets` prop 주입 — 현재 팔레트 hex 목록을 컴포넌트의 포인트 컬러 드롭다운에 그대로 전달.

### Testing

- `StoreSystemSettingsRequestTest`: mode/point_color 수락·거부 케이스 추가.
- `SystemSettingsServiceAppearanceNormalizationTest` 신규 — 저장/조회 정규화, 유일성, hex 소문자화, 구 스키마 호환성.

## [0.1.21] - 2026-05-06

### Removed
- 관리자 「화면 테마·배경」 탭에서 **"템플릿 기본 배경 사용" 토글·배경 ID 목록 편집 섹션** 제거 — 배경은 이제 하단 "업로드한 홈 배경"(`home_background_items`)만으로 관리한다 (`admin_mypage_settings.json`)
- `StoreSystemSettingsRequest`에서 `appearance.background_image_ids` 및 `appearance.include_template_backgrounds` 규칙 제거 (legacy 키는 `validatedSettings()` / `SystemSettingsService::stripLegacyAppearanceDefaultKeys()` 에서 삭제)
- `defaults.json` `appearance` 에서 `background_image_ids`·`include_template_backgrounds` 기본값과 frontend_schema 노출 설정 삭제
- 사용자 설정(`StoreUserSystemSettingsRequest`) `appearance.backgroundImageId` 에서 템플릿 번들 슬롯(1~13) 허용 제거 — **업로드 UUID 또는 빈 문자열만 허용**

### Changed
- 관련 i18n 문구 정리: `include_template_backgrounds`·`background_slots_label`·`background_slot_label`·`background_image_ids_hint`·`add_background_image_id`·`remove_background_image_id`·`background_id_placeholder`·`point_preset_slot_label` 삭제, `appearance_description` 문구를 업로드 배경 중심으로 갱신 (`lang/ko.json`, `lang/en.json`)

## [0.1.20] - 2026-05-06

### Fixed
- 관리자 「화면 테마·배경」 탭에서 컬러 인풋·배경 텍스트 인풋의 **값 변경이 반영되지 않고 저장 버튼이 활성화되지 않던** 문제 — `name` 속성 기반 폼 자동 바인딩으로 전환해 배열 인덱스 경로(`appearance.point_color_presets.{i}` / `appearance.background_image_ids.{i}`)가 직접 갱신되도록 수정 (`admin_mypage_settings.json`)

## [0.1.19] - 2026-05-06

### Fixed
- 관리자 「마이페이지 설정 > 화면 테마·배경」 탭의 **포인트 컬러**·**템플릿 배경 ID** 편집 UI가 렌더되지 않던 문제 해결 — 기존 `[0..8]`/`[1..13]` 고정 iteration + 동적 `name` 바인딩 구조를 **저장 배열 자체를 iteration 소스로 쓰는 가변 리스트**로 교체 (`admin_mypage_settings.json`)

### Added
- 관리자 appearance 편집 UI에 **"색상 추가" / "배경 추가"** 버튼과 각 항목의 **삭제 버튼** 도입 — 관리자가 개수 제한 없이 자유롭게 추가·수정·삭제 가능 (`admin_mypage_settings.json`, i18n ko/en)

### Changed
- `StoreSystemSettingsRequest`: `appearance.point_color_presets`의 `max:9` 제거, `appearance.background_image_ids.*`의 `regex:/^([1-9]|1[0-3])$/`를 `max:255`로 완화(임의 숫자 ID / URL / 문자열 허용), `appearance.home_background_items`의 `max:24` 제거
- 배경 ID는 관리자 입력 순서 그대로 저장(기존 숫자 정렬 로직 제거)
- i18n 문구 정리: "최대 9색"·"(1–13)" 등 고정 수량 표기 제거, 배경 안내 문구를 숫자 ID/URL 혼용 기반으로 재작성 (`lang/ko.json`, `lang/en.json`)

## [0.1.18] - 2026-05-06

### Changed
- 관리자 마이페이지 설정에서 기본 언어 제거 — 언어는 고객 선택/브라우저 감지 기준으로 유지
- 관리자 화면에 고객용 템플릿 배경 슬롯(1–13) 체크 목록 추가 (`admin_mypage_settings.json`)

## [0.1.17] - 2026-05-05

### Removed
- 플랫폼 `appearance` 저장·관리자 UI에서 **`default_theme`·`default_point_color`·`default_background_image_id`** 제거 — 고객 화면은 **허용 테마 목록 순·9색 팔레트 첫 색·배경 후보 첫 항목**으로만 초기값 도출, 관리자가 “화면”을 직접 고르지 않음

### Changed
- `defaults.json` / `frontend_schema` / `StoreSystemSettingsRequest` / 저장 시 레거시 키 제거(`stripLegacyAppearanceDefaultKeys` 등)

## [0.1.16] - 2026-05-05

### Changed
- 관리자 마이페이지 설정「화면 테마」: **게스트 홈/셸에는 플랫폼 기본 테마·포인트·배경이 자동 적용되지 않음**을 설명 문구로 명시, 초기 기본값 블록 제목/도움말 정리 (`admin_mypage_settings.json`, i18n)

## [0.1.15] - 2026-05-05

### Changed
- 관리자 마이페이지 설정: 포인트 **9색 그리드**를 한 `grid` 안에 두도록 수정(실제 사용자용 팔레트임을 안내 문구로 명시)
- **기본 포인트 컬러**는 자유 색 입력 대신 **9개 프리셋 중 Select** — 사용자가 고르는 목록과 정합

## [0.1.14] - 2026-05-05

### Added
- **`defaults_revision`**: 관리자가 플랫폼 설정 저장 시 증가(`settings/_frontend_defaults_revision`). 사용자 API·공개 defaults 응답에 포함 → 프론트가 플랫폼 기본값 재기준화

### Changed
- `UserSystemSettingsController` / `PublicFrontendDefaultsController`: 응답 `data`를 `{ defaults, settings?, defaults_revision }` 형태로 통일(공개 API는 과거 단일 객체와 호환 위해 `defaults` 래핑)
- 관리자 마이페이지 설정: **포인트 컬러 9슬롯** 색상 입력 + `appearance.point_color_presets` 최대 9개 검증
- 시스템 옵션: 폼 필드 **`on_by_default`** 로 변경(구 `default` 는 PHP 로드 시 `on_by_default` 로 승격·저장 시 제거) — JS 예약어로 인한 체크박스 미동작 완화
- `defaults.json` `system_options`: `on_by_default` 키 사용

## [0.1.13] - 2026-05-05

### Changed
- `appearance.point_color_presets` 기본값 5번째 색상을 **`#17c0e4`** 로 변경 — 템플릿 프리셋 `cyan` 과 동일(기존 5번째 `#8b5cf6` 대체)

## [0.1.12] - 2026-05-05

### Fixed
- 마이페이지 설정 관리: **메뉴 드래그·업로드 배경 목록 변경** 시 `trackChanges`가 켜지지 않아 저장 버튼이 비활성이던 문제 — `setState`에 `hasChanges: true` 병기 (`SortableMypageMenuList`, `HomeBackgroundManager`)

## [0.1.11] - 2026-05-05

### Fixed
- `SystemSettingsService`: `defaults.json` 경로를 **활성 모듈 디렉터리 우선**(`modules/moabom-system`)으로 잡고, 없을 때만 `_bundled` 폴백 — 활성만 배포된 환경에서 관리자 설정·메뉴가 비는 현상 방지
- 홈 배경 공개 URL: `url()` 절대 경로 대신 **요청 호스트 기준 상대 경로**(`/api/modules/moabom-system/home-backgrounds/...`)로 통일 — `APP_URL` 불일치 시 썸네일·배경 이미지가 깨지던 문제 완화

### Changed
- 관리자 마이페이지 설정 레이아웃: `settings` 데이터소스를 `loading_strategy: "blocking"` 으로 두어 폼(메뉴·배경 목록)이 첫 렌더 전에 채워지도록 함

## [0.1.10] - 2026-05-05

### Added
- 홈 배경 **업로드 API**: `POST/DELETE /api/modules/moabom-system/admin/home-backgrounds`, 공개 `GET .../home-backgrounds/{uuid}/{full|thumb}` (`HomeBackgroundService`, GD JPEG 변환)
- 플랫폼 설정: `appearance.home_background_items`, `appearance.include_template_backgrounds`, 조회 시 URL 보강·저장 시 id만 유지(`SystemSettingsService`)
- 관리자 마이페이지 설정: `SortableMypageMenuList`, `HomeBackgroundManager` 연동 레이아웃

### Changed
- `appearance.default_background_image_id`·사용자 `appearance.backgroundImageId`에 업로드 UUID 허용

## [0.1.9] - 2026-05-05

### Added
- 마이페이지/플랫폼 기본값: `appearance.default_background_image_id`, `appearance.background_image_ids`(노출 슬롯), 관리자 화면에 기본 배경 선택(`admin_mypage_settings.json`)
- 사용자 설정 API: `appearance.backgroundImageId`(1–13) 검증(`StoreUserSystemSettingsRequest`)

## [0.1.8] - 2026-05-05

### Changed
- `appearance.point_color_presets` 기본값에 **기존 모듈 팔레트의 보라 `#8b5cf6`(violet)** 을 템플릿 순서와 맞춰 다시 포함(총 9색).

## [0.1.7] - 2026-05-05

### Changed
- `appearance.point_color_presets` 기본값을 **moabom-basic 템플릿 프리셋**(디스코드 제외, **다크블루 `#3a5476` 포함 8색**)과 동일한 hex 목록으로 정렬

## [0.1.6] - 2026-05-04

### Changed
- `preferences.language`가 `ja`/`zh`일 때 Laravel `App::locale`은 `en`으로 두어 관리자·코어 API 메시지 축은 영어를 유지합니다. 일본어·중국어 UI 문자열은 사용자 템플릿 `GET /api/templates/{id}/lang/ja|zh.json`으로만 표시합니다.

## [0.1.5] - 2026-05-04

### Added
- API 그룹 미들웨어 `ApplyMoabomUserLocale`: 사용자 Moabom 설정의 `preferences.language`를 Laravel `App::locale`에 반영(ko/en/ja/zh). 코어 `supported_locales`가 2종이어도 Moabom 언어가 API 번역에 적용됩니다.
- `MoabomUiLocales` 상수로 허용 언어 코드를 사용자 설정 검증과 미들웨어에서 공통 사용합니다.

### Changed
- 사용자 설정 조회·저장 직후 응답 메시지가 저장된 언어 로케일을 따르도록 컨트롤러에서 로케일을 동기화합니다.

## [0.1.4] - 2026-05-03

### Changed
- 마이페이지 설정 메뉴를 업데이트 때마다 최상위로 재동기화하지 않도록 동적 메뉴 보존 구조로 변경
- 관리자 마이페이지 설정 화면을 기존 환경설정 페이지와 유사한 탭형 구성으로 정리

## [0.1.3] - 2026-05-03

### Fixed
- 일반 사용자 마이페이지가 관리자 기본 설정을 항상 조회할 수 있도록 사용자 설정 API 권한 조건 완화

## [0.1.2] - 2026-05-03

### Fixed
- 마이페이지 설정 메뉴를 플랫폼 환경설정 하위로 재배치하는 업그레이드 스텝 추가

### Changed
- 관리자 마이페이지 설정 화면을 카드형 구성과 라벨 있는 체크박스 UI로 정리

## [0.1.1] - 2026-05-03

### Fixed
- 관리자 마이페이지 설정 라우트가 모듈 라우트 병합 스키마에 맞게 등록되도록 수정

## [0.1.0] - 2026-05-03

### Added
- 마이페이지 설정 관리자 화면과 사용자별 시스템 설정 API 초기 구현
