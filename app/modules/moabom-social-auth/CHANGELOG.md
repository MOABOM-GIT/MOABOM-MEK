# Changelog

## [Unreleased]

### Added

- **Admin host scope 확장 SSOT:** [`docs/ADMIN-HOST-SCOPE.md`](docs/ADMIN-HOST-SCOPE.md) — host_scope × abilities 4계층, AI·운영 체크리스트.
- Cursor rule: `.cursor/rules/moabom-social-auth-admin-scope.mdc`
- Unit test: `SocialAuthAdminHostScopeTest`

## [0.2.13] - 2026-06-01

### Fixed

- SaaS **platform host(mek360.com)** SNS OAuth도 tenant와 동일하게 `auth.mek360.com` 브로커 경유 — Provider Redirect URI 단일 SSOT 유지.
- `SocialAuthTenantRuntimeSwitcher::bootstrapOriginByHost()` — broker callback 시 platform·tenant 런타임 분기.

## [0.2.12] - 2026-06-01

### Fixed

- `SocialProviderService::resolveProviderCredential()` — master credential 조회 시 `$provider` 미전달로 OAuth callback/token 교환 단계에서 `Undefined variable $provider` 발생하던 버그 수정.

## [0.2.11] - 2026-06-01

### Fixed

- `loadPlatformMasterProviders()` cross-DB 조회: Laravel `DB_PREFIX`가 `information_schema`·qualified table에 잘못 적용되던 문제 → raw SQL + 물리 테이블명(`g7_social_auth_settings`) + `moabom-db` 하이픈 허용.
- `moabom:social-auth:diag-settings` 진단 command 추가.

### Changed

- tenant SNS provider 기본 `enabled=true` (신규 provision·`tenant-sync-social-auth` 백필).

## [0.2.10] - 2026-06-01

### Added

- `TenantSocialAuthDatabaseSeeder` — tenant DB에 google/kakao/naver 기본 row idempotent seed (`use_master_defaults=true`, credential null).

## [0.2.9] - 2026-06-01

### Changed

- 서브 테넌트 Admin GET 응답에 마스터(write DB) credential effective 병합 — ID/Secret 읽기 전용 표시.
- cross-DB master credential 조회 시 Laravel encrypted 값 복호화.
- 서브 테넌트 저장은 provider `enabled`만 갱신하고 broker/credential/options 는 마스터 상속 유지.

### Added

- Admin UI: 서브 테넌트 안내 배너, 카드별 "마스터 키 상속 중" 배지, "전체 provider 설정 저장" 버튼 문구.

## [0.2.8] - 2026-06-01

### Fixed

- popup OAuth `popup-complete`에서 Laravel session 필수 검증을 제거해 broker 경유 popup 완료가 `invalid_popup_session`으로 실패하던 문제 수정.
- popup-complete HTML이 `window.location.origin` 기준으로 `postMessage`를 전송하도록 정합.

## [0.2.7] - 2026-06-01

### Added

- `moabom:social-auth:seed-platform-master` — 플랫폼 write DB(moabom-db)에 master SNS credential·broker row idempotent 시드.
- `moabom:social-auth:ensure-defaults` — 현재 DB connection에 provider 기본 row 보장.

### Fixed

- 서브 테넌트 master credential cross-query가 `moabom-platform`(레지스트리 DB)을 조회하던 오류를 **write DB(moabom-db)** 로 수정.

## [0.2.6] - 2026-06-01

### Changed

- SNS 설정 저장소를 `social_auth_settings` DB로 전환하고 레거시 파일 fallback 쓰기를 제거해 Cloud Run 재배포 시 설정 유실/분기 저장을 차단.
- SaaS 서브 테넌트 정책을 "provider on/off 저장 가능 + 키/시크릿은 마스터 상속 고정"으로 정렬해, `use_master_defaults=false` 입력을 서버에서 차단.
- 브로커 기본 판정을 보강해 `MOABOM_SOCIAL_AUTH_BROKER_ENABLED` 미지정 시 SaaS 활성 상태를 기본값으로 사용하고, broker host 기본값을 `auth.{base_domain}`으로 계산.

## [0.2.5] - 2026-06-01

### Changed

- 테넌트별 SNS 활성화(google/kakao/naver) 체크박스 저장 정책을 유지하면서 provider별 `*_use_master_defaults` 옵션을 추가해 마스터 키 상속/테넌트 전용 키 입력을 선택 가능하도록 확장.
- 활성 provider 검증에서 `use_master_defaults=true`인 경우 tenant client_id/client_secret 필수 검증을 건너뛰도록 조정.
- 런타임 credential 해석 우선순위를 `SOCIAL_AUTH_MASTER_*` → `SOCIAL_AUTH_*` → tenant 저장값으로 정리해 마스터 공통키 정책과 테넌트 오버라이드를 동시에 지원.
- `use_master_defaults=true`로 저장 시 tenant credential 값을 제거해 마스터 키 변경 반영이 즉시 일관되게 적용되도록 정리.

## [0.2.4] - 2026-05-15

### Fixed

- 관리자 SNS 설정의 `callback_urls`를 요청 호스트가 아닌 **`url()`(APP_URL) 기준**으로 생성해, OAuth 기본 `redirect_uri`와 표시 값이 어긋나지 않도록 정합.
- `providers` 저장 시 `*_redirect_uri`가 **비어 있으면 JSON에서 키를 제거**해 오래된 빈 오버라이드 없이 `url()` 기본 콜백이 쓰이도록 정리.

