# Changelog — moabom-smart-chat

## [0.8.7] - 2026-07-29

### Changed
- 허용 모델을 대화 특화 6칸으로 재구성: Claude Sonnet/Haiku · GPT-5.3 Chat / 5.4 Mini · Gemini 3.6 Flash / 3.5 Flash-Lite. `models` API에 `label` 포함. 폐기된 GPT 슬롯 제거.

## [0.8.6] - 2026-07-29

### Changed
- "이 답으로 앱 만들기" 핸드오프가 제작 프롬프트와 함께 앱 제목(`TITLE`)도 반환합니다. LLM 실패 시에도 질문/답변 기반 폴백 제목·프롬프트를 제공합니다.

## [0.8.5] - 2026-07-28

### Changed
- "이 답으로 앱 만들기" — 답변 원문을 그대로 넘기지 않고, 질문+답변을 LLM 으로 요약해 앱 제작 프롬프트(목적·핵심 기능·화면 구성·데이터 항목)로 변환한 뒤 AI 앱 만들기 프롬프트에 채워 넣음. `POST handoff-prompt` 엔드포인트 신설, 요약 실패 시 구조화된 폴백 프롬프트로 이어감.
- "기억하기" — 답변 전체를 500자에서 잘라 저장하던 것을, 200자 초과 시 핵심 팩트만 LLM 요약 후 저장하도록 변경 (`memories` 요청에 `summarize` 플래그). 설정 패널의 직접 입력 메모리는 입력 그대로 저장. 요약 실패 시 기존처럼 잘라 저장.
- 공개 공유 링크 — JSON 응답 대신 브라우저에서 바로 읽히는 평문(txt) 응답으로 변경. 제목·공유일 다음 [User]/[Assistant] 본문 (`text/plain; charset=UTF-8`).

## [0.8.4] - 2026-07-28

### Fixed
- `query_platform_data` `like` 필터에 `%` 가 없으면 완전일치가 되어 0행이 나오던 문제 — 부분일치(`%값%`)로 자동 래핑. "양압기 앱 추천" 류 검색 실패의 마지막 원인. 도구 스모크에 부분일치 검색 검증 추가.

## [0.8.3] - 2026-07-28

### Fixed
- `get_popular_apps` 모듈 앱 제목이 `"Array"` 로 나오던 문제 — 매니페스트 `name` 이 i18n 맵(array)인 경우 로캘 우선(ko→en→첫 값)으로 해석. 도구 스모크에 `Array`/미해석 제목 검출 추가.

## [0.8.2] - 2026-07-28

### Fixed
- `get_popular_apps` 제목 전멸("제목 없음") 구조 결함 — 셸 랭킹 `app_id` 는 문자열 셸 ID 인데 숫자 PK 로 캐스팅해 매칭이 항상 실패. `generated-app-{id}` 는 platform DB(SSOT)에서, 모듈 앱은 앱 레지스트리에서 이름을 해석하고 응답에 `kind`(platform_app|generated_app) 구분 추가.

### Added
- `deploy/smoke-smart-chat-tools.sh` — 배포 후 운영 데이터 기준 도구 실행 결과(행 수·제목 매칭)를 검증하는 읽기 전용 스모크 게이트.

## [0.8.1] - 2026-07-28

### Fixed
- Gemini 3.x function calling 400 (운영) — 스트림 파서가 `thoughtSignature` 를 버려 2라운드 요청에서 `INVALID_ARGUMENT` 발생, 도구를 쓰는 모든 질문이 실패. functionCall·text part 의 서명을 캐처해 후속 요청에 그대로 에코백.
- 스트림 컨트롤러 `Throwable` catch 가 로그 없이 오류를 삼키던 문제 — `moabom-smart-chat.stream_failed` 오류 로그 추가 (관측성).

## [0.8.0] - 2026-07-28

### Changed
- 데이터 카탈로그 리소스 소유권 분산 (Phase 3)
  - apps·my_apps·app_reviews → moabom-apps, my_credit_transactions → moabom-credit 프로바이더가 `moabom.smart_chat.data_resources` 필터로 직접 등록
  - 스마트챗 내장 카탈로그는 소유 모듈 없는 벤더 확장(sirsoft-board `board_posts`)만 대리 등록
- 웹검색 push 주입 → `search_web` function calling(pull) 통합
  - 사용자 턴 토글 ON 일 때만 스펙 노출 (크레딧 서차지 동의 게이트), LLM 이 필요할 때 자체 쿼리로 호출
  - 서차지 정산은 도구가 실제 실행된 턴에만 부과, done payload sources 는 도구 결과에서 URL 중복 제거 후 수집

### Added
- 도구 호출 감사 로그 `moabom-smart-chat.tool_call` (user_id·tool·args 300자·ok·duration_ms)
- 크레딧 출석 리소스 `my_credit_attendances` (moabom-credit 등록, 본인 스코프)
- 답변 하단 "참고한 데이터" 칩 — 이번 턴에 AI 가 실제 사용한 도구 표시

