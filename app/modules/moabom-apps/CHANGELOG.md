# Changelog

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
