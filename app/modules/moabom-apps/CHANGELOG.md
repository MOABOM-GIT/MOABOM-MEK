# Changelog

## [0.5.4] - 2026-06-30

### Fixed

- 웹사이트 연결 앱 저장 후 파비콘 API(`/website-icon`)가 404를 반환하던 문제를 수정했습니다. 스토리지 경로 정규화 오류와 저장 파일 없이 내부 URL만 남는 메타데이터를 정리하고, head·well-known 경로 단계별 추출·매직 바이트 검증으로 아이콘 저장을 안정화했습니다.

## [0.5.3] - 2026-06-30

### Fixed

- 웹사이트 연결 앱 생성 시 head에 `<link>`가 여러 개인 사이트에서 파비콘을 찾지 못하던 문제를 수정했습니다. `sizes`에 복수 크기가 적힌 아이콘도 올바르게 해석합니다.

## [0.5.2] - 2026-06-29

### Changed

- 앱 순위에서 커뮤니티 별점·리뷰 수 가중치 보너스를 제거해, 열기·체류 시간 기반 점수만으로 일반앱과 생성앱이 공정하게 경쟁하도록 조정.

## [0.5.1] - 2026-06-29

### Fixed

- Hosted(앱 서버에 저장) 생성앱 저장 시 500 — platform DB 앱 row 갱신 후 `fresh(['user'])`가 `moabom-platform.users`를 조회하던 cross-DB eager load 제거. 소유자 조회는 기존처럼 `GeneratedAppOwnerResolver` 경로만 사용.

## [0.5.0] - 2026-06-29

### Added

- 앱 SEO/AI 검색 노출 — 기본 제공 앱과 전역 공개(visibility=global) 제작앱을 메인 사이트 `/app/{id}`·`/apps` 경로에서 봇 전용 서버렌더(메타·OpenGraph·schema.org 구조화데이터·읽을 수 있는 본문)로 노출. 그누보드7 코어 SEO 봇 파이프라인의 확장 슬롯(`core.seo.filter_view_data`·`core.seo.resolve_is_bot`·`SitemapContributorInterface`)만 사용하며 코어는 수정하지 않음.
  - `AppSeoDataService` — 기본앱(AppRegistry + config 보강) + 전역 공개 제작앱만 SEO 디스크립터로 정규화하는 단일 가드. private/tenant 제작앱은 절대 비노출.
  - 공개 SEO API(`GET /api/modules/moabom-apps/seo/apps`·`/seo/apps/{id}`) — 인증 불필요, 전역 공개분만. 외부 검색·AI 소비자용.
  - `moabom-basic`: `layouts/seo/app_detail.json`·`apps_index.json`(components=HomePage 유지로 SPA 무변경) + routes.json `/app/:id`·`/apps` 매핑 교체.
  - `AppsSitemapContributor` — `/apps` + 기본앱 + 전역 공개 제작앱 URL을 sitemap.xml에 기여.
  - AI 크롤러(GPTBot/ClaudeBot/PerplexityBot/Google-Extended 등) User-Agent 봇 판정 + robots.txt Sitemap·허용 + `llms.txt` 인덱스.
  - `AppSeoCacheListener` — 전역 공개 제작앱 저장/삭제 시 `/app/generated-app-{id}`·`/apps` SEO 캐시 무효화(다음 크롤러 요청에 lazy 재생성).
  - 전역 공개 제작앱 중복콘텐츠 방지용 canonical 호스트(`MOABOM_APPS_SEO_CANONICAL_BASE`, 기본 `app.url`) 적용.

## [0.4.4] - 2026-06-28

### Fixed

- 앱 리뷰 관리자 목록의 표 본문이 한 줄도 렌더링되지 않던 문제 수정 — 행 반복(iteration) 정의가 템플릿 엔진이 읽지 않는 `data` 키를 사용해 항상 빈 배열로 평가되던 것을, 엔진 규격에 맞는 `source` 키와 행(Tr) 단위 반복으로 교정. 관리자 API가 정상적으로 리뷰를 반환해도 화면에 목록이 보이지 않던 근본 원인.

### Removed

- 디버깅 과정에서 추가했던 임시 산출물 정리 — 진단 전용 `moabom:apps:community-doctor` 아티즌 커맨드와 그 등록부, 그리고 이미 `create`(000001)·`alter unique`(000003) 마이그레이션과 완전히 중복되던 수렴 보장 마이그레이션(000010)을 제거. 운영 스키마·런타임 동작에는 영향 없음(중복 제거).

## [0.4.3] - 2026-06-28

### Added