## [0.7.0] - 2026-07-28

### Added
- 범용 데이터 카탈로그 쿼리 도구 `query_platform_data` (Phase 2)
  - 선언적 리소스 카탈로그: apps(공개 앱+평점/리뷰 카운터), my_apps, app_reviews(공개 앱의 published 리뷰), my_credit_transactions(본인), board_posts(공개 글 메타데이터만)
  - 구조화 쿼리 DSL: select/filters(7종 연산자)/aggregates(count·sum·avg·min·max)/group_by(일·월 transform)/order_by/limit
  - 서버 강제 안전장치: 컬럼·리소스 allowlist 검증, 권한 스코프(본인/공개·테넌트 정책 SSOT 재사용) 주입, row 상한 50, 문자열 300자 절단, 자유 SQL 불허
  - 확장 포인트: `moabom.smart_chat.data_resources` 필터로 타 모듈이 리소스 등록 (질문 유형별 코드 추가 불필요)
  - config: `tools.data_query.enabled` / `max_rows`

## [0.6.0] - 2026-07-28

### Changed
- 사이트 데이터 push 주입 → LLM function calling(pull) 아키텍처 전환 (Phase 1)
  - 3사(OpenAI·Anthropic·Google) tool-call 스트림 파싱 + 멀티턴 도구 호출 루프 (`tools.function_calling.max_iterations`, 기본 3 — 초과 시 도구 없이 텍스트 답변 강제)
  - 프로필·날씨·크레딧·인기 앱은 도구 스펙만 선언, LLM 이 필요할 때만 조회 (턴당 고정 주입 토큰·DB 조회 제거)
  - 시스템 프롬프트에는 현재 시각·닉네임 한 줄만 유지 (닉네임 호칭용)
  - `tool` SSE 이벤트 추가 (조회 상태 프론트 표시), done/settle 에 실사용 도구 기록
- 도구 실행 실패는 error payload 로 반환 — 스트림 유지

## [0.5.0] - 2026-07-28

### Added
- 사이트 툴 확장 — 내 크레딧(잔액·적립/사용 합계·일별 사용 상위·최근 내역), 공개 앱 인기 랭킹을 대화 컨텍스트로 제공
- 사이트 툴 활용 지침 블록 주입 (질문과 관련 있을 때만 근거로 활용)

### Changed
- 사이트 툴 토글 제거 — 계정 권한 범위의 플랫폼 데이터를 기본으로 항상 제공 (요청 tools 미지정 시 전체 활성)
- 웹검색은 대화 툴바 토글만 사용 (기본 OFF)

## [0.4.2] - 2026-07-27

### Fixed
- `SmartChatController` base class → `App\Http\Controllers\Api\Base\AuthBaseController` (운영 500)
- `SmartChatAttachmentService` 에 `storageServices` contextual binding (StorageInterface 미주입 500)

## [0.4.1] - 2026-07-27

### Fixed
- `serializeConversation` / folder lazy-load, 웹검색 턴 플래그와 preflight·settle 정합
- upstream `no_key`/`error` 시 과금 스킵 + settle 실패 로그/`done.credit`
- 공유 `share_url`·복사, Stop 후 메시지 재동기화, 빈 tools 배열 전달, 분기 parent=complete assistant
- create-app 핸드오프가 resume 세션에 덮어씌워지지 않도록 우선순위 보정

## [0.4.0] - 2026-07-27

### Added
- 사용자 메모리(기억) CRUD + LLM 컨텍스트 주입
- 폴더 1단 (대화 이동·필터)
- 읽기 전용 공유 링크 (`public/shares/{token}`)
- 토큰 usage 파싱·저장 + Admin `token_billing_enabled` / 1K 단가

## [0.3.0] - 2026-07-27

### Added
- create-app 핸드오프 (`이 답으로 앱 만들기`)
- 내 생성앱 Q&A 컨텍스트 (`generated_app_id`)
- 사이트 툴 allowlist (weather·profile) + Tool registry
- 웹검색 옵트인 (DuckDuckGo Instant Answer) + 출처 + 크레딧 할증
- 단순 분기 (`parent_id` / 「이 지점에서 다시」)

## [0.2.0] - 2026-07-27

### Added
- 이미지·문서(txt/md/csv/pdf) 첨부 업로드·멀티모달/텍스트 추출
- 커스텀 지시문(preferences) API
- 첨부 시 `ai_spend.attachment_surcharge` 할증

## [0.1.0] - 2026-07-27

### Added
- AI 스마트챗 모듈: 대화 CRUD, SSE 멀티턴 스트림, Gemini 기본 모델
- moabom-apps AI 키·모델 맵 재사용, create-app과 분리된 스트림 동시성 게이트
- 개인 크레딧 Preflight/Spend 훅 (`ai_spend.smart_chat_*`, 기본 비활성)