### Changed

- 콜백 경로 문자열을 `Support\SocialAuthCallback` 단일 클래스로 모음(`SocialProviderService`·`SocialAuthSettingsController`).
- `SocialAuthService`의 `resolveUser` PHPDoc 중복 제거.

## [0.2.3] - 2026-05-14

### Changed

- `g7_version`을 `>=7.0.0-beta.1,<8.0.0`로 조정(코어 빠른 베타 릴리스에 매니페스트를 묶지 않음)
- `moabom-system` 의존 하한 `>=0.6.10`

## [0.2.2] - 2026-05-14

### Added

- MIT `LICENSE`

### Changed

- `moabom-system` 의존 버전 하한을 `>=0.6.9`로 조정(이식 가이드·LICENSE 정리와 맞춤)

## [0.2.1] - 2026-05-14

### Changed

- 관리자 메뉴: `platform-settings` 부모는 `moabom-system`이 담당 — SNS는 `parent_slug`로 **형제** 자식만 등록 (`module.json`에 `moabom-system` 모듈 의존성 추가)

## [0.2.0] - 2026-05-14

### Changed

- 모듈 식별자·URL·권한·훅·다국어 네임스페이스를 `sirsoft-social-auth`에서 `moabom-social-auth`로 변경 (OAuth 콜백 URL은 각 Provider 콘솔에서 새 경로로 갱신 필요)
- PHP 네임스페이스를 `Modules\Moabom\Social\Auth`로 정렬 (디렉터리 `moabom-social-auth`의 코어 네임스페이스 규칙과 일치)
- `SocialSettingsServiceInterface` DI 계약을 `Modules\Moabom\Social\Auth\Contracts`에 명시

## [0.1.12] - 2026-05-06

### Changed
- 관리자 사이드바에서 **플랫폼 환경설정**(`platform-settings`) 최상위 메뉴 순서를 `order: 90 → 2` 로 조정 — 「대시보드」와 「환경설정」 사이에 표시되도록 `getAdminMenus()` 갱신 (`module.php`)

## [0.1.11] - 2026-05-03

### Added
- 사용자 프로필 응답에 DB 연결 기준 SNS provider 정보를 추가

## [0.1.10] - 2026-05-03

### Changed
- SNS 신규 가입 시 교환(exchange) 단계에서 프로필 보완 입력 없이 바로 토큰을 발급하도록 변경 — 추가 정보는 코어 마이페이지 프로필 API에서 저장 (`SocialAuthService::exchangeCode`)

## [0.1.9] - 2026-05-01

### Added
- SNS 신규 가입자용 프로필 보완 대기 상태와 complete-profile API 추가
- SNS 교환 코드에 프로필 보완 필요 여부와 완료 일시 저장 컬럼 추가

## [0.1.8] - 2026-05-01

### Changed
- 카카오 이메일 권한 미승인 상태에서도 닉네임/프로필 기반 SNS 계정 생성과 재로그인이 가능하도록 내부용 임시 이메일 처리 추가
- 카카오 OAuth 요청 scope를 현재 승인된 프로필 동의항목 중심으로 명시

## [0.1.7] - 2026-05-01

### Added
- SNS OAuth 팝업 완료 페이지와 부모 창 postMessage 전달 흐름 추가

## [0.1.6] - 2026-05-01

### Changed
- SNS 연결설정 화면에서 provider별 자동 생성 Callback/Redirect URI와 중복되는 상단 안내 문구 제거

## [0.1.5] - 2026-04-30

### Changed
- SNS 연결설정 화면에서 중복 Redirect URI 입력칸을 제거하고 현재 도메인 기준 Callback/Redirect URI 자동 사용 안내로 정리

## [0.1.4] - 2026-04-30

### Added
- SNS 연결설정 관리자 화면에 현재 도메인 기준 provider별 Callback/Redirect URI 표시 추가

## [0.1.3] - 2026-04-30

### Added
- SNS 연결설정 관리자 화면의 Google, Kakao, Naver 패널에 Client ID/Secret 발급 및 관리 콘솔 링크 추가

## [0.1.2] - 2026-04-30

### Fixed
- Naver 토큰 발급 요청에 OAuth state 파라미터를 함께 전달하도록 수정
- provider callback 실패 응답의 error_description을 로그인 화면 오류 메시지로 전달

### Added
- Kakao Client Secret 사용 여부 설정과 활성 provider 필수값 검증 추가
- Google 보안 번들 auth_time 클레임 요청 옵션 추가

## [0.1.1] - 2026-04-30

### Added
- 플랫폼 환경설정 > SNS 연결설정 관리자 메뉴와 설정 화면 추가
- Google, Kakao, Naver OAuth client ID/secret/redirect URI 저장 API 추가

### Changed
- SNS OAuth 런타임 설정을 관리자 저장값 우선, 환경변수 fallback 순서로 조회하도록 변경

## [0.1.0] - 2026-04-30

### Added
- Google, Kakao, Naver SNS 가입 및 로그인 모듈 초기 구현
- SNS 계정 연결 테이블과 일회용 프론트 토큰 교환 코드 테이블 추가
- 동일 이메일 기존 계정 연결 및 신규 사용자 생성 후 Sanctum 토큰 발급 처리 추가
