# Moabom 기술 부채 감사 (Tech Debt Audit)

**범위:** `app/modules/moabom-*`, `app/templates/moabom-*`, `app/plugins/moabom-*`, Moabom 관련 `deploy/`·`scripts/`  
**제외:** sirsoft-* 확장, G7 코어 (`app/app`, `app/resources/js/core`, 코어 `routes/`·`config/`·`migrations/`)

**작성:** 2026-06-22  
**상태 키:** `pending` · `in_progress` · `done` · `wontfix` (의도적 유지)

이 문서가 Moabom 영역 기술 부채의 **SSOT**이다. 항목을 해결할 때마다 상태·메모를 갱신한다.

---

## 진행 요약

| 우선순위 | 전체 | 완료 |
|----------|------|------|
| P0 드리프트·버그 | 4 | 4 |
| P1 구조 비대 | 8 | 0 |
| P2 빈 껍데기·중복 | 10 | 4 |
| P3 테스트·배포 가드 | 6 | 0 |

---

## P0 — 드리프트·버그 폭탄 (최우선)

| ID | 상태 | 문제 | 경로 | 조치 |
|----|------|------|------|------|
| TD-201 | `done` | AI HTML sanitize PHP↔TS 이중 구현, strip 규칙 불일치 (`moabom-app-runtime`) | `GeneratedAppHtmlService.php`, `aiHtmlUtils.ts` | TS strip에 `moabom-app-runtime` 추가 (2026-06-22). CSP·전체 SSOT 통일은 후속 |
| TD-202 | `done` | CPAP `recommend` 알고리즘 PHP↔TS 완전 복제 (~263 vs ~515줄) | `CpapRecommendEngine.php`, `cpapRecommendMask.ts` | `recommend-rules.json` SSOT + `CpapRecommendEngine` 분리 + parity fixtures (2026-06-22). MediaPipe 측정 로직은 TS 전용 유지 |
| TD-203 | `done` | 컨설팅 시뮬레이션 PHP↔TS 이중, 계수 SSOT 2곳 | `ProfitabilitySimulationService.php`, `simulationModel.ts` | `resources/simulation-model.json` SSOT + PHP parity 테스트 (2026-06-22). 계산 로직 이중은 유지(서버 권위·클라 미리보기) |
| TD-204 | `done` | SaaS DB connection swap 3곳 복붙 | `GeneratedAppPurgeService`, `GeneratedAppOwnerResolver` | `TenantDatabaseConfigurator::runOnDatabase()` SSOT (2026-06-22) |

---

## P1 — 구조적 비대 (god 파일·과분할)

| ID | 상태 | 문제 | 경로 | 조치 |
|----|------|------|------|------|
| TD-301 | `pending` | 셸 윈도우 god hook **1,016줄** | `useMoaShellWindows.ts` | `windowManager` 순수 모듈 + 얇은 훅 |
| TD-302 | `pending` | G7 layout loader 템플릿 재구현 **735줄** | `boardWindowLayoutRuntime.ts` | 코어 LayoutLoader 의존 또는 공통화 |
| TD-303 | `pending` | 앱 카탈로그 god hook **~506줄** | `useMoaHomeAppCatalog.ts` | `appCatalogStore` + 이벤트 구독 |
| TD-304 | `pending` | `shell/` **37파일** 미니 프레임워크 | `src/shell/*` | `core` / `windows` / `bridges` 3묶음 재편 |
| TD-305 | `pending` | DataGrid monolith **1,553줄** | `moabom-admin_basic/.../DataGrid.tsx` | column·pagination·selection 분리 |
| TD-306 | `pending` | GeneratedApp 서비스 6개 + Support 9개 | `moabom-apps/src/Services`, `Support/` | 1~2 서비스로 병합 |
| TD-307 | `pending` | presence 6서비스·직렬화 중복 | `moabom-presence/` | `PresenceService` + `FriendshipService` 축소 |
| TD-308 | `pending` | `AiGenerationSessionService` repository pass-through | `AiGenerationSessionService.php` | 의미 있는 도메인 메서드만 유지 |

---

## P2 — 빈 껍데기·삼중 SSOT·복제