- 앱 리뷰 데이터 저장소 진단 도구를 추가해 플랫폼·기본 데이터베이스 중 어디에 리뷰가 저장되어 있는지, 작성·관리자 조회 경로가 동일한 저장소를 사용하는지 운영에서 정확히 확인할 수 있도록 함.

## [0.4.2] - 2026-06-28

### Fixed

- 앱 리뷰가 관리자 화면에 나타나지 않던 문제 수정 — 플랫폼 DB의 앱 리뷰 테이블/제약을 어떤 상태에서도 안전하게 최종 상태로 수렴시키는 보장 마이그레이션을 추가해, 사용자가 작성한 별점글과 관리자 조회가 동일한 데이터 저장소에서 정합하도록 함.
- 앱 리뷰 테이블 제약 변경 마이그레이션이 신규 환경에서 존재하지 않는 인덱스를 제거하려다 중단되던 문제를 인덱스 존재 확인 기반으로 수정.

### Changed

- 앱 리뷰 관리자 목록이 데이터 저장소 준비 상태(테이블 존재 여부·전체 글 수)를 응답에 포함하고, 글이 없을 때 그 원인(테이블 미준비 / 필터로 제외됨)을 화면에서 바로 안내하도록 개선.

## [0.4.1] - 2026-06-28

### Fixed

- 앱 리뷰 관리자 목록이 앱 소유 업체와 작성자 업체 조건을 명확히 구분해 조회되도록 개선하고, 빈 목록 원인을 응답 메타에서 확인할 수 있도록 보강.
- 앱 리뷰 관리 화면의 상태·별점 필터, 초기 tenant 필터, 초기화 버튼, 상태 변경·삭제 진행 상태를 정리해 관리자 목록 조작 흐름을 안정화.

### Changed

- 앱 리뷰 공개 범위가 생성앱 공개 범위를 상속하는 정책을 회귀 테스트로 고정해 전체 공개·업체 공개·비공개 앱의 리뷰 노출 범위를 명확화.

## [0.4.0] - 2026-06-28

### Fixed

- 앱 리뷰 admin `tenant_slug` 필터 — 작성자 tenant 가 아닌 **앱 소유 업체**(`generatedApp.tenant_slug`) 기준으로 통일. 생성앱 admin 과 동일 semantics.
- 비공개 앱 소유자가 플랫폼·전용 프리뷰 host 에서 리뷰 작성 시 404 되던 문제 — 소유 앱 단건 열람 시 `scopeOwnedForViewer` 로 tenant 불일치 허용.
- 작성자 tenant 미해석(`unknown`) 시 리뷰 저장 거부(422) — orphan 데이터 방지.

### Added

- 생성앱 admin 목록 API·화면 — `community_post_count`·`community_rating_avg` 집계 표시.
- 앱 리뷰 admin — 앱 소유 업체·작성자 업체 분리 필터(`tenant_slug`, `author_tenant_slug`), 플랫폼 host 테이블 컬럼.

## [0.3.9] - 2026-06-28

### Changed

- 운영 초기화 마이그레이션 — `moabom_app_community_posts` 전체 삭제·생성앱 community 집계 컬럼 리셋 (1회성).

## [0.3.8] - 2026-06-28

### Fixed

- 앱 이야기 `tenant_slug` — 작성자 tenant SSOT(`AppCommunityTenantScope`)로 저장·조회. 앱 소유 tenant 덮어쓰기 제거.
- unique 인덱스 `(generated_app_id, tenant_slug, user_id, post_type)` — cross-tenant `user_id` 충돌 방지.
- `findReviewForUser` tenant 필터, purge `forceDelete`, 동시 작성 unique → 409, write throttle.

### Changed

- 목록·관리자 API 작성자 nickname **tenant_slug 배치 조회** (N+1 제거).
- stats 집계 단일 SQL, post 변경+stats recalculate transaction 래핑.
- read/write 권한 없음 응답 404 통일.

## [0.3.7] - 2026-06-28

### Fixed

- 앱 이야기 목록 API 500 — platform DB 글에서 `users` 관계 eager load 시 잘못된 connection 조회. `tenant_slug` 기준 작성자 resolver로 교체.

## [0.3.6] - 2026-06-28

### Added

- **앱 이야기 (App Community) MVP** — `generated_app_id` 단위 리뷰·별점 plane (`moabom_app_community_posts`).
- 사용자 API: 요약·목록·작성·수정·삭제 (`/apps/generated/{id}/community/*`).
- 관리자 API·화면: 앱 이야기 전체 목록, 숨김·삭제 (`/admin/apps/community/posts`).
- 생성앱 `permissions` 확장: `can_community_read` / `can_community_write`.
- moabom-basic: 생성앱 뷰어 툴바 **앱 이야기** 버튼, 별도 셸 창 UI.

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
