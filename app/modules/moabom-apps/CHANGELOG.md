# Changelog

## [0.3.4] - 2026-06-21

### Added

- AI 스트림 전역 동시 상한·FIFO 대기열 (`AiStreamConcurrencyService`) — 슬롯 부족 시 429 + 티켓 발급.
- 대기열 API: `GET/DELETE /apps/ai/generate/queue` — 순번·예상 대기·자동 승격 조회·취소.
- 프론트 대기 패널(ChatGPT/Midjourney형): 순번 카드, 예상 대기, 진행 표시, 자동 재시도, 대기 취소.

### Changed

- `POST /apps/ai/generate/stream` — `lease_token`·`queue_ticket` 지원, 스트림 종료 시 슬롯 반환.

## [0.3.3] - 2026-06-21

### Changed

- 관리자 **AI 생성 앱 관리** 메뉴를 플랫폼 메뉴 하위(order 50)로 이동 — `moabom-system` 모듈 의존성 추가.

## [0.3.2] - 2026-06-20

### Fixed

- 레거시 생성앱 셸 iframe(`mosan.mek360.com/app/generated-app-{id}`)이 `apps.mek360.com/g/{id}` 를 로드할 때 비로그인 게스트가 404 되던 문제 — dedicated_host 프리뷰 origin 에서 tenant/global 공개 HTML 은 token 없이 서빙(Hosted data API 는 기존처럼 token 필수).
- `apps.mek360.com` 이 `platform_hosts` 미등록 시 tenant slug `apps` 로 오인되던 Host 파싱 — `moabom.saas.override_host_parse` 훅으로 platform 부트 보정.
- SaaS 기본 `platform_hosts` 에 `apps.mek360.com` 포함(운영 env 와 dev parity).

## [0.3.1] - 2026-06-20

### Fixed

- 관리자 AI 생성앱 목록에서 공개 범위(visibility) 변경이 반영되지 않던 문제 — 필터 적용 후 `listOverride`가 refetch 결과를 가리던 UI 버그, `sequence` 내 PATCH body 바인딩, 즉시 반영용 낙관적 Select 값 보정.
- 관리자 visibility 변경 시 `is_shared` 레거시 플래그를 visibility와 함께 갱신해 카탈로그·목록 표시가 어긋나지 않도록 정리.

## [0.3.0] - 2026-06-12

### Added

- AI 앱 생성 SSE 스트리밍 API: `POST /apps/ai/generate/stream`
- 생성 세션(`moabom_ai_generation_sessions`) — 중간 저장·이어하기·리믹스 대화 히스토리
- 세션 API: `GET /apps/ai/sessions/active`, `GET /apps/ai/sessions/{id}`
- 프론트: 실시간 코드 패널, 토큰 잘림 「이어서 완성」, 세션 재진입 배너

## [0.2.0] - 2026-06-07

### Changed

- 백엔드 계층 정렬(그누보드7 AGENTS.md 준수): `AiAppService` 의 직접 모델 쿼리/`$app->update()` 를 제거하고 `GeneratedAppRepositoryInterface` 로 위임.
- `app_type` 허용값 중복 정의(두 FormRequest)를 `AppType` Backed Enum 의 `values()` 로 단일화. 허용 집합·검증 동작은 기존과 동일.
- 폴백 안내(notice) 사용자 노출 문구를 `__()` 다국어로 전환(ko/en). AI 모델로 전달되는 프롬프트 문자열은 기능성 콘텐츠이므로 다국어화 대상에서 제외.

### Added

- `GeneratedAppRepositoryInterface` / `GeneratedAppRepository` 및 `AppsServiceProvider` 바인딩.
- `AppType` Enum 및 `AppTypeTest`.
- `apps.ai.notice.*` 다국어 키.

## [0.1.0] - 2026-06-02

### Added

- `moabom-system`에서 분리한 사용자 앱 인프라 모듈 신규 추가.
- AI 앱 HTML 생성/저장 API: `/api/modules/moabom-apps/apps/{ai,generated}/*`.
- AI 프로바이더(Anthropic/OpenAI/Google) 프록시 제공.
- 사용자 생성 앱은 `moabom_system_generated_apps` 테이블에 보관(기존 테이블명·데이터 호환 유지, `Schema::hasTable` 멱등 가드).
- 환경변수(`MOABOM_AI_*`, `MOABOM_ANTHROPIC_*`, `MOABOM_OPENAI_*`, `MOABOM_GOOGLE_AI_*`)는 기존 값 그대로 호환 유지.