| ID | 상태 | 문제 | 경로 | 조치 |
|----|------|------|------|------|
| TD-101 | `done` | dead `isTenantHostRequest()` (호출 없음) | `SocialAuthBrokerStateService.php` | private 메서드 삭제 (2026-06-22) |
| TD-102 | `done` | `moabomSystemStateEqual.ts` 21줄 단독 파일 | ~~`utils/moabomSystemStateEqual.ts`~~ | `moabomSystemStore.ts`로 병합·파일 삭제 (2026-06-22) |
| TD-103 | `done` | `MY_PAGE_TABS` 3곳 정의 | ~~`moabomMypageTabIds.ts`~~, `moabomShellRoutes.ts`, `myPageConstants.ts` | `myPageConstants.MY_PAGE_TABS` SSOT (2026-06-22) |
| TD-104 | `wontfix` | `shellDeferredExtensions` 빈 매핑 + 테스트만 | `shellDeferredExtensions.ts` | 의도적 확장 포인트 — lazy 확장 필요 앱 생기면 매핑만 추가 (2026-06-22) |
| TD-105 | `pending` | 가상 앱 ID 5파일 (각 15~40줄) | `moaShellBoardIds.ts` 등 | `moaShellVirtualApps.ts` 통합 |
| TD-106 | `pending` | `FileUploader/**` 템플릿 간 복제 | basic ↔ admin_basic | SSOT 1곳 |
| TD-107 | `pending` | `components/basic/**` 양 템플릿 이중 | basic, admin_basic | diff 최소 정책 또는 공유 |
| TD-108 | `done` | social provider `['google','kakao','naver']` 3곳 | social-auth 시더·설정 | `SocialAuthProviders` SSOT (2026-06-22) |
| TD-109 | `pending` | `MoabomModuleSettingsService` / `PluginSettingsService` 복붙 | `moabom-system` | 공통 헬퍼 |
| TD-110 | `pending` | `guard-no-host-build.cjs` 2벌 | `app/scripts/`, `templates/.../scripts/` | 공유 1개 |

---

## P3 — 테스트·문서·배포 가드 비대

| ID | 상태 | 문제 | 경로 | 조치 |
|----|------|------|------|------|
| TD-401 | `pending` | SaaS 런타임 grep **1,090줄** | `check-saas-runtime-invariants.sh` | 도메인별 분할 또는 매니페스트 러너 |
| TD-402 | `pending` | refactor invariants 혼합 | `check-moabom-refactor-invariants.sh` | hospital/vitest/design-system 분리 |
| TD-403 | `pending` | admin basic 컴포넌트 스모크 테스트 과다 | `moabom-admin_basic/.../__tests__/` | composite 위주로 축소 |
| TD-404 | `pending` | AdminSidebar·DynamicFieldList 테스트 이중 경로 | admin `__tests__/` | 한 경로만 |
| TD-405 | `pending` | social-auth 문서 >> 코드 (229 vs 52줄) | `docs/ADMIN-HOST-SCOPE.md` | 체크리스트 수준으로 축소 |
| TD-406 | `pending` | DI `assertInstanceOf` only 테스트 | `MoabomServiceContainerBindingsTest` | 통합 스모크로 대체 검토 |

---

## 플러그인 (요약)

| 플러그인 | ID | 상태 | 메모 |
|----------|-----|------|------|
| moabom-weather | TD-501 | `pending` | Interface·DTO·이중 매핑 — 엔드포인트 2개 규모 대비 과함 |
| moabom-pwa | TD-502 | `pending` | Manifest locale 협상·VersionResolver glob·테스트 6파일 |
| moabom-reverb | TD-503 | `pending` | G7 core applier 병렬 유지 |
| moabom-auth-hardening | TD-504 | `pending` | Vite 스택 + preview host env 중복 |

---

## 의도적 유지 (건드리지 않음)

- `moabom-personalization` — Service/Repository 분리 적정
- `moabom-credit` — G7 settings 계약 보일러플레이트
- `scripts/check-extension-autoload.sh` — 단일 목적·적정 크기
- layout JSON Vitest, weather 캐시 TTL 분리 — 문서화된 의도

---

## 작업 규칙

1. **한 PR/세션 = TD-ID 1~3개** — 범위 넓히지 않기  
2. 해결 후 이 문서의 **상태·완료일·메모** 갱신  
3. PHP↔TS 알고리즘 병합 시 **parity 테스트** 필수  
4. 삭제 전 `Grep`으로 import·라우트·테스트 참조 확인  
5. G7 코어·sirsoft 경로 수정 금지 (`g7-core-readonly.mdc`)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-22 | 초판 작성 (전수 감사 결과 SSOT화) |
| 2026-06-22 | TD-101~103, TD-201 완료 (dead code·파일 병합·strip 동기화) |
