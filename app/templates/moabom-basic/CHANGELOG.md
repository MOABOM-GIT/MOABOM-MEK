# Changelog

## [Unreleased]

### Added

- **날씨 lazy host** — `Moa_WeatherEffectHost` + dynamic import(`Moa_WeatherEffectHostInner`). `weather`·`animation` OFF 시 Canvas·엔진 청크·런타임 훅 미마운트. 마이페이지 설정 진입 시 `requestIdleCallback` 으로 청크 선로딩.
- **앱 이야기** — 저장 AI 앱 뷰어 툴바에서 별도 셸 창으로 리뷰·별점 열람·작성 (`AppCommunityWindow`).

### Changed

- **실시간 REST 동기화** — 접속자·친구·알림·채팅 catch-up 요청을 key 단위로 합쳐 WS 재연결·포커스 복귀·폴링이 겹칠 때 중복 네트워크 요청을 줄였습니다.
- **날씨 마이페이지 상태** — 15초 상시 폴링 제거, 이벤트 + bounded 재시도(800ms/2.5s/6s)로 전환.

### Fixed

- **접속자 실시간 갱신** — presence revision invalidate 구독이 하나만 유지되어 프로필·우측 패널 중 마지막 구독만 동작할 수 있던 문제를 다중 구독으로 수정했습니다.
- **WebSocket 연결 감시** — Echo/Pusher 초기화 지연 시 200ms 무한 재시도하던 감시 루프를 bounded backoff와 auth 재동기화 복구 경로로 안정화했습니다.
- **생성앱 타이틀바** — 새로고침·딥링크 시 `App #n` placeholder 제목으로 그라데이션 해시가 달라지던 문제. `serverId` 단일 SSOT + 카탈로그 로드 후 윈도우 chrome 동기화.
- **접속자 활동(앱)** — 생성앱 이용 시 우측 접속 목록에 `App #n 이용 중` placeholder가 남던 문제. presence foreground·카탈로그·API 로드 후 실제 앱 이름으로 동기화.
- **앱 이야기** 툴바 버튼 — 포인트 컬러 그라데이션 배경·흰색 라벨(편집·등록·삭제 pill과 동일 구조).
- **셸 게시판·navigate** — `useMoaShellWindows`에서 `moaShellBoardAppId` import 누락으로 공지·프로필 작성글 클릭 시 `ReferenceError` / `Failed to execute action: navigate` 발생. `moaShellWindowIds` barrel SSOT로 정리, navigate 브릿지 예외 격리.
- **앱 이야기 셸** — URL-less 오버레이(부모 `generated-app-{id}` 경로), 태스크바 `canWrite`/제목 영속화, 앱 삭제 시 community 창 cascade, 미로그인 작성 시 로그인 유도.
- **앱 이야기 fetch** — 세션 캐시(30s)로 minimize 복원 시 중복 요청 완화.
- **앱 이야기 툴바** — 비로그인 시 제작자 라벨만 표시(화살표·메뉴 없음). 로그인 후 앱편집·앱 이야기, 소유자는 등록·삭제 추가.

### Changed

- **생성앱 툴바 액션 버튼** — `moa-btn-neutral` 제거, `.generated-app-action-button` CSS 변수 최소화(공통 색·테두리·그림자 + `is-*` 배경만).
- **홈 셸 부트**: `extensionDeferredRegistry` → G7Config `deferred*` 클라이언트 복원(`installMoabomExtensionDeferredBootstrap`), shell-boot 완료 후 `frontend-defaults` 중복 fetch 제거.
- **지연 확장 manifest**: sirsoft-ecommerce·daum_postcode·ckeditor5·tosspayments를 `loading.strategy: lazy`로 전환 — 홈 선로드 제거, `sirsoftEcommerceLayoutPrefetch`·Ghost registry와 정합.
- 확장 IIFE Vite 빌드에 React `external` 적용(코어 `template-engine` 전역 React SSOT).
- 로그인 직후 presence summary·online·friends·settings를 병렬 초기화.
- 프로필·작성글 반복 게시글 행(`_user_post_row.json`)에서 `glass-panel` 제거
- 프로필 윈도우 상단 탭 크롬: `background`·`px-3 pt-3 pb-2` 패딩 제거
- 프로필 보기: 프로필 카드·게시글/댓글 통계·최근 게시글 섹션 간격 `space-y-6` → `space-y-3`(0.75rem)
- 프로필·작성글 윈도우에서 페이지 헤더(아이콘·제목)·작성글 브레드크럼·총 개수 행 제거, 루트 `min-h-0`·portable `py-4` 래퍼 제거
- 프로필·작성글·대화하기·공지(게시판 basic) 카드/패널을 `glass-panel` 로 통일, `bg-white dark:bg-gray-800`·`shadow-sm`·`shadow` 제거
- 프로필 **최근 게시글**·**작성글 목록** 아이템을 공통 1행 partial(`_user_post_row.json`)·`moa-user-profile-post-row` 로 통일 (게시판 배지 · 제목 · 조회수 · 날짜 한 줄)
- **대화하기** 탭 레이아웃 재구성 — 좌측 대화 목록 · 우측 대화창(메시지 스크롤) · 하단 입력 고정, 창 높이 flex 체인·`@container` 좁은 폭 스택 대응 502/503 transient 재시도, 2차 API 지연 큐(`deferShellSecondaryWork`), 게시판 layout·lang idle 선로드
- **게시판 윈도우**: payload 페이지·auth 캐시 + 재조회 SWR 오버레이 (프로필 윈도우와 동일)
- **공지 미리보기**: 공지 탭 활성 시에만 fetch, 45s in-flight 공유 캐시, transient 재시도
- **Presence**: 로그인 직후 heartbeat·settings를 450ms 지연·summary 중복 호출 제거
- **접속자·친구 탭**: 첫 목록 fetch 200ms 지연으로 게시판 오픈과 API 폭주 분리
- 공개 프로필·작성글 셸 윈도우 SSOT를 G7 순정 `layouts/users/show` · `layouts/users/posts` 로 이전 (Pagination·전체보기·탈퇴 사용자·테이블 목록)
- `user.profile.*` i18n partial 추가 (ko/en/ja/zh)
- 프로필 페이징 URL `?page=` 동기화·페이지별 payload 캐시·재조회 시 `AppLoadingSpinner` 오버레이
- 공개 프로필 윈도우: `users/show`·`users/posts` layout JSON을 셸 윈도우용 `components` 배열로 정렬 (`LayoutLoader` 검증 통과)
- 프로필·작성글 윈도우 상단 슬라이딩 탭·병렬 payload 선로드·전역 캐시 (`userProfileWindowPrefetch` — 게시판 `boardWindowPrefetch` 와 동일 패턴)

### Fixed

- **앱 창 본문 높이**: `.moa-app-window-viewport` flex column·`.moa-app-window-body` `flex: 1` 로 창 높이 채움 체인 복구 — AI 앱 만들기·저장 AI 앱 뷰어 등 콘텐츠 영역이 창 대비 작게 보이던 문제.
- **웹사이트 연결 앱**: 이중 iframe(래퍼 HTML) 제거 — `GeneratedAppViewer`가 `metadata.website_url`을 직접 로드, 저장 HTML은 API min 길이용 플레이스홀더만 유지.
- **웹사이트 연결 iframe**: sandbox에 `allow-same-origin` 추가·셸 CSP `frame-src https:` — 외부 사이트 cookie·위젯 동작 (Moabom 셸 cross-origin 격리 유지).
- **공지·프로필·게시판 윈도우가 두 개씩 열리던 문제** — `pushShellPath` 직후 `applyShellRoute` 재진입 시 `windowsRef`가 `useEffect`보다 늦게 갱신되어 동일 `appId` 중복 생성. `commitShellWindows`로 state·ref 동시 반영 후 URL 동기화, 알림 네비게이션은 `pushShellPath` 단일 경로만 사용.
- 우측 접속자 패널 … 메뉴에서 작성글 보기가 프로필과 동일 URL로 열리던 문제 — `openUserProfileWindow` sync/view 인자 순서 수정
- 접속자 목록에서 회원 프로필 클릭 시 `Layout data field "components" must be an array` 오류 — `slots`-only 레이아웃을 셸 경로용 `components` 로 승격

### Changed

- 공개 프로필·작성글 윈도우 레이아웃 CSS(`38-user-profile-window.css`) 및 G7 layout JSON 로드 병렬화·선로드로 전환 체감 속도 개선
- 프로필↔작성글 뷰 전환 시 캐시된 렌더 payload 재사용

### Fixed

- 홈 메인 패널 앱 삭제 후 새로고침 시 소개·AI 생성 앱이 되살아나던 문제 — 빈 `mainAppOrder` 를 “기본 전체 그리드”와 “사용자가 비운 그리드”로 구분하는 `customized` SSOT 도입, `hospital-info` 강제 삽입 제거, 생성 앱은 order 에 고정된 id 만 표시.
- 메인 order 변경 경로 `commitMainAppOrder` 통합 — DnD·삭제·AI 저장 후 카탈로그 재조립 일관성, `createdAppsRef` 동기 갱신, pull 시 `customized=false` 이면 localStorage order 키 제거.

### Added

- 메인 패널 편집 모드에서 빈 곳 탭으로 종료 시 「메인 앱 배치를 저장했습니다」 성공 토스트.

### Changed

- 알림 클릭 URL·레거시 `/mypage` → `/me/*` 경로 정규화 유틸 SSOT를 이 템플릿 `src/utils/` 로 확정 (기존 `moabom-system` 모듈 re-export 제거).

### Added

- 홈 셸 메인 앱 순서 SSOT: `moaHomeShellOrder` + `moabomShellOrderSaveQueue` — `localStorage`(`moabom_main_order`)와 로그인 시 `user/settings` `shell.home.mainAppOrder` 양방향 동기화.
- AI 생성 앱(`generated-app-*`) DnD 후 새로고침·기기 간 복원 — order 정규화 시 미해석 id 제거 버그 수정, fetch 후 order 덮어쓰기 제거.

### Fixed

- 좌측 패널 → 메인 드롭 시 `left-panel` collision 때문에 저장이 무시되던 경우 — `over.id` 기준으로 판정.

## [0.6.78] - 2026-06-11

### Fixed

- **앱 윈도우 글래스 회귀** (`26-moa-window-glass.css`) — `react-glass-ui` 제거 마이그레이션에서 생긴 두 가지 회귀 수정:
  - 표면 `::before` 에 걸려 있던 `filter: url(#moa-window-glass-distort)` 가 feDisplacementMap(scale 35)으로 **표면 자체**(1px 테두리·inset glow·가장자리 픽셀)를 변위시켜 테두리 소실·좌우/하단 투명 띠가 생기던 문제 — 굴절을 전용 `::after`(z-index:-2) 레이어의 `backdrop-filter: var(--moa-window-distort-filter)` 로 분리해 **창 뒤 배경만** 굴절. 표면(배경·테두리·glow·blur/saturate/brightness)은 `::before`(z-index:-1) 에서 선명하게 유지. 미지원 브라우저는 굴절만 자연 탈락.
  - `.moa-window-frame > * { position: relative }` 가 리사이즈 핸들의 `absolute bottom-1 right-1` 을 덮어써 핸들이 좌측 flow 위치로 빠지던 문제 — 자식 position 강제 규칙 삭제. 쌓임 순서는 두 pseudo 를 음수 z-index 로 내려 `isolation: isolate` 컨텍스트 안에서 자식이 자연히 위에 그려지도록 변경.

## [0.6.77] - 2026-05-15

### Fixed

- **마이페이지 내 활동**: 관리자·슈퍼관리자 세션에서 활동 API가 `user` 전용 권한으로 403 나던 문제는 `moabom-activity` 모듈 라우트 정리로 해소. 내 활동 탭 상단에 **관리자 계정으로 로그인됨** 안내(`moa_mypage.activity.admin_session_notice`, ko/en/ja/zh) 추가.

## [0.6.76] - 2026-05-15

### Fixed

- **홈 화면 공백**: `0.6.75`에서 `HomePage`를 `moabom-shell-home.iife.js`로 분리했으나, 코어 `resources/views/app.blade.php`는 `components.iife.js`만 로드하여 추가 번들이 실행되지 않고 `ComponentRegistry`에 `HomePage`가 없어 레이아웃이 비었다. **홈 셸 분리를 되돌리고** `HomePage`를 다시 메인 IIFE에 포함(Moabom 무터치 규칙상 Blade 수정 없이 복구). `Moa_apps`의 `apps/index` 비의존·`MoabomUiI18nProvider`의 `moabom-shell-i18n` 별칭·`Moa_HomePage`의 `ai-generator/metadata` 직접 import는 유지.

## [0.6.75] - 2026-05-14

### Changed

- **홈 셸 IIFE 분리**: `dist/js/moabom-shell-home.iife.js` 추가 — `HomePage` 및 DnD·3패널·셸 라우트 트리를 메인 `components.iife.js`에서 분리, `template.json` `assets.js`에서 메인 직후 로드 후 `window.MoabomBasic.HomePage` 주입. `react-glass-ui` 등에서 추출되는 스타일은 `dist/css/moabom-shell-home.css`로 두고 `assets.css`에 포함. PWA Workbox precache에 JS·CSS 반영. (메인·셸 빌드가 각각 묶이므로 **공용 모듈은 양쪽에 중복될 수 있어 gzip 합계는 단일 파일 대비 커질 수 있음** — 대신 **첫 `components.iife.js` 파싱·실행 비용**이 크게 줄어듦.)
- **`Moa_apps`**: `cpap-mask` 메타만 `apps/cpap-mask/metadata`에서 직접 참조 — 메인 번들이 `apps/index`(동적 셸 로더)를 불필요하게 끌어오지 않도록.
- **`MoabomUiI18nProvider`**: `moabom-shell-i18n` 별칭으로 싱글톤 참조 — 홈 셸 번들이 `__MoabomShellI18n` external과 정합.

## [0.6.74] - 2026-05-14

### Changed

- **`components/composite/index.ts`**: `components.json`에 없는 셸 전용 컴포넌트(Window·패널·DnD·창 본문 등)를 배럴에서 제거 — 번들 초기 평가 경로 축소, `Moa_HomePage`의 `React.lazy` 창 본문과 배럴 정적 re-export 중복 제거. 사용하지 않는 `compositeComponents` 맵·`CompositeComponentName` 타입 제거(ComponentRegistry는 전역 named export만 사용).

## [0.6.73] - 2026-05-14

### Changed

- **`Moa_HomePage`**: 인증·마이페이지·법무 창 본문(`AuthWindowContent`, `MyPageWindowContent`, `LegalPageWindowContent`)을 `React.lazy` + `Suspense`로 지연 로드 — 메인 번들 그래프에서 해당 모듈을 분리(IIFE 단일 파일 정책상 **추가 HTTP 청크 파일은 생성되지 않음**, Rollup이 동적 import를 인라인). 초기 JS 전송·파싱 부담 완화 및 이후 별도 `vite` 엔트리로 물리 분리 시 확장 기반.

## [0.6.72] - 2026-05-14

### Changed

- `template.json`의 `g7_version`을 `>=7.0.0-beta.1,<8.0.0`로 조정 — 코어 베타6 등 이후 릴리스에 매니페스트 버전을 맞출 필요 없음(8.x 메이저는 제외)

## [0.6.71] - 2026-05-12

### Fixed

- **날씨 효과**: 마이페이지 시스템 옵션에서 끈 직후에도 `runOnce` 클로저·지연 페치가 이전 `effective` 로 이펙트를 유지·재가동하던 문제 수정 — `effectiveRef` + 이벤트 시 `computeEffectiveSystemOptions` 즉시 동기화, `await` 후 게이트 재검사.

## [0.6.70] - 2026-05-12

### Changed

- **ImageGallery**: IIFE는 Rollup 코드 분할 불가 → `image-gallery-lightbox.iife.js` 별도 빌드·갤러리 오픈 시 스크립트 주입(셸 번들과 동일). 라이트박스 CSS는 `imageGalleryLightboxStyles`로 메인 `components.css`에 유지.

### Added (tests)

- `moabomImageGalleryLightboxChunk.test.ts` — 지연 로더 동작 검증.

## [0.6.69] - 2026-05-12

### Fixed

- **이커머스 비활성**: `G7Config`에 `sirsoft-ecommerce` 메타가 없으면 Ghost `routes.json` 우회·Router 병합 선행·`__g7BeforeLayoutLoad`의 이커머스 모듈 선로드를 하지 않음(`isSirsoftEcommercePresentInG7Config`). Vitest 보강.

## [0.6.68] - 2026-05-12

### Fixed

- **C2 Ghost**: `pathNeedsEcommerceMergedRoutes`에서 **`/mypage` 강제 병합 제거** — 이커머스 모듈 비활성·비이커머스 마이페이지 배포에 맞지 않던 확장을 되돌림.

## [0.6.67] - 2026-05-12

### Changed

- ~~**C2 Ghost**: `pathNeedsEcommerceMergedRoutes`에 `/mypage` 직접 진입 포함~~ — **0.6.68에서 되돌림.**

## [0.6.66] - 2026-05-12

### Added

- **`sirsoft-tosspayments` lazy 선로딩**: `ensureSirsoftTosspaymentsPluginLoaded`·`layoutPathSuggestsTossPayments`(checkout·pending_payment 등). Vitest 보강.

## [0.6.65] - 2026-05-12

### Added

- **`sirsoft-ckeditor5` lazy 선로딩**: `sirsoftEcommerceLayoutPrefetch`에 `ensureSirsoftCkeditor5PluginLoaded`·`layoutPathSuggestsCKEditor`(게시/페이지 폼·상품 설명 등). Vitest 보강.

## [0.6.64] - 2026-05-12

### Added

- **C2 Ghost 라우트 브릿지**: `src/runtime/moabomGhostRoutesFetch.ts` — `installMoabomGhostRoutesFetch()`가 `routes.json` 첫 fetch를 `moabom-system` 셸 API로 우회하고, 이커머스 SPA 이동 전 `ensureMoabomFullTemplateRoutesMerged`로 전체 라인 병합. `Router.navigate` 패치·`__g7BeforeLayoutLoad`와 연동.
- **B-Lazy 발신**: `src/runtime/moabomLazyPrecache.ts` — `loadMoabomShellAppComponent`가 셸 청크 URL로 `MOABOM_LAZY_PRECACHE` `postMessage`.
- **Vitest**: `moabomGhostRoutesFetch.test.ts`, `moabomLazyPrecache.test.ts`.

### Changed

- **코어(engine-v1.45.0)**: `Router.mergeRoutes`, `TemplateApp.mergeTemplateRoutesFromData` — Ghost 병합용. `php artisan core:build` 반영.
- **`dist/`**: Ghost·Lazy Precache 소스 반영 후 `vite build` 재생성.

## [0.6.63] - 2026-05-12

### Added

- **`sirsoft-daum_postcode` lazy 선로딩**: `sirsoftEcommerceLayoutPrefetch`에서 `ensureSirsoftDaumPostcodePluginLoaded` 및 Ghost용 `extensionDeferredRegistry.plugins` 복원. 주소·쇼핑·마이페이지 등 레이아웃 경로에서만 `loadDeferredExtensionAssets` 호출(Vitest 보강).

### Changed

- **PWA `dist/pwa/sw.bundled.js`**: `moabom-pwa` SW에 `MOABOM_LAZY_PRECACHE` 처리 추가에 맞춰 Workbox 재빌드.

## [0.6.62] - 2026-05-12

### Changed

- **PWA 빌드 산출물**: `plugins/_bundled/moabom-pwa` SW 템플릿 변경(precache·런타임 캐시 이중 제외, 자산 캐시 LRU 상한)을 반영해 `dist/pwa/sw.bundled.js`·`precache-manifest.json` 재생성.

## [0.6.61] - 2026-05-12

### Fixed

- **Ghost + lazy 이커머스**: 홈 루트에서 `deferredModuleAssets`가 비어도 `appConfig.moabom.extensionDeferredRegistry`에서 복원한 뒤 `loadDeferredExtensionAssets`를 호출하도록 `sirsoftEcommerceLayoutPrefetch` 보강(Vitest 회귀).

## [0.6.60] - 2026-05-12

### Added

- **sirsoft-ecommerce lazy 선로딩**: `src/runtime/sirsoftEcommerceLayoutPrefetch.ts` — `window.__g7BeforeLayoutLoad` 등록. 코어 `TemplateApp`이 `shop/*`·`mypage/*` 레이아웃 fetch 전에 훅을 await하므로, 이커머스 모듈을 `lazy`로 두어도 쇼핑·마이페이지 진입 시 핸들러가 깨지지 않음.
- **`sirsoftEcommerceLayoutPrefetch.test.ts`**: 선로딩 유틸 Vitest.

## [0.6.59] - 2026-05-12

### Added

- **Ghost Mode UX(D2)**: `MoabomShellAppFromChunk` 로딩 중 스켈레톤(pulse)·`role="status"`·`aria-busy`·`moa_shell.window.app_loading_aria`(ko/en/ja/zh).
- **`loadDeferredExtensionAssets` 연동**: `src/apps/shellDeferredExtensions.ts`에 셸 앱 ID별 `moduleIdentifiers`/`pluginIdentifiers` 매핑을 두고, 분리 번들 로드 전에 `G7Core.dispatch`로 지연 확장(lazy·layout) JS/CSS를 선로딩할 수 있음(매핑 비어 있으면 생략).
- **`shellDeferredExtensions` 단위 테스트**: `src/apps/shellDeferredExtensions.test.ts`(Vitest).

## [0.6.58] - 2026-05-12

### Changed

- **셸 앱 지연 로드**: `create-app`(AI 앱 만들기)와 `cpap-mask`(마스크 피팅)를 `dist/js/moabom-shell-*.iife.js` 별도 번들로 빌드하고, 창을 열 때만 `<script>`로 로드해 `window.moabomShellApps`에 등록. 메인 `components.iife.js` 초기 로드에서 Mediapipe·AI 생성 UI 제거(메인 IIFE는 `React.lazy`로 청크 분리 불가).
- **i18n**: `moa_shell.window.app_loading` 키 추가(ko/en/ja/zh).

### Fixed

- 셸 지연 로드 번들에 `MoabomUiI18nProvider`가 중복 포함되며 `createContext`가 달라져 `useMoabomShellT`가 실패하던 문제: `moabomShellI18nSingleton.ts`로 Context를 단일화하고 `window.__MoabomShellI18n`으로 셸 IIFE에 주입, AI/마스크 앱은 `moabom-shell-i18n` import로 동일 Context 참조.

## [0.6.57] - 2026-05-12

### Changed

- **CSS 번들**: `safelist.txt`를 동적 조합(`@*:` `grid-cols-1..12` 등)만 남기고 대폭 축소, `@source`가 TS/TSX·`layouts/*.json`에서 유틸을 수집하도록 정리 → `dist/css/components.css` 약 **148 kB**(gzip **~25 kB**).
- **레거시 제거**: `main.css`의 `@layer components` (`.btn` / `.input` / `.card` / `.badge*`) 삭제 — 셸은 `moa-btn`·`moa-field`·`glass-sm` 사용. 레이아웃 JSON에 위 클래스가 남아 있으면 `Button` 또는 `moa-*`로 교체.
- **토큰**: `01-tokens.css` `:root`에 `--moa-bp-sm|md|lg`(Tailwind 기본 sm/md/lg와 동일 rem) 추가해 순수 CSS와 수치 단일화.

## [0.6.56] - 2026-05-12

### Changed

- **브레이크포인트 통일**: 셸·창 CSS를 Tailwind 기본 수치(`sm` 640px, `md` 768px, `lg` 1024px)에 맞춤 — CSS range 문법(`width < 640px`, `width >= 1024px`)으로 경계 회피값 없이 정리(`16-responsive-breakpoints.css`).
- **창 내부 반응형 TSX**: `Grid`·`PageSkeleton`·`FileUploader/FileList` 등에서 뷰포트 `sm:`/`lg:` → 컨테이너 `@sm:`/`@lg:` 등으로 통일; `PageSkeleton`은 `moa-app-window-viewport` + `ResizeObserver`로 폭 측정, 비-display 반응형 토큰 접두사 유지, `sanitizeClassName`이 `@sm:grid-cols-*`를 깨지 않도록 수정.
- **Tailwind v4 소스**: `main.css`에 `@source`로 `src/**/*.tsx`, `src/**/*.ts`, `layouts/**/*.json` 스캔 추가; `safelist.txt`에 컨테이너용 `@*:` 그리드·arbitrary 그리드 열 보강.
- **소정리**: `12-mypage-presets-layout.css`의 `.moa-mypage-sidebar` 중복 블록 병합.

## [0.6.55] - 2026-05-12

### Changed

- **Glass 창 기본 가로**: 일반 앱 창 초기 폭을 **1050px**로 조정(`DEFAULT_WINDOW_WIDTH`, `Moa_Window` 기본 `initialWidth`).

## [0.6.54] - 2026-05-12

### Changed

- **Glass 창 기본 가로**: 일반 앱 창 초기 폭을 **1366px**로 조정(`DEFAULT_WINDOW_WIDTH`, `Moa_Window` 기본 `initialWidth`). 세로 기본값(768px)은 유지.

## [0.6.53] - 2026-05-12

### Changed

- **Glass 창 반응형**: 창 본문에 `container-type: inline-size` 기준점(`.moa-app-window-viewport`)을 두고, 마이페이지·앱 창 전용 스타일은 `@media` 대신 `@container`로 전환. 셸 앱 TSX의 Tailwind 브레이크포인트는 `@sm:` / `@lg:` / `@xl:` 등 컨테이너 변형으로 통일해 **창만 줄여도** 브레이크포인트와 동일하게 레이아웃이 바뀌도록 정리(`Moa_Window.tsx`, `03-shell-root.css`, `12-mypage-presets-layout.css`, `16-responsive-breakpoints.css`, 마이페이지·인증·CpapMask·AiGenerator).

## [0.6.52] - 2026-05-11

### Fixed

- **Select** 커스텀 트리거: `glass-sm`+`moa-field` 표면만 전달할 때(`moaFieldControlClass` 등) `moa-reuse-select-row`가 빠져 라벨·화살표가 어긋나던 문제 — 표면 병합 시 행 토큰을 자동 보강 (`Select.tsx`).

## [0.6.51] - 2026-05-11

### Changed

- **Select** 커스텀 드롭다운 옵션 행: 본문 굵기를 **`font-normal`(400)**으로 통일 (`Select.tsx`).

## [0.6.50] - 2026-05-11

### Changed

- `.moa-field` 본문 굵기를 **`font-weight: 400`**으로 변경. `moa-reuse-core`의 `font-medium` 제거로 동일 요소에서 500이 덮어쓰이지 않도록 정리(`09-form-fields.css`, `24-moa-reuse-field-tokens.css`).

## [0.6.49] - 2026-05-11

### Changed

- **Select** 커스텀 드롭 메뉴 패널: 다크 모드 배경을 `rgb(27, 26, 29)`로 지정 (`Select.tsx`).

## [0.6.48] - 2026-05-11

### Changed

- 재사용 필드 굵기: `font-weight`에 **`!important` 제거**, 일반 `500`만 유지. `moa-reuse-core`에 **`font-medium` 복구**(`09-form-fields.css`, `24-moa-reuse-field-tokens.css`).

## [0.6.47] - 2026-05-11

### Changed

- 재사용 **인풋·텍스트아레아·셀렉트(네이티브/커스텀 트리거)** 본문 굵기를 **medium(500) 한 곳**에서만 고정: `.moa-field`에 `font-weight: 500 !important`, `moa-reuse-core`에서는 중복 `font-medium` 제거(`09-form-fields.css`, `24-moa-reuse-field-tokens.css`).
- `moaField*Class` 조합은 **G7Core.mergeClasses 없이** 문자열만 이어 붙이도록 단순화(`moabomFieldSurface.ts`).
- **Select** 커스텀 트리거: `mergeTailwindPreferLater` 제거, `glass-sm`+`moa-field` 사전 조합은 그대로 사용, 네이티브 `<select>`는 **Input과 동일한** `className` 분기(`Select.tsx`). 드롭 옵션 행은 `text-sm font-medium`으로 필드와 정렬.

## [0.6.46] - 2026-05-11

### Fixed

- **Select** 커스텀 트리거: `variant` 없는 `Button` 기본 `justify-center`·merge 폴백 때문에 라벨·화살표가 가운데로 뭉치던 문제 — 트리거만 **네이티브 `button`**으로 전환하고, 라벨에 `flex-1 min-w-0 text-left`·아이콘에 `shrink-0`로 좌·우 정렬 유지 (`Select.tsx`).

## [0.6.45] - 2026-05-11

### Changed

- 재사용 폼 표면을 **버튼(`moa-btn` + variant)과 같은 방식**으로 축약: 공통 타이포·disabled 등은 `moa-reuse-core`, 셀렉트 트리거 가로 정렬은 `moa-reuse-select-row` (`24-moa-reuse-field-tokens.css`), TS에서는 `MOA_REUSE_FIELD_LINE`(`glass-sm moa-field moa-reuse-core`) + `moa-field--{size}`(+textarea 시 `moa-field--textarea`)만 조합 (`moabomFieldSurface.ts`).
- **Input** 기본 `className` 처리를 **Textarea**와 동일 규칙으로 통일(비어 있으면 `moaFieldControlClass('medium')`).

## [0.6.44] - 2026-05-11

### Fixed

- **Select** 커스텀 트리거 `className`에 `moaFieldSelectTriggerClass`가 그대로 바인딩되거나, 본문에서 flex/정렬·disabled 유틸을 또 붙이면 `glass-sm` 등이 **이중**으로 쌓이던 문제: 기본 트리거와 동일 문자열은 병합 생략, 추가만 `mergeClasses`·`Button` 한 경로로만 적용 (`Select.tsx`).

## [0.6.43] - 2026-05-11

### Fixed

- 마이페이지 **환경설정 언어 변경** 직후에도 열린 **셸 앱 창 타이틀**이 이전 로케일로 남던 문제: `preferences.language`와 `lang/*.json` 오버레이 로드가 한 박자 어긋날 때 이전 오버레이를 `moa_apps.*`·`moabomT`가 그대로 읽지 않도록 **셸 UI 로케일 힌트**(`setShellUiTranslationLocale`)·**오버레이 동기 판별**(`isMoabomOverlaySyncedToLocale`)·로드 무효화(`overlayLoadGeneration`)를 도입 (`moabomTranslationOverlay.ts`, `resolveAppStrings.ts`, `moabomT.ts`, `useMoabomT.ts`, `MoabomUiI18nProvider.tsx`).

## [0.6.42] - 2026-05-11

### Changed

- **Textarea** 기본 `className` 처리: `Select` 네이티브와 같이 비어 있으면 `moaFieldTextareaClass('medium')`, `bg-*` 또는 이미 `glass-sm`+`moa-field` 조합이면 그대로, 그 외는 표면에 유틸 병합 (`Textarea.tsx`).
- 재사용 필드 배경 토큰 **`--moa-field-reuse-surface-bg`** 를 `01-tokens.css`에 두고 `input`/`select`/`button`/`textarea` + `glass-sm` + `.moa-field`에 동일 적용, `.dark` 별도 셀렉터 제거 (`09-form-fields.css`).

## [0.6.41] - 2026-05-11

### Changed

- 재사용 단일 라인 **인풋·셀렉트(네이티브/커스텀 트리거)** 표면: `glass-sm`의 **배경색만** `.moa-btn-primary-outline` 기본 배경(`rgb(255 255 255 / 70%)`, 다크 `rgb(0 0 0 / 40%)`)과 동일하게 정렬, 테두리·글래스 그림자·포커스 링은 기존 유지 (`09-form-fields.css`).

## [0.6.40] - 2026-05-11

### Fixed

- 마이페이지 셸 창 타이틀 바가 앱 메타의 **고정 인디고·바이올렛 그라데이션**을 쓰던 문제: 로그인·약관 등과 동일하게 **`MOA_SHELL_POINT_TITLE_GRADIENT`**(`--moa-point-color`)로 통일. 기존 창 재포커스·작업 표시줄 복원·저장된 작업 표시줄 항목 정규화에도 반영(`Moa_HomePage.tsx`).

## [0.6.39] - 2026-05-10

### Fixed

- 인증(로그인·회원가입·비번 창)·법률(약관·개인정보) 셸 창 타이틀 배경이 **고정 hex 그라데이션**이라 포인트 컬러와 무관했던 문제: `MOA_SHELL_POINT_TITLE_GRADIENT`로 **`var(--moa-point-color)` 기반** 통일, 재포커스 시에도 `gradient` 갱신(`Moa_HomePage.tsx`).

## [0.6.38] - 2026-05-10

### Changed

- `create-app` 타이틀 `__inner`: 라이트도 `@supports (color-mix(in lab, red, red))` 안에서 **8자리 알파 베이스**(`#0f172a00`, `#1e1b4b47`, `#0c0a1a07`)로 `color-mix` 적용, 다크와 동일 패턴으로 정리 (`23-create-app-window-title.css`).

## [0.6.37] - 2026-05-10

### Changed

- `create-app` 타이틀 테두리: gradient-border식 **`--moa-create-title-border-w`** + `calc` 오프셋, **60°**·`--moa-create-title-edge-grad`(spin-a/b `color-mix` 다점), **`background-size: 300% 300%`**·**`moa-window-create-title-move-gradient` 4s alternate**; `::before` **blur** 글로우·`::after` 선명층 (`23-create-app-window-title.css`).

## [0.6.36] - 2026-05-10

### Changed

- `create-app` 타이틀: `::before`/`::after` **height `calc(100% + 3px)`**, `background-size: 400%`, 스팀 키프레임 **400%** 복귀. 다크 `__inner`는 `@supports (color: color-mix(in lab, red, red))` 안에서 8자리 hex 알파 베이스(`#0b0a1200` 등)로 `color-mix` 갱신, 그 밖은 기존 6자리 폴백 유지 (`23-create-app-window-title.css`).

## [0.6.35] - 2026-05-10

### Changed

- `create-app` 타이틀 스팀 레이어: `top/left -1px`, `calc(100% + 2px)`, `background-size: 150%`, 키프레임 `150%`; `::after` **blur(15px)**·**opacity 0.7** (`23-create-app-window-title.css`).

## [0.6.34] - 2026-05-10

### Changed

- `create-app` 타이틀 테두리 스팀: 무지개 대신 **spin-a / spin-b**(`#8b5cf6`·`#ec4899`) 45° 번갈 그라데이션, `::after` **blur 5px**, 키프레임 이름 `moa-window-create-title-steam-accent` (`23-create-app-window-title.css`).

## [0.6.33] - 2026-05-10

### Changed

- `create-app` 타이틀 테두리: 참고 스팀 데모와 동일 **`::before`/`::after`** 45° 무지개 그라데이션、`background-size: 400%`, 키프레임 **0 → 400% → 0**, `::after` **`blur(10px)`**; 루트 2px 보라/핑크 clip 테두리 제거로 가시성 확보(`23-create-app-window-title.css`).

## [0.6.32] - 2026-05-10

### Fixed

- `create-app` 타이틀 `__inner`: **margin 제거**, `py-2.5` + `rounded-[14px]`만으로 2px 테두리와 정렬(conic 링 시절 남은 `m-[2px]` 정리).

## [0.6.31] - 2026-05-10

### Changed

- `create-app` 타이틀 바 스타일 정리: **테두리는 루트 2px 그라데이션 한 겹만** 유지하고 conic `::before`·breathe 키프레임 제거(그리드 아이콘과 중복 시각 두께 제거). `--moa-create-edge-*`로 색 한번만 참조, `::after`는 스팀+글로우만·`inset: -3px`·키프레임 단순화. `__inner` **m-[2px] rounded-[14px]** 로 2px 프레임과 정렬 (`23-create-app-window-title.css`, `Moa_Window.tsx`).

## [0.6.30] - 2026-05-10

### Changed

- `create-app` 타이틀: 외곽 그라데이션 **2px** 테두리, 스팀 애니메이션 **24s**, conic 링 **8.5s**·breathe **3.25s**, 글로우 **blur 18px·opacity 0.72**·레이어 **±4px** 확장 (`23-create-app-window-title.css`).

## [0.6.29] - 2026-05-10

### Changed

- `create-app` 타이틀 바: `::after`에 spin-a/b 반복 **linear-gradient** + `background-position` 스팀식 애니메이션, **blur 14px**·낮은 opacity로 바깥 글로우(`23-create-app-window-title.css`). 쌓임 순서 `::after` → `::before` → `__inner`. 글로우가 잘리지 않도록 `GlassCard` **content**만 `create-app`일 때 `overflow-visible` + `min-h-0`(`Moa_Window.tsx`).

## [0.6.28] - 2026-05-10

### Changed

- `create-app` 타이틀 `__inner`에서 inset 하이라이트/섀도 `box-shadow` 제거 (`23-create-app-window-title.css`).

## [0.6.27] - 2026-05-10

### Changed

- `create-app` 타이틀 바: 외곽 그라데이션 프레임 `border` **1px `#0000`**, `__inner` **py-2**, 제목 **text-base font-medium** (`23-create-app-window-title.css`, `Moa_Window.tsx`).

## [0.6.26] - 2026-05-10

### Changed

- `create-app` 타이틀 바 외곽 테두리: 흰/회색 단색 대신 **`linear-gradient(135deg, --create-app-spin-a, --create-app-spin-b)`** 이중 배경(`border` 2px transparent + `background-clip`)으로 앱 만들기 그라데이션 프레임(`23-create-app-window-title.css`).

## [0.6.25] - 2026-05-10

### Changed

- `create-app` 타이틀 회전 링: **그리드 AI 앱 만들기와 동일** `padding: 3px`·내부 `m-[3px]`/`rounded-[13px]` 복구. “선 길이”는 링 두께가 아니라 conic **호 범위**로 조절 — 그리드(약 42~58%)보다 타이틀은 **24~76%**로 긴 띠가 도는 느낌(`23-create-app-window-title.css`, `Moa_Window`).

## [0.6.24] - 2026-05-10

### Fixed

- `create-app` 타이틀 바: 세로 패딩·`min-height`로 커졌던 **타이틀 블록 높이**를 일반 창과 동일하게 복구(`py-3`, `min-height` 제거).
- 회전 링만 **굵게**: `::before` mask ring `padding` 3px → **5px**, conic 호 40~60%, 내부 `m-[5px]`·`rounded-[11px]`로 맞춤(`23-create-app-window-title.css`, `Moa_Window`).

## [0.6.23] - 2026-05-10

### Changed

- `create-app` 창 타이틀: 메인 그리드 아이콘과 **동일 conic 링**(3px·42%/58% 구간) + 외곽 2px 보더(라이트/다크 톤은 그리드와 동일 계열), 링만 짧은 **opacity 브리드**(`moa-window-create-title-ring-breathe`)로 고급스러운 모션. 타이틀 블록 **높이** `min-height: 3.5rem`·`py-4`, 링 inset `m-[3px]`로 회전 라인이 더 크게 보이도록 조정(`23-create-app-window-title.css`, `Moa_Window`).

## [0.6.22] - 2026-05-10

### Changed

- 메인 그리드 `.create-app-icon` 외곽 보더: 라이트는 밝은 흰색, **다크(`.dark`)** 는 `#525252c7`·내부 `::after` 테두리 톤 조정(`18-app-launcher.css`).
- 명칭 **「AI 앱 만들기」** 로 통일: `moa_shell.center`·`moa_apps.create-app`·`moa_apps_ai.title`·`createAppShellMetadata`·테스트 스텁 등.
- `create-app` 창 타이틀: 아이콘·제목은 일반 스타일(흰 글자), **테두리 한 겹 회전 라인**만 `::before` + 소프트 blur(`23-create-app-window-title.css`, `Moa_Window` 마크업 정리).

## [0.6.21] - 2026-05-10

### Changed

- **AI 앱 생성기**를 카탈로그·`APPS`·`MOABOM_SHELL_APP_METADATA`에서 제거하고, 셸 전용 id `create-app`으로 통합(`metadata.ts`, `apps/index.ts`, `Moa_apps` 합류 없음). 즐겨찾기·메인 순서·최근·태스크바에 남은 `ai-generator` id 는 로드 시 제거·`/app/ai-generator` 는 `create-app`으로 정규화(`Moa_HomePage`, `moabomShellRoutes`).
- `create-app` 창 타이틀 바: 회전 conic 보더·그라데이션 셰이머·아이콘 슬롯 전용 크롬(`Moa_Window`, `23-create-app-window-title.css`); 해당 창은 즐겨찾기 버튼 비표시.
- 다국어: `moa_apps.create-app` 추가·`moa_apps_ai.title` 문구를 도구 중심으로 조정(ko/en/ja/zh).

## [0.6.20] - 2026-05-10

### Changed

- 메인 그리드「앱 만들기」타일: 클릭 시 `ai-generator`와 동일하게 `onOpenApp(aiGeneratorAppMetadata)` 호출, 아이콘·내부 면·제목·회전 보더 색은 AI 앱 생성기 메타데이터(악센트 상수)와 동기화(`Moa_SortableAppGrid`, `metadata.ts`, `18-app-launcher.css`).

## [0.6.19] - 2026-05-10

### Changed

- 메인 패널 푸터 이용약관·개인정보: `cursor-pointer`, 라이트/다크 호버 배경·글자색, 컨테이너 `gap-2`(`Moa_CenterPanel`).

## [0.6.18] - 2026-05-10

### Reverted

- 창 타이틀 바 즐겨찾기·아이콘 정렬 시도(`flex-1`/truncate, 격자 래퍼, `23-window-title-chrome.css`) 롤백 — 타이틀 좌측 묶음·버튼 마크업을 정렬 작업 이전 형태로 복구(`Moa_Window`). 그라데이션 타이틀 배경(`gradient` prop)은 유지.

## [0.6.17] - 2026-05-10

### Fixed

- 창 타이틀 바: 즐겨찾기·창 제어 원형 버튼에 `grid size-full place-items-center` + `.moa-window-chrome-icon-slot`(FA 글리프 1em 정사각) 적용, 타이틀은 `flex-1 min-w-0 truncate`로 길이와 무관하게 레이아웃 안정화(`Moa_Window`, `23-window-title-chrome.css`).

## [0.6.16] - 2026-05-10

### Changed

- 태스크바 최소화 pill: `moa-btn-taskbar` 직계 `i`/`span` 보정 CSS 제거 → `.moa-taskbar-btn` 행 안에 동일 `1.35em` 높이의 아이콘·라벨 박스를 두는 방식으로 재구성(`19-panel-taskbar.css`, `Moa_CenterPanel`).

## [0.6.15] - 2026-05-10

### Fixed

- 태스크바 최소화 버튼: FA 아이콘 박스를 `inline-flex`·고정 `em` 정사각으로 잡고 라벨 `span`에 `line-height: 1`을 맞춰 아이콘·텍스트 수평(시각) 정렬(`10-buttons-variants.css`, `Moa_CenterPanel`).

## [0.6.14] - 2026-05-10

### Added

- 메인 패널 푸터「이용약관」「개인정보처리방침」→ `sirsoft-page` 공개 API(`/api/modules/sirsoft-page/pages/{terms|privacy}`)로 불러와 셸 `Window`에 표시(`Moa_LegalPageWindowContent`, `moabomSirsoftPageApi`).
- 템플릿 의존성: `sirsoft-page` 모듈.

## [0.6.13] - 2026-05-10

### Fixed

- 데스크톱 창 타이틀 바: 즐겨찾기·창 제어 원형 버튼에 `p-0`·`leading-none`·`shrink-0` 적용, 아이콘은 `block leading-none`으로 글리프 박스 정렬; `Button` 기본 `inline-flex`와 중복되던 `flex` 제거(`Moa_Window`).

## [0.6.12] - 2026-05-10

### Changed

- 데스크톱 창 타이틀 바 배경을 앱 아이콘·태스크바 최소화 버튼과 동일한 `gradient`로 표시(`Moa_Window` + `Moa_HomePage`).

## [0.6.11] - 2026-05-10

### Changed

- AI 앱 생성기·CPAP 마스크 피팅 **주 패널**: `glass-sm` → `moa-group` 기반 `APP_SHELL_PANEL_CLASS` (이유·규칙: `.cursor/rules/moabom-shell-panels.mdc`).

## [0.6.10] - 2026-05-10

### Removed

- `moa-home/23-surface-muted.css` 및 `.moa-surface-muted*` — 표면 계층을 `glass-sm`(글래스 토큰) + `moa-group`(순 음영)로 단순화.

### Changed

- CPAP·회원가입 약관 등 인라인 블록: `moa-surface-muted` → `glass-sm`; 스캔 진행 트랙은 `bg-slate-900/12 dark:bg-white/15`.
- 셀렉트 트리거: `glass-sm` 단일 표면(`moa-surface-muted-bg` 제거).
- 0.6.9에서 잠깐 넣었던 `moa-surface-muted` 계열은 동일 방향으로 철회·통합됨.

## [0.6.8] - 2026-05-10

### Changed

- `Moa_homepage.css`를 진입점만 남기고 `src/styles/moa-home/*.css`로 분할: 토큰(`01`)·테마 스코프(`02`)·셸 루트(`03`)·글래스(`04`)·마퀴(`05`)·장식 모션(`06`)·슬라이딩 토글(`07`)·버튼 베이스/변형(`08`/`10`)·폼 필드(`09`)·스위치(`11`)·마이페이지(`12`)·앱 그리드·오버레이(`13`)·상태 점(`14`)·푸터(`15`)·반응형(`16`)·편집 모드(`17`)·앱 런처(`18`)·패널/태스크바(`19`)·SNS(`20`)·스크롤바(`21`)·애니메이션 런타임(`22`).
- `.moa-center-grid` 중복 규칙 병합, `flat-*` 빈 선택자 블록 제거.

### Added

- `moa-home/00-deferred-unused.css`: 현재 TSX에서 미참조인 `@keyframes bgPulse`, `.moa-status-mobile` 보관(기본 `@import` 없음).

## [0.6.7] - 2026-05-10

### Added

- 폼 필드 단일 소스: `src/theme/moabomFieldSurface.ts` + `Moa_homepage.css`의 `.moa-field` / `.moa-field--{xl|large|medium|sm|xs}` — `glass-sm`, `text-sm`, `text-secondary` 기본, 포커스 시 안쪽 2px 포인트 링 + `var(--moa-point-fill-shadow)`, 단일 라인 높이·좌우 패딩·모서리·글자 크기는 `.moa-btn-*` 티어와 동일 값.
- `APP_SHELL_TEXTAREA_CLASS` — 멀티라인용 `moa-field--textarea` 조합.

### Changed

- 인증 창·마이페이지 프로필·계정·AI 앱·CPAP 앱·`Select` 기본 트리거가 위 토큰을 사용하도록 통일(인풋/셀렉트/텍스트영역).

## [0.6.6] - 2026-05-09

### Fixed

- `Moa_LoginPrompt`가 예전 패턴(카드 배경 `rgba(255,255,255,0.7)` 고정, 문구·타이포 하드코딩)으로 남아 다크 모드·i18n이 깨지던 문제 복구: `useMoabomDarkMode`로 카드 배경 전환, `useMoabomShellT`·`text-heading` / `text-secondary` / `text-muted` 복원, SNS 행 레이아웃 정리.

## [0.6.5] - 2026-05-09

### Changed

- 다크 모드 보강: 중앙 모드 선택기 트리거·드롭다운 행 호버·아이콘 박스, 앱 스토어 카드 호버, 로그인 프롬프트 구분선, 마이페이지 계정 안내 박스·설정 탭 토글(비활성 트랙)에 `dark:` 배경·호버 대응.
- `src/layout/moabomShellPanelLayout.ts` 복구: `MOABOM_SHELL_SUB_TAB_SLOT_PX`(70) 공유 상수.

## [0.6.4] - 2026-05-08

### Changed

- 인증 창(로그인 등) 헤드라인을 시맨틱 규칙에 맞춤: 모드 제목은 `text-primary`, 그 아래 안내 문구는 `text-secondary`(기존 `text-heading` / `text-muted` 조합 수정).

## [0.6.3] - 2026-05-08

### Changed

- 텍스트 시맨틱 재정의 및 화면 전반 적용: `.text-primary`(gray-700)=주요 제목·라벨, `.text-secondary`(gray-600)=부제·설명, `.text-heading`(800)=페이지·섹션 1차 제목, `.text-muted`(500)=3차 메타. 셸 좌·우 패널·앱 아이콘·마이페이지 탭·설정·CPAP/AI 앱 등 primary/secondary 혼선 구간 수정. 비활성 마이페이지 탭은 루트 색 대신 Marquee/설명에 primary·secondary 명시.

## [0.6.2] - 2026-05-08

### Changed

- `.text-secondary`를 gray-700로 유지(0.6.1에서 gray-600으로 낮춘 것 되돌림). 앱 스토어 카드·마이페이지 라이브러리 앱 이름 마키 등 아이콘 하위 라벨은 `text-secondary`로 통일해 700대 톤을 맞춤.

## [0.6.1] - 2026-05-08

### Changed

- 시맨틱 텍스트 톤 조정: `.text-primary`를 gray-700 수준으로 완화하고, 구 gray-900 제목급은 `.text-heading`(gray-800)과 `card-title` / `page-title` / `modal-title`에 반영. `.text-secondary`는 gray-600으로 한 단계 분리. `body`·`--foreground`·`--moa-text-primary`를 primary 톤과 맞춤. 인증창 메인 타이틀·앱 그리드·섹션·모달·모바일 내비 사이트명·RichText 헤더·상품명 등 제목 UI는 `text-heading` 사용.

## [0.6.0] - 2026-05-08

### Added

- 홈 셸 기본 앱으로 AI 앱 생성기와 양압기 마스크 피팅 앱 윈도우를 추가했다.
- `moabom-system` 앱 API를 호출하는 프론트 유틸과 생성 HTML 미리보기 안전 주입 유틸을 추가했다.
- AI 앱 생성기와 CPAP 마스크 피팅 앱의 4개 로케일(ko/en/ja/zh) 표시 문구를 추가했다.
- AI 앱 생성기를 Claude Sonnet 4, GPT-4o, Gemini 2.5 Flash 모델 선택과 기존 HTML 수정 요청 흐름으로 확장했다.
- 양압기 마스크 피팅 앱을 MediaPipe FaceLandmarker 기반 정면/측면 자동 스캔 흐름으로 고도화했다.

## [0.5.29] - 2026-05-08

### Changed

- `moa-btn-xxs-duo` 호버 시 보더를 `1px solid #ffffffb7` 로 통일.

## [0.5.28] - 2026-05-08

### Changed

- `moa-btn-xxs-duo`: `border: none` 및 투명 보더 토큰 제거 → `1px solid` 보더 색을 `var(--moa-btn-bg)`(호버 시 `var(--moa-btn-hover-bg)`…)와 동일하게 해 outline 변형에서도 테두리 두께·레이아웃만 유지.

## [0.5.27] - 2026-05-08

### Changed

- 마이페이지 **내 활동** 통계 3패널(글·댓글·상호작용)을 `activityOverview` 가 없을 때도 `0`으로 항상 표시. 좋아요 안내 문구는 API 응답이 온 뒤 `likes_supported === false` 일 때만 노출.

## [0.5.26] - 2026-05-08

### Changed

- `moa-btn-neutral`(출석체크 등) 글래스 토큰을 흰 라벨·반투명 배경·화이트 보더 값으로 조정.

## [0.5.25] - 2026-05-08

### Added

- `Button` `variant="neutral"` (`moa-btn-neutral`) — 그라데이션 카드용 밝은 필 CTA. 크레딧 출석체크는 `success` 대신 이 변형 + `size="large"` 및 `mt-5 w-full justify-center gap-2 shadow-md disabled:opacity-60` 조합으로 통일.

## [0.5.24] - 2026-05-08

### Changed

- 크레딧 탭 출석체크 CTA를 `Button` `variant="success"`·`size="large"` 로 정리하고(기존 흰색 커스텀 스타일 제거), `calendar-alt` / 로딩 시 `spinner` 아이콘을 표시한다.

## [0.5.23] - 2026-05-08

### Fixed

- 마이페이지 설정 저장 시 React 상태에 남아 있던 오래된 `layout` 이 localStorage/셸을 덮어, 홈에서 닫아 둔 좌·우 패널이 다시 열리던 문제 수정. 저장 경로에서 디스크 최신 `layout`을 사용하고 `MOABOM_SYSTEM_STATE_CHANGED` 로 마이페이지 `layout` 동기화.

## [0.5.22] - 2026-05-08

### Added

- `SlidingToggleSwitch`(`Moa_SlidingToggleSwitch`) — 패널 헤더용 슬라이딩 스위치를 `role="switch"`·i18n 레이블 props로 재사용 가능하게 정리. 기존 `Moa_Toggle` 제거.

### Changed

- 다크 모드에서 비활성 스위치 트랙이 보이도록 `Moa_homepage.css`에 `.moa-sliding-toggle--off` 대비 스타일 추가.
- 중앙 패널 좌·우 토글 접근 가능 이름을 `moa_shell.center.toggle_*` 다국어 키로 이전.

## [0.5.21] - 2026-05-08

### Fixed

- PWA 업데이트 토스트가 실제 언어 JSON 키(`moa_shell.pwa.update.*`)를 사용하도록 수정하고, 초기 로딩 중 번역 오버레이가 준비되기 전에도 키 문자열 대신 기본 안내 문구를 표시하도록 보완했다.

## [0.5.20] - 2026-05-08

### Removed

- 날씨 효과의 수동 지역/도시 입력 UI와 저장 흐름을 제거했다. 날씨 위치는 브라우저 위치 권한 허용 시 브라우저 좌표를 사용하고, 거부·실패 시 IP 기반 위치로 폴백한다.
- 홈 날씨 런타임에서 사용자 저장 위치(`profile.weather_location`) 우선순위를 제거하고 브라우저 위치 → IP 위치 2단계 결정으로 단순화했다.

## [0.5.19] - 2026-05-08

### Fixed

- 날씨 효과 위치 입력 UX를 명시적인 입력 후 저장 방식으로 수정했다. 검색 제안은 입력 보조로만 사용하고, 저장 버튼 또는 Enter 로 입력값을 지오코딩해 저장한다.

## [0.5.18] - 2026-05-08

### Changed

- 날씨 효과 위치 검색 안내에 검색 결과 선택 시 자동 저장됨을 명시하고, 저장/자동 위치 전환 결과를 토스트로 알려주도록 개선했다.
- 날씨 효과 토글 버튼의 마우스 포인터 스타일을 복구했다.

## [0.5.17] - 2026-05-08

### Changed

- 날씨 효과 위치 입력 폼의 유리 스타일과 안내 문구를 조정하고, 변경 아이콘 버튼을 소형 듀오 버튼 스타일로 정렬했다.
- 날씨 효과 토글 버튼의 고정 너비를 보강해 시스템 옵션 행에서 좌우로 눌려 보이지 않도록 개선했다.

## [0.5.16] - 2026-05-08

### Changed

- 날씨 위치 설정 UX를 계정 관리 탭에서 제거하고 환경 설정의 시스템 옵션 `날씨 효과` 행으로 통합했다.
- `날씨 효과 (자동 위치/저장 위치)` 형태로 현재 위치 기준을 표시하고, 변경 아이콘을 누르면 지역/도시 검색 폼을 인라인으로 열도록 개선했다.

## [0.5.15] - 2026-05-08

### Fixed

- PWA 업데이트 토스트가 `moa_basic.pwa.update.message` 번역 키를 그대로 표시하던 문제를 수정했다. 업데이트 알림 훅이 템플릿 오버레이 번역(`moabomT`)을 사용하도록 변경했다.

## [0.5.14] - 2026-05-08

### Changed

- 마이페이지 계정 탭의 날씨 효과 켜기 UI를 단순화했다. 설명 박스를 제거하고, 날씨 옵션이 꺼진 경우 도시명 입력 필드 우측에 "날씨 효과 켜기" 버튼만 표시한다.

## [0.5.13] - 2026-05-08

### Changed

- 마이페이지 계정 탭의 날씨 기준 위치 예시와 안내 문구를 로케일별 현지 도시 예시 중심으로 다듬고, "입력한 위치" 기준 설명으로 변경했다.
- 날씨 기준 위치 입력 영역에 `preferences.systemOptions.weather`를 바로 켤 수 있는 "날씨 효과 켜기" 버튼을 추가했다. 애니메이션 옵션이 꺼진 경우에는 설정 탭과 동일하게 비활성화 안내를 표시한다.

## [0.5.12] - 2026-05-08

### Fixed

- 마이페이지 계정 탭의 날씨 기준 위치 문구를 실제 용도에 맞게 노출하고, `lang/{ko,en,ja,zh}.json` 누락으로 번역 키가 그대로 보이던 문제를 수정했다.
- 홈 날씨 런타임이 사용자 설정의 `profile.weather_location`을 읽어 우선 사용하도록 연결하고, 마이페이지 저장 이벤트 발생 시 해당 위치를 다시 동기화한다.

## [0.5.11] - 2026-05-08

### Changed (BREAKING)

- **PWA 매니페스트/버전 엔드포인트 URL 을 `moabom-pwa` 플러그인 경로로 정렬**했다 (`moabom-system 0.5.0` 의 PWA 책임 분리에 맞춤).
  - `installManifestLink.ts` — manifest href 기본값을 `/api/modules/moabom-system/public/pwa/manifest.webmanifest` → `/api/plugins/moabom-pwa/manifest.webmanifest` 로 변경.
  - `pureRouter.ts` — `Sw_Bypass_Set` 안의 PWA version 경로를 `/api/modules/moabom-system/public/pwa/version` → `/api/plugins/moabom-pwa/version` 로 변경.
  - `vite.config.ts` — SW 템플릿 소스 경로(`sw.template.js`) 를 `modules/_bundled/moabom-system/resources/pwa/` → `plugins/_bundled/moabom-pwa/resources/pwa/` 로 변경.
- 운영 영향: `template:build moabom-basic` + `template:update moabom-basic --force` 와 `plugin:install moabom-pwa` (또는 `plugin:update moabom-pwa --force`) 를 함께 적용해야 한다. Service Worker 가 캐시한 구 manifest 는 다음 SW 활성화 사이클에서 자동 무효화된다(`PwaVersionResolver` 의 mtime 변경으로 새 버전이 산출됨).

## [0.5.10] - 2026-05-07

### Fixed

- PWA 아이콘 파일을 템플릿 빌드 결과(`dist/pwa/icons`)에 포함하고, manifest/head 링크가 실제 템플릿 asset API 경로(`/api/templates/assets/moabom-basic/pwa/icons/...`)를 가리키도록 정리했다.

## [0.5.9] - 2026-05-07

### Fixed

- 사용자 템플릿 head에 Apple touch icon과 16/32px favicon 링크를 PWA 아이콘 API 경로로 명시해 브라우저가 레거시 `/abc/icon/apple-touch-icon-180.png` 경로를 탐색하며 404를 남기는 문제를 줄였다.

## [0.5.8] - 2026-05-07

### Added

- 사용자 템플릿 런타임에서 PWA manifest 링크(`/api/modules/moabom-system/public/pwa/manifest.webmanifest`)를 head에 1회 주입하도록 연결했다. Service Worker 등록과 별도로 브라우저 설치성 판단에 필요한 `<link rel="manifest">` 연결을 활성화한다.

## [0.5.7] - 2026-05-07

### Fixed

- 게스트 셸과 마이페이지가 동시에 `public/frontend-defaults`를 요구할 때 같은 in-flight 요청을 공유하고, 성공 응답은 60초 메모리 TTL 안에서 재사용하도록 보강했다. Service Worker `CacheFirst`와 별도로 앱 내부 호출 시작점도 단일화해 네트워크 표 하단의 `frontend-defaults` 중복 호출을 줄인다.

## [0.5.6] - 2026-05-07

### Changed

- PWA 라우팅 순수 레이어에서 템플릿 메타 JSON(`lang`, `routes`, `components`)을 Service Worker 캐시 대상에서 제외했다. 해당 데이터는 코어 앱의 버전 기반 메모리 캐시와 in-flight 공유가 담당하도록 역할을 분리해 DevTools의 `script + sw.js` 이중 처리 표시와 불필요한 fetch 이벤트 개입을 줄인다.

## [0.5.5] - 2026-05-07

### Changed

- PWA 라우팅 순수 레이어에서 `/api/*` catch-all 대리 처리를 제거하고 동적 API는 `bypass`로 브라우저 기본 네트워크에 맡기도록 조정했다. `sw.js`가 NetworkOnly로 모든 API를 대리하면서 DevTools에 중복 행처럼 보이는 구조를 줄인다.
- 공개 레이아웃 JSON(`/api/layouts/{template}/{layout}.json`)을 버전 쿼리 기반 `cache-first` 대상으로 추가하고, 캐시 키에서 `v`를 제거하지 않도록 바꿔 버전별 Cache Storage 경계를 명확히 했다.

## [0.5.4] - 2026-05-07

### Changed

- PWA 라우팅 순수 레이어에서 `frontend-defaults`를 `network-first`에서 짧은 TTL `cache-first` 대상으로 조정해 게스트 초기 셸 로딩 시 공개 기본값 요청이 매번 네트워크 대기열을 선점하지 않도록 했다.

## [0.5.3] - 2026-05-07

### Fixed

- Moabom UI 번역 오버레이가 코어 `TranslationEngine`에 이미 로드된 lang JSON을 재사용하고, 동일 로케일 동시 호출은 하나의 in-flight 요청으로 공유하도록 변경해 마이페이지/셸 i18n 초기화 중복 fetch를 줄였다.
- PWA 라우팅 순수 레이어에서 `config.json`은 cache_version 기준점으로 남기고 `network-only`로 처리하도록 분리했다. `lang/*.json`, `routes.json`, `components.json`만 버전 쿼리 기반 `cache-first` 대상이다.

## [0.5.2] - 2026-05-07

### Changed

- PWA 라우팅 순수 레이어에서 버전 쿼리로 무효화되는 템플릿/플러그인 정적 에셋과 템플릿 메타 JSON을 `cache-first` 전략으로 분류해 Service Worker 백그라운드 재검증 중복 요청을 줄였다.

## [0.5.1] - 2026-05-07

### Changed

- 홈 셸과 마이페이지에서 `/api/modules/moabom-system/user/settings` 10초 주기 폴링 제거 — 초기 로드, 탭 visible 복귀, 창 focus, 저장 이벤트 기반 동기화만 유지해 불필요한 네트워크 요청을 줄였다.
- 날씨 스냅샷(`/weather/current`) 요청 중복 방지 — 같은 위치/언어 요청이 진행 중이면 새 요청을 만들지 않고, 최근 30분 내 동일 위치 캐시가 있으면 네트워크 재호출 없이 캐시를 엔진에 재적용한다.

## [0.5.0] - 2026-05-07

### Added

- **PWA Service Worker 레이어** (`moabom-pwa-service-worker` 스펙) — 사용자 셸에서 `/pwa/sw.js` 를 1회 등록하고, Workbox 기반 캐시 라우팅과 업데이트 UX 를 제공한다.
- **순수 함수와 property tests** — `pureRouter` · `pureVersion` 및 P1/P2/P3/P5 라우팅·쿼리·버전 검증을 추가했다.
- **업데이트 시스템 토스트** — 새 SW 가 waiting 상태가 되면 `severity: system` 토스트를 1회 표시하고, 사용자가 CTA 를 누를 때만 `messageSkipWaiting → controllerchange → reload` 를 수행한다.
- **PWA 아이콘/다국어/빌드 통합** — `public/pwa/icons` 자산, `moa_basic.pwa.update.*` 4개 로케일, Vite `workbox-build.injectManifest` 파이프라인을 추가했다.

## [0.4.2] - 2026-05-07

### Fixed

- **Theme ↔ Animation 커플링 원복** — 플랫(성능) 테마(`flat-light` / `flat-dark`) 로 전환해도 애니메이션/트랜지션이 더 이상 일괄 꺼지지 않는다. flat 테마 CSS 의 `transition: none !important` 와 `animation: none !important` 두 줄을 삭제했다.
  - `Moa_homepage.css` — `:root[data-moa-theme="flat-light"] .moa-home-root *` (및 `flat-dark`, `::before`, `::after`) 규칙에서 transition / animation 제거. 남는 속성은 시각 장식(box-shadow / text-shadow / filter / backdrop-filter) 만.
  - 테마는 **시각 장식(그림자·blur)** 만, 애니메이션 on/off 는 **시스템 옵션**(`html[data-moa-animations]`) 만 담당하도록 책임을 완전히 분리.
- 유지되는 동작:
  - 플랫 테마의 blur/그림자 제거(성능 절약)는 그대로 유지.
  - 시스템 옵션 "애니메이션" 끄기는 일반 라이트/다크/플랫 모든 테마에서 동일하게 동작.
  - Weather → animation 연동(사용자 확정)도 영향 없음.

## [0.4.1] - 2026-05-07

### Fixed

- **Blur ↔ Animation 커플링 원복** — 일반 라이트/다크 테마에서 애니메이션을 꺼도 Window 의 글래스 blur 가 그대로 유지된다. "애니메이션 off = 모든 흐림 제거" 로 잘못 묶여 있던 두 개의 `backdrop-filter: none !important` 규칙을 제거했다.
  - `Moa_homepage.css` — `html[data-moa-animations="off"] .moa-home-root .glass-panel` 와 `html[data-moa-animations="off"] .moa-home-root [data-glass-panel="true"]` 규칙 삭제. animation-duration · transition-duration · scroll-behavior · animation-iteration-count 만 끄도록 축소.
  - Blur 는 오직 플랫 테마(`flat-light`/`flat-dark`) 에만 연동되며, 일반 테마의 animation off 와는 무관하다.
- **MoabomGlassProvider / useMoabomGlassOverrides 제거** — `Moa_Window` 에서 `forceZeroBlur` override 분기를 제거하고 `isFlat` 단일 기준으로 복귀. `Moa_HomePage` 의 `<MoabomGlassProvider value={{ forceZeroBlur: ve.animation === false }}>` 래퍼도 제거. 더 이상 참조되지 않는 `src/runtime/MoabomGlassContext.tsx` 파일을 삭제.
- 유지되는 연동: **Weather 효과는 여전히 `animation === false` 시 off 된다** (effective 값 계산 6단계 · 사용자 확정 유지).

## [0.4.0] - 2026-05-07

### Added

- **홈 셸 날씨 효과 런타임** (`moabom-home-weather-effect` 스펙) — `Moa_HomePage` 의 `weatherCanvasRef` 위에 실제 기상 데이터 기반 시각 효과를 렌더한다.
  - 신규 모듈: `src/runtime/weather/` 하위에 타입·상수·순수 함수·엔진·이펙트·HTTP 클라이언트·캐시 유틸 17 개 파일 추가.
  - 순수 함수: `shouldRender` · `shouldRefetchOnVisible` · `resolveWeatherLocation` · `classifyWeatherEffects` · `isSnapshotCacheUsableAsStale` · `buildWeatherLocationKey`.
  - 환경 probe 확장: `src/runtime/env.ts` 에 `isMobileUserAgent` · `resolveParticleBudget` 추가(기존 `isHapticSupportedEnvironment` 유지).
  - 엔진: `WeatherEffectEngine` — 단일 RAF 루프, 파티클 풀 공유(rain/snow/dust), 연속 프레임 예산 초과 시 50% 자동 감소, DPR 1.5 clamp, ctx null no-op.
  - 이펙트 6종: `RainEffect` · `SnowEffect` · `DustEffect` · `FogLayer` · `SmogLayer` · `LightningOverlay` + `LightningScheduler`(분당 1–3회·간격 15s·창 80–120ms·불투명도 ≤0.4).
  - React 훅: `useWeatherEffectRuntime` — `effective.weather && effective.animation && visibility && intersecting` 합성, AbortController in-flight 취소, 30분 visible 재페치 게이트, 2h stale-while-error, `moabom-system-state-changed` 이벤트 구독.
  - HTTP 클라이언트: `fetchWeatherSnapshot`(조건부 ETag/If-Modified-Since) · `fetchWeatherGeolocate` · `fetchWeatherGeocode`.
  - 캐시/세션 유틸: `snapshotCache` · `locationCache`(24h TTL) · `sessionGeoDenied`.
  - 도시 검색 UI: `Moa_CitySearchAutocomplete` — 300ms 디바운스, 상위 5개, 키보드 내비게이션, 비우기 버튼.
  - 마이페이지 "계정 관리 > 기본 계정정보" 화면에 "기본 위치" 섹션 추가(`Moa_MyPageAccountPanel`).
  - `api/moabomSystemApi.ts` 에 `fetchMoabomProfileWeatherLocation` · `saveMoabomProfileWeatherLocation` 추가.
- **Property-based 테스트 8종 추가** — P1 P-Gate · P2 P-Location-Priority · P4 P-Effect-Classification · P5 P-LightningCadence · P6 P-StaleWhileError · P7 P-ParticleBudget · P8 P-RefetchGate · 엔진 유닛/DPR clamp.
- **다국어 키** — `moa_mypage.account.default_location*` 4 종을 ko/en/ja/zh 오버레이 JSON 에 추가(`resources/lang/{locale}.json`).
- **vitest include 확장** — `src/runtime/**` · `src/pages/**` 글로브 추가.

### Changed

- `Moa_HomePage` — 기존 `weatherCanvasRef` DOM 배치와 resize 로직은 유지한 채, `useEffectiveSystemOptions` 직후에 `useWeatherEffectRuntime` 훅 한 줄을 설치한다.
- `Moa_MyPageAccountPanel` / `Moa_MyPageWindowContent` — `weatherLocation` state + 낙관적 저장/롤백 + 성공 시 `moabom-system-state-changed` 이벤트 발행으로 홈 셸 훅이 즉시 재결정한다.

## [0.3.1] - 2026-05-06

### Fixed

- 비로그인/미저장 세션에서 `MoabomSystemState.preferences.systemOptions` 가 `visibilitychange` · `focus` · 10s polling 후 관리자 `on_by_default` 값으로 되돌아가던 현상 수정 (`moabomSystemServerMerge` — Req 1.4 / 1.4a).
  - `mergeMoabomSystemStateFromSettingsApi` 의 `mergeWithoutPersistedAppearance` 분기에서 `preferences.systemOptions` 를 `defaultState` 의 값으로 덮지 않고 `localState.preferences.systemOptions` 를 그대로 유지하도록 변경.
  - 관리자 잠금(`user_editable === false`) 은 런타임 `computeEffectiveSystemOptions` 단계에서 여전히 강제되므로 보안 계약은 훼손되지 않는다. 관리자 `on_by_default` 변경은 해당 id 의 로컬 raw 값이 부재할 때만 baseline 으로 반영된다.

## [0.3.0] - 2026-05-06

### Added

- **시스템 옵션 런타임 적용 레이어** 도입 (`moabom-system-options-runtime-apply` 스펙) — 관리자가 저장한 `preferences.system_options` 값(`sound`/`animation`/`haptic`/`toast`/`weather`) 을 `moabom-basic` 셸 런타임 전반에 반영하는 단일 진입점 아키텍처:
  - `src/runtime/effectiveSystemOptions.ts` — 관리자 기본값 · 사용자 오버라이드 · `prefers-reduced-motion` 을 합쳐 해석된 boolean 을 반환하는 순수 함수(`computeEffectiveSystemOptions`).
  - `src/runtime/useEffectiveSystemOptions.ts` — `MOABOM_SYSTEM_STATE_CHANGED_EVENT`, 다른 탭 `storage` 이벤트, `matchMedia('(prefers-reduced-motion: reduce)')` `change` 를 구독해 재계산하는 React 훅.
  - `src/runtime/MoabomRuntime.ts` — React 밖(이벤트 핸들러 · 유틸)에서도 해석값을 동기 조회하는 전역 레지스트리.
  - `src/runtime/events.ts` — `moabom-runtime-options-changed` 이벤트 상수(OS 신호 변화 시에도 Toast 리렌더 보장).
- **animation 효과 적용기** — `src/runtime/applyAnimationRuntime.ts` 가 `<html data-moa-animations>` 를 기록하고, `Moa_homepage.css` 에 `.moa-home-root` 스코프의 전역 CSS 규칙(`animation-duration`/`transition-duration`/`backdrop-filter`)을 추가.
- **`MoabomGlassProvider` · `useMoabomGlassOverrides` Context** (`src/runtime/MoabomGlassContext.tsx`) — animation off 상태에서 `react-glass-ui` 기반 `Moa_Window` 의 `blur`/`distortion`/`innerLightBlur`/`outerLightBlur`/`innerLightOpacity`/`outerLightOpacity` prop 을 0 으로 강제.
- **단일 진입점 유틸** — `src/runtime/sound.ts`(`playMoabomSound`, `stopAllMoabomSounds` · Req 3.1~3.4), `src/runtime/haptic.ts`(`vibrateMoabomHaptic` · Req 4.1~4.4).
- **Toast severity 체계** — `ToastItem.severity: 'system' | 'content'` 필드(optional, 미지정 시 `'content'` 로 취급 · Req 5.4 회귀 방지 계약). `toast` 옵션 off 상태에서도 `severity === 'system'` 토스트는 항상 렌더된다(저장 성공/검증 오류/권한 등 시스템 피드백 · Req 5.5).
- **iOS 환경 감지 유틸** — `src/runtime/env.ts` 의 `isHapticSupportedEnvironment()` — `navigator.vibrate` 미지원 또는 iOS/iPadOS UA 에서 `false` 반환.
- **iOS 환경에서 마이페이지 햅틱 토글 숨김** — `Moa_MyPageSettingsTab` 이 `isHapticSupportedEnvironment() === false` 일 때 `haptic` 옵션을 렌더 목록에서 제외. 저장값은 변경되지 않음(Req 12.1, 12.2).
- **날씨 위젯 picket 컴포넌트** — `src/components/composite/Moa_WeatherWidget.tsx` (Req 6 의 토글 훅 계약만 보장하는 최소 구현, 실제 Geolocation/외부 API 페치는 별도 스펙).
- **fast-check devDependency** (`3.23.2`) 도입 — property-based 테스트로 Effective 값 우선순위(P1~P3, P6) · 런타임 수렴(P14) · Toast severity 게이트(P10) · iOS 햅틱 숨김(P15) 등 14+ 속성 검증.

### Changed

- `Moa_Window` — 기존 `isFlat` 분기에 `forceZeroBlur` Context 값을 병합한 `shouldFlatten` 으로 glass prop 을 일괄 제어. `backgroundOpacity` 는 shouldFlatten 시 `0.97` 로 상향해 blur 부재 시 가독성 보존.
- `Toast` — "전체 null 반환" early-return 을 **severity 기반 필터 가드**로 대체. `toast` off 상태에서도 system 토스트는 렌더되고 content(또는 미지정) 만 차단된다. `MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT` 를 구독해 effective 값 변경 시 즉시 리렌더.
- `Moa_HomePage` — 최상단에서 `useEffectiveSystemOptions` 를 호출하고 `MoabomGlassProvider` 로 `.moa-home-root` 전체(Window/Toast 포함)를 감싼다. 서버 pull 시 `systemDefaults` 도 함께 저장해 훅에 전달.
- `Moa_MyPageSettingsTab` — `isHapticSupportedEnvironment()` 를 마운트 시점 `useMemo` 로 평가하여 `visibleSystemOptions` 를 필터링. 다른 옵션은 영향 없음.

## [0.2.71] - 2026-05-06

### Changed

- 우측 패널 로그인 프롬프트의 **구글 버튼 스타일을 로그인 창(`Moa_AuthWindowContent`) 의 구글 버튼과 완전히 동일**하게 맞춤 (`Moa_LoginPrompt.tsx`, `Moa_homepage.css`):
  - 다크 모드 전용 CSS 오버라이드(`.dark .social-login-btn.social-google`) 제거 — 구글은 라이트/다크 모두 **흰 배경 + 검은 글자** 브랜드 규격 유지.
  - 컴포넌트 쪽 `isDark` 분기 제거(구글 버튼 한정) — CSS `:hover { background: #fff !important }` 가 의도대로 항상 동작.
- 결과: 다크 모드에서 구글 버튼 hover 시 배경이 흰색 + 글자가 검정으로 유지되어 로그인 창과 우측 패널 동작이 일치한다. (이전 버전에서 우측 패널만 hover 시 흰 배경 + 흰 글자로 묻히던 버그 해소)

## [0.2.70] - 2026-05-06

### Fixed

- 다크 모드에서 **구글 SNS 버튼 hover 시 흰 배경 + 흰 글자로 묻히던 문제** — `.social-login-btn.social-google:hover { background: #fff !important }` 규칙이 다크 모드에서도 그대로 적용되어 텍스트가 사라지는 현상이었다. `.dark .social-login-btn.social-google` / `.dark .social-login-btn.social-google:hover` 를 CSS 에서 명시적으로 다크 네이비 계열로 덮어쓰도록 수정 (`Moa_homepage.css`).
- 위 수정으로 로그인 창(`Moa_AuthWindowContent`) 의 구글 버튼도 자동으로 다크 대응(CSS `!important` 로 텍스트 색까지 덮음). 우측 로그인 프롬프트(`Moa_LoginPrompt`) 의 인라인 `isDark` 분기 제거 — CSS 가 전담하여 라이트/다크 전환이 단일 소스로 관리된다.

## [0.2.69] - 2026-05-06

### Fixed

- 비로그인 상태의 우측 패널 **로그인 프롬프트 카드가 다크 모드에서 흰색으로 남아있던 문제** (`Moa_LoginPrompt.tsx`):
  - 카드 배경을 인라인 `rgba(255,255,255,0.7)` 하드코딩 → `useMoabomDarkMode` 기반으로 다크일 때 `rgba(15,23,42,0.7)` (slate-900 반투명) 로 자동 전환.
  - 구글 SNS 버튼도 동일하게 다크에서는 `rgba(30,41,59,0.85)` 배경 + 흰색 텍스트로 전환(네이버/카카오는 브랜드 컬러 유지).

## [0.2.68] - 2026-05-06

### Changed

- 다크 모드 `.glass-panel` 배경 토큰 `--moa-glass-panel-surface` 를 `rgba(0,0,0,0.35)` (#00000059) → `rgba(0,0,0,0.44)` (#00000070) 로 상향 — 좌/중/우 유리 패널이 다크에서 조금 더 진하게 비쳐 텍스트 가독성 개선 (`Moa_homepage.css`).

## [0.2.67] - 2026-05-06

### Changed

- **`Moa_Window` GlassCard 수치 조정** (`Moa_Window.tsx`):
  - 성능 테마(flat-light / flat-dark): 창 배경 불투명도 `0.95/0.9` → **`0.97`** 로 상향, blur 가 없는 불투명 패널이라 가독성·일관성 우선.
  - 다크(일반) 테마: 창 배경 불투명도 `0.55` → **`0.7`** 로 상향 — 창 뒤가 덜 비쳐 텍스트 가독성 개선.
  - 다크 계열(dark / flat-dark): `saturation={100}` 명시 — 기본 채도(>100) 에서 다크 배경의 색 과장 완화. 라이트에서는 기본값 유지.

## [0.2.66] - 2026-05-06

### Added

- **홈 배경 모드 필터 & 포인트 컬러 → 배경 자동 선택** — 관리자가 각 배경에 지정한 `mode`·`point_color` 메타를 사용자 마이페이지가 활용.
  - `moBackgroundAssets`:
    - `deriveMoabomBackgroundImageChoicesByMode(appearance, mode)` — 현재 테마 모드(라이트/다크)에 태그된 배경만 반환. 0 개면 전체 목록으로 fallback.
    - `findMoabomBackgroundIdByPointColor(appearance, hex, preferredMode?)` — hex 에 바인딩된 배경 UUID 조회. 현재 모드 매칭 우선, 없으면 다른 모드 폴백.
    - `moabomThemeToBackgroundMode(theme)` — `flat-*` 을 동일 명암 축으로 축약하여 배경 필터에 사용.
  - `Moa_MyPageSettingsTab`: 포인트 컬러 클릭 시 매핑된 배경도 같이 업데이트(`applyPointColor`). 바인딩이 없으면 기존처럼 포인트만 변경.
  - `Moa_MyPageWindowContent`: `backgroundImageIds` 를 현재 테마 모드로 필터해 주입하고, `pointColorToBackgroundId` 맵을 계산해 전달. 테마 전환 시 현재 배경이 새 모드에 없으면 첫 배경으로 자동 교체.
- `MoabomSystemDefaults.appearance.home_background_items[]` 타입에 `mode`·`point_color` 필드 추가.

### Testing

- `moBackgroundAssets.test.ts`: mode 필터 · hex→id 조회 · preferredMode 우선 · 대소문자 무관 · fallback 동작 등 10 개 케이스 추가.

## [0.2.65] - 2026-05-06

### Changed
- 좌측 패널 SMARTCARE 로고 — 다크 모드에서 `dark:invert` 대신 전용 흰색 로고(`logo_smartcare_w.svg`)로 교체, 라이트 모드는 기존 `logo_smartcare.svg` 유지 (`Moa_LeftPanel.tsx`).
- **성능 테마(flat-light / flat-dark)에서도 포인트 컬러를 사용자 팔레트 선택대로 적용** — 이전에는 `flat-light` = `#03c75a`(네이버), `flat-dark` = `#5865f2`(디스코드) 로 고정되어 사용자가 마이페이지에서 포인트 컬러를 바꿔도 성능 테마에서는 반영되지 않았다. 이제 네 테마(라이트·다크·성능 라이트·성능 다크) 모두 동일하게 `--moa-point-color` 를 사용자 선택값으로 적용한다. 성능 테마의 "효과 축소"(그림자·blur off, GPU 절약) 역할은 그대로 유지된다. (`moabomSystemStore.ts` — `THEME_BRAND_HEX` 제거, `resolveMoabomBrandColor` 단순화)
- `isBrandEnforcedTheme()` 는 이전 호출자 호환을 위해 남겨 두되 항상 `false` 를 반환한다(deprecated).

### Fixed
- **마이페이지 환경설정에서 테마를 빠르게 연속 전환 시 반영이 먹히거나 뒤늦게 돌아오던 동기화 문제 해결** — 두 가지 레이스가 섞여 있었다.
  - **네트워크 응답 순서 역전**: 테마 A→B→C 로 빠르게 바꾸면 세 번의 PUT `/api/modules/moabom-system/user/settings` 가 순서를 보장하지 않아 서버에 이전 선택이 최종 저장될 수 있었다.
  - **저장 중 pull 덮어쓰기**: 저장 요청이 in-flight 인 동안 `visibilitychange`/`focus`/10초 interval 의 `pullMoabomServerState` 가 **서버의 아직 반영되지 않은 구버전 settings** 를 로컬 appearance 에 그대로 덮어써 직전 선택이 UI 에서 짧게 롤백됐다가 다음 pull 주기에 다시 돌아오는 현상이 발생.
  - 해결:
    1. 저장 큐(`moabomSettingsSaveQueue.ts`) 도입 — PUT 을 직렬화하고 중간 상태는 drop, **항상 마지막 확정 상태만** 서버에 전송한다.
    2. `pullMoabomServerState` 가 저장 쿨다운 구간(기본 600ms + in-flight) 동안 서버 `settings` 를 무시하고 **로컬을 사용자 의사로 신뢰**한다. 같은 구간에서도 `defaults`(테마/팔레트/배경 목록 등 관리자 설정)는 정상 반영된다.
    3. `Moa_MyPageWindowContent` 의 `handleSystemStateChange` 가 직접 PUT 하지 않고 큐를 통해 저장한다.

### Added
- `src/utils/moabomSettingsSaveQueue.ts` — `queueSaveMoabomSystemSettings` / `isRecentlySavedSettings` / `isSavingSettings` / `getLastSaveRequestAt` / `getLastSaveResolveAt`.
- 테스트: `moabomSettingsSaveQueue.test.ts` (직렬화·중간 상태 drop·쿨다운·실패 복구), `moabomSystemStore.brandColor.test.ts` (네 테마 모두 사용자 포인트 컬러 적용), `moabomPullServerState.test.ts` (저장 중/직후 설정 보호).

## [0.2.64] - 2026-05-06

### Fixed
- **마이페이지에서 일정 시간(약 10초)마다 활성 탭이 "환경 설정"(initialTab 의 fallback) 으로 자동 리셋되던 문제 수정** (`Moa_MyPageWindowContent.tsx`).
  - 근본 원인: `pullMyPageServerState` 가 10초마다 실행돼 `setSystemDefaults(newObj)` 를 호출할 때, `tabStructureForRouting` `useMemo` 가 **같은 내용이지만 새 배열 참조**를 만들어냄. 이에 따라 `useLayoutEffect` 가 재실행되며 `reconcileMyPageTabFromShell(initialTab, ...)` 으로 탭을 `initialTab`(보통 `profile` / 게스트면 `settings`) 로 강제 덮어쓰고 있었다.
  - 수정: reconcile 키(`initialTab::isLoggedIn`)를 ref 로 보관해 **실제로 변한 경우** 또는 **현재 탭이 새 메뉴 구조에서 사라진 경우** 에만 재조정. 서버 메뉴가 참조만 갱신돼도 사용자가 선택한 탭은 유지됨.

## [0.2.63] - 2026-05-06

### Fixed
- 다크 모드에서 **"밝은 배경에 흰 텍스트로 묻히던" 두 위치** 수정:
  - 마이페이지 크레딧 탭 그라데이션 카드 내부의 "출석체크" 버튼 텍스트를 `text-primary`(다크에서 흰색) 에서 `text-slate-900` 고정으로 교체 — 버튼 배경이 항상 `bg-white/95` 이므로 텍스트도 항상 어두워야 가독성 유지 (`Moa_MyPageCreditPanel.tsx`)
  - 마이페이지 활동 탭의 아이템 버튼 배경 `bg-white/45` / `bg-white/70` 에 다크 쌍(`dark:bg-white/5`, `dark:bg-white/10`) 추가 — 다크에서 카드가 반투명 어두운 톤으로 전환 (`Moa_MyPageActivityPanel.tsx`)
- 좌측 패널 하단 4탭 네비 인디케이터 `bg-white` 에 `dark:bg-white/15` 추가 — 다크 모드에서 네온처럼 튀지 않고 자연스러운 유리 톤 (`Moa_LeftPanel.tsx`)
- 좌측 패널 로고(`logo_smartcare.svg`) 가 다크 모드에서 거의 보이지 않던 문제 — `dark:invert dark:brightness-150` 필터로 다크 배경에서도 식별되도록 처리 (`Moa_LeftPanel.tsx`)

## [0.2.62] - 2026-05-06

### Added
- **`useMoabomTheme()` / `isMoabomFlatTheme(theme)` 훅** (`src/hooks/useMoabomTheme.ts`). `html[data-moa-theme]` 속성값(`light`/`dark`/`flat-light`/`flat-dark`)을 `MutationObserver` 로 실시간 감지. 서드파티 컴포넌트(react-glass-ui 등)에서 테마별 props 분기용. `useMoabomDarkMode()` 는 단순 다크 여부 전용이고, 이 훅은 네 가지 테마 구분이 필요할 때 사용한다.
- **`.glass-*` 글래스 효과 토큰화** — `Moa_homepage.css` 의 `.glass`, `.glass-sm`, `.glass-sm-blur`, `.glass-panel` 의 light/dark 색상을 `:root` / `.dark` 스코프의 CSS 변수(`--moa-glass-*`, `--moa-glass-sm-*`, `--moa-glass-smblur-*`, `--moa-glass-panel-*`) 로 승격. 앞으로 다크 톤 조정은 변수만 고치면 전 `.glass-*` 에 자동 반영됨.
- **심플(flat) 테마 속도 우선 규칙** — `[data-moa-theme="flat-light"] .moa-home-root *` / `[data-moa-theme="flat-dark"] .moa-home-root *` 범위에서 `box-shadow / text-shadow / filter / backdrop-filter / transition / animation` 을 일괄 `none !important` 처리. `.glass-*` 변수도 flat 테마에서 `transparent` 로 덮어 그림자/inset 하이라이트 완전 제거.
- `Moa_Window` 의 `react-glass-ui GlassCard` props 에 flat 테마 분기 추가 — `blur/distortion/innerLight/outerLight/border` 를 모두 0 으로 넘겨 GPU 비용 높은 backdrop-blur 를 건너뛰고 불투명 패널로 렌더. (`backgroundOpacity` 만 `isDark ? 0.9 : 0.95` 로 올려 가독성 확보)

### Changed
- `moabom-basic` 전체 composite 에서 `text-gray-X dark:text-gray-Y` / `text-slate-X dark:text-slate-Y` 쌍 유틸리티를 시맨틱 토큰(`text-primary` / `text-secondary` / `text-muted` / `text-faint`) 으로 일괄 치환. 테스트 파일(`__tests__/`) 은 스냅샷 호환을 위해 보존. `Moa_AuthWindowContent` 의 에러 메시지/에러 보더를 `text-error` / `dark:border-red-800` / `dark:bg-red-900/20` 쌍으로 정리.

## [0.2.61] - 2026-05-06

### Added
- **시맨틱 UI 토큰 시스템 도입** (`src/styles/ui-system/*.css`). 그누보드7 표준(`sirsoft-admin_basic/src/styles/ui-system/`)과 동일한 구조. 컴포넌트는 이제 `text-gray-900 dark:text-white` 같은 쌍 유틸리티 대신 시맨틱 클래스만 사용한다:
  - **텍스트**: `.text-primary`(제목), `.text-secondary`(본문), `.text-muted`(보조), `.text-faint`(비활성/캡션), `.text-label`, `.text-hint`
  - **시맨틱 컬러**: `.text-success`/`.text-error`/`.text-warning`/`.text-info` 및 대응하는 `.bg-*-soft`, `.border-*`
  - **타이포그래피**: `.card-title`, `.card-description`, `.page-title`, `.page-description`, `.modal-title`, `.form-label`, `.form-hint`
  - **서페이스**: `.surface-card`, `.surface-subtle`, `.surface-hover`, `.divider-soft`, `.input-border`
  - **뱃지**: `.badge-green/blue/red/yellow/gray`
- light/dark 색상 매핑은 CSS 한 곳에서만 정의되므로 컴포넌트 코드 변경 없이 다크 모드 팔레트를 일괄 조정 가능.

### Changed
- 사용자 셸 composite 전반에서 단독 하드코딩된 `text-slate-*` / `text-gray-*` 클래스(쌍 없이 사용된 것들)를 시맨틱 유틸리티로 치환: `Moa_RightPanel`, `Moa_LoginPrompt`, `Moa_AppCard`, `Moa_DraggableAppIcon`, `Moa_SortableAppGrid`, `Moa_SubTabBar`, `Moa_Window`(리사이즈 그립), `Moa_HomePage`(윈도우 플레이스홀더), `Moa_MyPageWindowContent` 및 `mypage/Moa_MyPage*Panel.tsx` 전체. 기존 `dark:` 쌍이 이미 제대로 지정된 하드코딩은 변경하지 않음.
- `mypage/myPageStyles.ts` 의 `OUTER_GLASS` / `INPUT_SURFACE` / `ACTIVE_TAB_CLASS` / `INACTIVE_TAB_CLASS` / `DISABLED_TAB_CLASS` 등 공용 클래스 문자열을 시맨틱 토큰 기반으로 재작성.

## [0.2.60] - 2026-05-06

### Added
- `useMoabomDarkMode()` 훅 — `html.classList` 에 `dark` 클래스가 붙어 있는지 `MutationObserver` 로 실시간 감지해 반환한다. `react-glass-ui` 처럼 CSS 변형 대신 props 로 색을 받는 서드파티 컴포넌트의 다크 모드 분기용 (`src/hooks/useMoabomDarkMode.ts`).

### Fixed
- `Moa_Window` 의 `GlassCard` props 가 다크 모드에서 라이트 모드와 동일해 창 배경이 계속 화이트 반투명으로 남아있던 문제 — `useMoabomDarkMode()` 로 활성 테마를 감지해 다크일 때 `backgroundColor #0f172a`, `borderOpacity 0.12`, `innerLightOpacity 0.08`, `outerLightOpacity 0.35` 로 자동 전환. 리사이즈 그립 아이콘도 `dark:text-slate-300` 로 가독성 보강.

## [0.2.59] - 2026-05-06

### Fixed
- **다크 모드가 "밝기만 낮추는" 상태였던 근본 문제 해결** — `applyMoabomSystemAppearance` 가 `document.documentElement.dataset.moaTheme` 만 설정하고 **Tailwind `dark:` variant 활성화를 위한 `documentElement.classList.add('dark')` 호출이 누락**되어 있었다. `dark`·`flat-dark` 테마일 때만 `dark` 클래스를 추가하고 그 외는 제거하도록 표준화. (`moabomSystemStore.ts`)
- `Moa_homepage.css` 에서 `dark`/`flat-dark` 에 적용되던 임시 `filter: saturate(0.92) brightness(0.82)` 제거 — 실제 배경/표면 반전은 `dark:` variant 와 아래 반전 규칙이 담당한다.
- 유리 효과 라이트 전용 하드코딩을 다크 대응 변형으로 보완: `.glass-panel`, `.glass`, `.glass-sm`, `.glass-sm-blur`, `.moa-panel-outside-close(:hover)`, `.moa-responsive-backdrop`, `.moa-group`, `.moa-switch-checkbox(-track)` 다크 모드 변형 추가. 모든 outline 버튼(`moa-btn-*-outline`)과 filled 버튼(`moa-btn-success/warning/danger/dark`)의 hover 배경을 다크 모드에서 어두운 톤으로 반전.

### Added
- `resolveMoabomBrandColor(theme, pointColor)` / `isBrandEnforcedTheme(theme)` — `flat-light` 는 `#03c75a`(네이버), `flat-dark` 는 `#5865f2`(디스코드) 를 포인트 컬러에 강제 적용하는 유틸. `applyMoabomSystemAppearance` 가 활성 테마 기준으로 `--moa-point-color` / `--moa-point-rgb` 를 런타임에 덮어쓴다. (`moabomSystemStore.ts`)

## [0.2.58] - 2026-05-06

### Added
- `mergeMoabomSystemStateFromSettingsApi`: 관리자 업로드 배경 목록과 현재 선택을 교차 검증해 **첫 방문자·게스트·신규 사용자는 관리자 업로드 목록의 첫 번째 배경**을, 기존 선택이 관리자 목록에서 삭제됐으면 역시 첫 번째 배경을 자동으로 적용한다. 관리자 업로드가 전혀 없으면 `backgroundImageId`는 빈 문자열로 두어 셸 기본 배경색을 사용한다.

## [0.2.57] - 2026-05-06

### Removed
- 템플릿 번들 홈 배경 슬롯(1~13) 파일과 해석 로직 완전 제거:
  - `src/assets/images/background/background_{1..14}_85.jpg` 파일 전부 삭제 (폴더 제거)
  - `vite.config.ts` 의 `copyDirRecursive(...)` 블록 제거(번들 배경 폴더 복사 로직)
  - `moBackgroundAssets.ts` 에서 `MOABOM_TEMPLATE_IDENTIFIER`·`MOABOM_DEFAULT_BACKGROUND_IMAGE_ID`·`MOABOM_BACKGROUND_IMAGE_COUNT`·`listMoabomBackgroundImageIds`·`moabomTemplateAssetImgUrl`·`moabomBackgroundFilenameForId`·`deriveMoabomBackgroundImageChoices`·`TEMPLATE_BG_NUMERIC_RE`·`ABSOLUTE_URL_RE` 전부 삭제
  - 관리자 홈 배경 후보는 **업로드 UUID(`home_background_items[].id`) 만** 사용

### Changed
- `MoabomSystemDefaults.appearance`: `background_image_ids`·`include_template_backgrounds` 타입 제거 (`types/moabomSystem.ts`)
- `MoabomSystemAppearance.backgroundImageId` 의 허용 형식을 **UUIDv4 또는 빈 문자열** 로 축소
- `DEFAULT_MOABOM_SYSTEM.appearance.backgroundImageId` 기본값을 `'1'` → `''` 로 변경 — 업로드가 없으면 배경 없음 상태로 표시
- `moabomBackgroundImageCssValue`: 유효 UUID 가 아니면 `none` 반환 → 셸 기본 배경색 유지
- `resolveMoabomBackgroundImageUrl` / `resolveMoabomBackgroundThumbUrl`: 유효 UUID 가 아니면 빈 문자열 반환
- 마이페이지 환경설정 탭: "홈 배경" 섹션에 업로드 배경이 없으면 `section_background` 안내 문구(`background_empty`) 표시 (`Moa_MyPageSettingsTab`, 사용자 템플릿 `lang/*.json`)
- `moabomSystemServerMerge.test` / `moBackgroundAssets.test` 를 새 계약(UUID-only)에 맞게 재작성

## [0.2.56] - 2026-05-06

### Changed
- `moBackgroundAssets`: 관리자가 저장한 **임의 문자열 배경 ID**(번들 바깥 숫자 / 절대 URL / UUID)를 드롭하지 않도록 `TEMPLATE_BG_ID_RE` 범위 필터를 제거하고 `isValidMoabomBackgroundImageId`를 숫자ID·UUID·`http(s)://` URL 합집합으로 확장. `resolveBackgroundUrlForId`에 URL 분기 추가 — 절대 URL이면 그대로 반환, 번들 바깥 숫자는 템플릿 에셋 경로 그대로 생성(이미지 부재 시 브라우저 기본 처리). `deriveMoabomBackgroundImageChoices`는 번들 13개와의 교집합 대신 유효성 필터만 통과시켜 관리자 입력 순서를 유지함.

## [0.2.55] - 2026-05-06

### Fixed
- 비저장 사용자 병합 시 관리자 시스템 옵션 기본값(`on_by_default`)이 로컬 기본값에 덮이지 않도록 수정 (`moabomSystemServerMerge`)

### Changed
- 플랫폼 `default_language` 의존 제거 — 기본 언어는 브라우저 감지/고객 선택 기준 유지 (`moabomSystemStore`)

## [0.2.54] - 2026-05-06

### Fixed
- 관리자 마이페이지 appearance 설정을 **사용자 선택 후보**로만 병합하도록 수정 — 플랫폼 팔레트·배경 저장만으로 홈페이지 현재 테마/포인트/배경이 바뀌지 않음 (`moabomSystemServerMerge`, `moabomPullServerState`, `Moa_MyPageWindowContent`)

## [0.2.53] - 2026-05-05

### Changed
- 플랫폼 API `defaults.appearance` 에서 **`default_theme`·`default_point_color`·`default_background_image_id` 타입·의존 제거** — `defaultsToSystemState` 는 `resolveShellAppearanceFromPlatformLists`(허용 테마·팔레트·배경 후보의 **첫 항목**)만 사용

### Removed
- 관리자가 개별 “기본 화면값”을 저장하던 필드에 대한 프론트 타입 정의

## [0.2.52] - 2026-05-05

### Changed
- **게스트(비로그인)** 서버 병합: 플랫폼 `default_theme`·`default_point_color`·`default_background_image_id` 를 셸에 적용하지 않음 — 마이페이지에서 고객이 고를 **팔레트·배경 목록**만 API로 받고, 보이는 셸 스타일은 템플릿 내장 기본값(`defaultsToSystemState` 옵션, `pullMoabomServerState`에서 `usePlatformAppearanceDefaults: isLoggedIn`)
- `Moa_MyPageWindowContent`: 비로그인 시 정규화 기준도 동일하게 템플릿 appearance 기준

### Fixed
- 관리자가 플랫폼 기본 화면값을 저장했다고 **로그아웃 후 게스트 화면이 그 값으로 덮이는** 동작 제거

## [0.2.51] - 2026-05-05

### Fixed
- `mergeMoabomSystemStateFromSettingsApi`: **저장된 사용자 설정**은 `defaults_revision` 상승 시에도 테마·포인트·언어·시스템 옵션을 플랫폼 기본으로 덮지 않음(비저장·신규만 rev 재기준화)
- `point_color_presets` 밖 포인트 색은 병합 시 보정 + 로그인 시 `shouldPersistPointColorClamp`로 DB 동기화 (`moabomPullServerState`)

### Changed
- 플랫폼 설정 반영: **가시 탭에서 약 10초마다** `pullMoabomServerState` (홈 셸·마이페이지) — 탭 전환 없이도 관리자 저장이 곧바로 따라오도록 함
- `visibility`/창 `focus` 동기화 디바운스 **~180ms** 로 단축

## [0.2.50] - 2026-05-05

### Added
- **`defaults_revision` 동기화**: `localStorage moabom_system_defaults_revision` + 서버 rev 비교 — 관리자 플랫폼 설정 저장 후 **로그인 사용자 DB 설정도** 테마·포인트·배경·기본 언어·시스템옵션 기본값을 재기준화(레이아웃·센터모드 등은 유지)
- 셸·마이페이지: **`window` `focus`** 시에도 디바운스 pull(이미 `visible` 탭에서 관리자 저장만 한 경우 대비)

### Changed
- `mergeMoabomSystemStateFromSettingsApi`: rev 상승 시 `normalize(settings, default)` 대신 플랫폼 `defaultsToSystemState` 우선
- 공개 `frontend-defaults` 응답 래핑(`defaults` + `defaults_revision`) 파싱 (`moabomSystemApi`)
- `MoabomSystemOptionConfig` / 폴백: `on_by_default` (+ 구 `default` 폴백)
- 리베이스 또는 언어 정렬 시 **한 번의 `saveMoabomSystemSettings`** 로 사용자 행 동기화

## [0.2.49] - 2026-05-05

### Changed
- 환경설정 포인트 컬러 5번째 프리셋: **`#17c0e4`** (`presetId` `cyan`, 라벨 `moa_mypage.settings_ui.point_preset.cyan`) — 기존 `violet` `#8b5cf6` 슬롯 교체

## [0.2.48] - 2026-05-05

### Added
- `GET /api/modules/moabom-system/public/frontend-defaults` 연동: **게스트·비로그인 셸**도 플랫폼 `defaults`(배경·메뉴 등) 수신 (`fetchMoabomPublicFrontendDefaults`, `loadMoabomSettingsPayloadForMerge`)
- `pullMoabomServerState`: 로그인은 `user/settings`, 비로그인은 공개 defaults 로 병합·저장·appearance 적용을 한 경로로 처리 (`moabomPullServerState.ts`)

### Changed
- `Moa_HomePage` / `Moa_MyPageWindowContent`: 서버 동기화를 `pullMoabomServerState`로 통일, **`visibilitychange`** 디바운스(450ms)로 관리자 저장 후 탭 복귀 시 배경·defaults 재반영

## [0.2.47] - 2026-05-05

### Fixed
- `Moa_HomePage`: 서버 설정 pull effect 의존성에서 **`currentUser.language` 제거** — 마이페이지에서 언어·환경설정 저장 직후 코어 프로필 언어 갱신으로 effect가 재실행되며, 저장 전 API 응답으로 로컬/오버레이가 덮어쓰이던 레이스 완화

## [0.2.46] - 2026-05-05

### Added
- `mergeMoabomSystemStateFromSettingsApi`: 사용자 설정 API 응답을 로컬 상태와 병합하는 공통 유틸 (`moabomSystemServerMerge.ts`)

### Fixed
- `Moa_HomePage`: 로그인 후 **`/user/settings` 를 pulls** 하여 플랫폼 기본값·저장된 Moabom 설정을 셸에 반영 — 관리자 변경이 localStorage 에만 남아 홈 배경·테마가 갱신되지 않던 문제
- 서버에 `UserSystemSetting` 행이 없을 때: 로컬 `appearance` 가 플랫폼 defaults 를 덮어쓰지 않도록 병합 순서 수정(`mergeMoabomSystemStateFromSettingsApi`)

### Changed
- `Moa_MyPageWindowContent`: 위 병합 로직을 동일 유틸로 위임

## [0.2.45] - 2026-05-05

### Added
- 플랫폼 설정의 **업로드 홈 배경(UUID)** 지원: `deriveMoabomBackgroundImageChoicesFromAppearance`, `resolveMoabomBackgroundThumbUrl`, 모듈 API URL로 썸네일·전체 배경 해석 (`moBackgroundAssets`)

### Changed
- 마이페이지 설정 탭 배경 격자: 업로드 배경은 API 썸네일 사용 (`Moa_MyPageSettingsTab`)

## [0.2.44] - 2026-05-05

### Added
- 마이페이지 환경설정 **홈 배경**: `background_1_85.jpg`–`13` 썸네일 격자 선택 → 로컬/서버 설정의 `appearance.backgroundImageId`와 홈 셸 배경 연동 (`moBackgroundAssets`, `Moa_MyPageSettingsTab`, `Moa_HomePage`)
- Vite `closeBundle`: `src/assets/images/background/**` → `dist/img/background/` 재귀 복사

### Changed
- `moabomSystemStore`: `applyMoabomSystemAppearance`에 `--moa-shell-background-image` 설정

## [0.2.43] - 2026-05-05

### Changed
- 환경설정 포인트 컬러: **보라색 프리셋 `violet` (`#8b5cf6`)** 복구 — 이전 `moabom-system` 기본 팔레트에 있던 색이 템플릿 8색 정렬 과정에서 빠져 있었음(`moa_mypage.settings_ui.point_preset.violet` ko/en/ja/zh)

## [0.2.42] - 2026-05-05

### Changed
- 마이페이지 포인트 컬러 그리드: **PC(`≥1024px`) 열 수 12**로 확장 (`Moa_homepage.css`; 모바일은 기존 5열 유지)
- `Moa_Window`: **일반 창**(fitContent·컴팩트·최대화·최소화 제외)에 브라우저 **`resize` 시 창 너비·높이와 위치를 뷰포트 안으로 자동 클램프** — 브라우저 창을 줄여도 레이아웃이 따라가도록 처리

## [0.2.41] - 2026-05-05

### Changed
- 마이페이지 좌측 탭: **비활성(게스트 잠금) 시 손가락 커서 제거**(`cursor-default`), 활성 탭만 `cursor-pointer`
- 환경설정 포인트 컬러: 프리셋·직접 지명 영역 **`cursor-pointer` 명시**
- 크레딧 출석 체크 버튼: **`cursor-pointer`**, 로딩/비활성 시 **`disabled:cursor-not-allowed`**

## [0.2.40] - 2026-05-05

### Changed
- Moabom 시스템 설정 로드 시 **저장값이 없으면 `navigator.languages` / `navigator.language` 기준**(ko · en · ja · zh 우선 매칭)으로 UI 언어 기본 선택

## [0.2.39] - 2026-05-05

### Changed
- 메인 중앙 상단 바(`CenterPanel`): **480px 미만 높이 47px**, **480px 이상 58px** 고정으로 앱 편집 모드 전환 시 상단 줄높이 흔들림 완화

## [0.2.38] - 2026-05-05

### Changed
- 마이페이지 포인트 컬러: 선택 상태를 **축소·테두리 강조 없이 원형 유지**, **가운데 체크 아이콘**으로만 표시
- 직접 지정(팔레트) 칸은 **목록 프리셋과 겹치지 않을 때 체크**, 프리셋 선택 시에는 **팔레트 아이콘**으로 복귀

## [0.2.37] - 2026-05-05

### Changed
- 포인트 컬러 프리셋 그리드: **1024px 미만 구간 5열** 고정(기존 3·4·5열 단계 제거)

## [0.2.36] - 2026-05-05

### Changed
- 포인트 컬러: **디스코드 프리셋 제거** (기본 8개 + 직접 지정 1)
- PC 구간(`≥1024px`) 그리드를 **10열**로 조정 — 한 줄에 9칸이 채워져 정돈 표시

## [0.2.35] - 2026-05-05

### Changed
- 환경설정 포인트 컬러: **메인 프리셋만** 기존 primary **`#6366f1`** 로 복귀, 신규 기본 `pointColor` 동일
- 프리셋 **아래 라벨 제거**, 직접 선택은 **구분선·직접지정 문구 없이** 다크블루 다음 격자 셀로 배치(`Moa_MyPageSettingsTab`)

## [0.2.34] - 2026-05-05

### Changed
- 마이페이지 환경설정 **포인트 컬러** 기본 프리셋을 지정 팔레트(메인·네이버·디스코드·레퍼런스 등 9종)로 교체, 프리셋 아래 **`직접 지정`** 색 선택은 구분 영역으로 배치
- 프리셋 그리드: 모바일 3열 → 넓어질수록 4·5·6열로 재배치(`Moa_homepage.css`)·선택 링 포커스
- 기본 신규 `pointColor` 값을 **`#20cff4`** 로 정렬 (`moabomSystemStore`)
- 라벨: `moa_mypage.settings_ui.point_preset.*` 및 `point_custom_label`(ko/en/ja/zh)

### Added
- `PointColorPresetItem`·`derivePointPresetChoices` — 서버 `point_color_presets` 가 있으면 hex만 매핑, 없으면 기본 라벨 프리셋

## [0.2.33] - 2026-05-05

### Fixed
- **React #185**(maximum update depth) — 홈 레이아웃 실패 증상. 원인은 `MyPageWindowContent`에서 **① `initialTab`을 레이아웃에서 고정하는 effect** 와 **② 메뉴 구조상 탭 교정 passive effect** 가 서로 다른 탭으로 `setActiveTab`을 번갈아 호출하는 구조였음. 또 **URL 동기화 effect** 의 `path === formatShellPath` 비교가 **`/me`(프로파일)·`/me/profile` 문자열 차이**로 오판하여 `onActiveTabChange`를 반복 호출할 수 있었고, 불안정한 `onActiveTabChange` 의존성으로 같은 effect가 과도 재실행됨
- 처리: **`reconcileMyPageTabFromShell`**(`myPageUtils`)로 게스트 규칙·서버 메뉴·부모 탭을 **한 단계**에서 계산 후 `useLayoutEffect` 하나만 적용, URL 동기화는 **`parseShellPathname`** 의 **탭语义** 로만 비교, 콜백은 **`ref`** 로 참조하여 effect 의존성에서 분리

### Changed
- `HomePage`: 마이페이지 탭 알림 시 **동일 탭이면 `setWindows` 생략**해 불필요한 재렌더 감소

## [0.2.32] - 2026-05-05

### Fixed
- 우측 패널에서 마이페이지 **프로필↔설정↔크레딧** 전환 시 창 내용이 빠르게 왕복하던 현상 — `MyPageWindowContent`의 URL 동기화 `useEffect`가 **같은 프레임에서 아직 갱신되지 않은 `activeTab`** 기준으로 `onActiveTabChange`를 호출해 부모가 `/me/…` 를 되돌리며 루프가 남. **`initialTab` → `activeTab` 반영을 `useLayoutEffect`로** 옮겨 passive effect 실행 시점에는 경로와 탭이 이미 일치하도록 함

### Changed
- 푸터 지구본·설정 버튼: 호버 시 **아이콘만 흰색**

## [0.2.31] - 2026-05-05

### Changed
- 푸터 지구본·설정 버튼(`moa-btn-xxs-duo`): 좌우 패딩 **0.45rem**, **테두리 제거**

## [0.2.30] - 2026-05-05

### Changed
- 푸터 **환경설정** 버튼: **글로브+기어** 아이콘을 하나의 버튼(`size="xxsDuo"` / `moa-btn-xxs-duo`)으로 묶어 동일 동작 유지
- **태스크바** 최소화 창 버튼: 뷰포트 **≤480px**(`compactControls`)일 때 `moa-btn-xs`, 그 외 `moa-btn-sm`
- `Button`: **`xxsDuo`** 사이즈 추가

## [0.2.29] - 2026-05-05

### Changed
- 푸터 **언어·환경설정** 지구본 버튼: **1rem(h-4·w-4)** 고정 `moa-btn-xxs` + `Button` `primary-outline`·`Icon` `xxs`로 라이브러리화(인라인 유틸 클래스 제거)
- `Button`: **`size="xxs"`** 지원(`moa-btn-xxs`)

## [0.2.28] - 2026-05-05

### Added
- 메인 패널 푸터(개인정보처리방침 오른쪽): **지구본 아이콘** — 클릭 시 마이페이지 **환경설정** 탭으로 이동 (`Moa_CenterPanel`, `HomePage`)

## [0.2.27] - 2026-05-05

### Fixed
- 로그인 후 마이페이지를 열면 **좌측 패널이 닫히던 현상** — 로드한 Moabom 서버 설정을 `saveMoabomSystemState`할 때 `layout.leftPanelOpen`(또는 서버 JSON의 레이아웃 스냅샷)이 로컬 셸보다 우선해 `HomePage`의 `useEffect`가 `setLeftOpen(systemState.layout.leftPanelOpen)`로 패널을 접던 문제. **마이페이지 fetch 직전 `loadMoabomSystemState()`의 좌·우 패널 열림만 유지**하고 `centerMode` 등 나머지 레이아웃 필드는 병합 결과를 따름

## [0.2.26] - 2026-05-05

### Fixed
- 앱 실행 후 마이페이지에서 **뒤로가기 시 주소만 잠깐 바뀌고 `/me`로 고정**되며 네비가 먹통이 되던 현상 — `MyPageWindowContent`의 URL 동기화 effect가 **현재 경로가 `/me`가 아닐 때도** `replaceShellPath`를 호출하여 popstate 로 바뀐 주소를 덮어쓰던 버그. **location이 `/me`·`/me/…` 일 때만** 탭과 URL을 맞춤

## [0.2.25] - 2026-05-05

### Fixed
- **마이페이지 진입 시 브라우저 뒤로가기로 이전 앱 URL이 사라지던 원인** — `openMyPage`가 `pushShellPath`를 `setTimeout(0)`으로 미루는 동안 `MyPageWindowContent`가 마운트 직후 `replaceShellPath('/me/…')`를 실행해, **당시 히스토리 최상단이 마지막 앱 엔트리일 때 그 엔트리를 덮어씀**. URL을 `setState`보다 **먼저 동기 반영**, 기존 마이페이지 창 포커스는 `replaceShellPath`만 사용. `restoreTaskbarWindow`·`openApp`·`openAuthWindow`도 동일하게 지연 `push` 제거
- 마이페이지: 현재 URL이 이미 `/me/{tab}`과 같으면 `onActiveTabChange`로 부모 URL 동기화 생략

## [0.2.24] - 2026-05-05

### Fixed
- 브라우저 뒤로가기 시 셸 URL은 바뀌는데 **`/me/settings` 등에서 앱으로 복귀가 안 보이던 현상** — `popstate`를 **캡처 단계**에서 처리해 코어 `Router`의 레이아웃 재처리보다 먼저 `applyShellRoute`로 윈도우를 동기화

## [0.2.23] - 2026-05-05

### Fixed
- 홈 셸 REST 경로(`/me`, `/me/:tab`, `/auth/:mode`, `/app/:id`)가 `routes.json`에 없어 **전체 로드·뒤로가기(popstate) 시** 라우트 미매칭 → `#app` 빈 Fallback만 보이던 문제 — 위 경로를 모두 `home` 레이아웃(`HomePage`)에 연결

## [0.2.22] - 2026-05-04

### Fixed
- 메인 그리드 **앱 만들기** 타일: DnD/버튼 하위 트리에서 드물게 문자만 갱신이 어긋날 여지 대비 — `language` 기준 `key`로 해당 블록 리마운트 보조 (`Moa_SortableAppGrid`; Context 자체로는 `t` 참조 교체 시 동일 패널 전반이 리렌더됨)
- 좌측 패널 **앱 랭킹** 줄: `Moa_OverflowMarqueeText` 조합이 좁은 폭·마퀴 측정과 겹치며 이름·설명이 비어 보이던 현상 — 동일 데이터(`RANKING_DATA.apps`) 유지, 표시만 **말줄임(`truncate`) + `title`**으로 안정화(코드에서 목록 제거한 적 없음)
- **마퀴(.moa-overflow-marquee)**: 커스텀 CSS `line-height: inherit`가(언레이어) Tailwind `leading-tight` 등 `leading-*`보다 우선해 라벨 행 높이가 인접 줄과 어긋나던 문제 — `__seg`·`__track`·`__inner--ellipsis`에서 상속 강제 제거, 루트·측정용 span은 숨김 측정용 `line-height: 0 !important`로 유지
- **마퀴 래퍼** `.moa-overflow-marquee`에 `line-height: 0` — 인접 행에서 마퀴 활성/비활성 줄 높이 정렬
- 표시 언어 **한국어**: 코어 프로필이 아직 `en`일 때 `alignMoabomPreferenceWithCoreProfile`가 `preferences.language`를 `en`으로 바꿔 `moabomT` 오버레이가 `en.json`만 로드되던 문제 — `ko` 선택은 프로필 `ko` 동기 전까지 유지 (일·중과 동일한 “동기 지연” 처리)

### Changed
- 메인 그리드 **앱 만들기** 타일: 제목·설명을 `moa_shell.center.create_app_title` / `create_app_desc`로 다국어화
- 모바일 오버레이 **좌·우 패널** 화면 끝 flush·바깥 코너 직각: **`BREAKPOINT_COMPACT_CONTROLS`(480px) 이하**이고 `mobile-overlay`일 때만 적용 (그 외 구간은 기존처럼 10px 인셋·전면 24px 라운드)
- 마이페이지 좌측 메뉴: **860px 이하**에서 항목 **상하 간격** `gap-3` → `gap-2`
- 마이페이지 좌측 탭: **860px 이하**에서 설명 한 줄(`.moa-mypage-menu-desc`) **숨김** — 모바일에서 두 줄로 세로가 과하게 길어지는 문제 완화

## [0.2.21] - 2026-05-04

### Fixed
- `Moa_RightPanel`: `panel-slide-no-motion` 제거 — 좌측 패널과 동일하게 `transform`/`opacity` 슬라이드 트랜지션(`panel-slide`) 적용

## [0.2.20] - 2026-05-04

### Fixed
- 모바일 오버레이: 좌·우 패널 토글 시 `saveMoabomSystemState`로 `layout`이 갱신될 때마다 effect가 패널을 강제로 닫아 한 번 더 눌러야 열리던 현상 — **반응 모드가 바뀐 직후에만** 오버레이 패널 상태를 리셋하도록 수정
- `Moa_OverflowMarqueeText`: 마퀴 활성 시 라벨 줄 높이가 커지던 문제 — 래퍼 `min-height` 제거, 트랙 `align-items: baseline`·부모 `line-height: inherit`, 측정용 `span` 높이 0으로 수직 여유 제거

### Changed
- 마퀴: PC 호버 재생 분기 제거 — 다시 **항상** 흐름(감도저감 설정은 그대로)

## [0.2.19] - 2026-05-04

### Changed
- `Moa_OverflowMarqueeText`: PC(미세 포인터·hover 가능)에서는 호버 시에만 마퀴 재생(`animation-play-state`), 모바일은 기존처럼 자동
- 마퀴 선속도 완화(36→28px/s), 루프 간격(`--moa-marquee-sep`) 축소, 짧게 넘치는 라벨은 `text-overflow: clip`로 어설픈 말줄임 완화
- 마퀴 측정 `span`: `-99999px` 제거(가로 스크롤·떨림 유발 가능) → 뷰포트 내 오프스크린 측정·`display:block`으로 라인 박스 정리

### Fixed
- `<480px` 등 좁은 폭에서 마이페이지 사이드 메뉴·마퀴 측정으로 뷰포트 가로가 넓어지던 현상 — `.moa-mypage-layout`/`.moa-mypage-surface`에 `max-width:100%`·`overflow-x: clip`, 루트 `max-w-[100vw]`
- 마이페이지 탭 라벨이 가운데로 보이던 문제 — `.moa-overflow-marquee { text-align: start }`, 모바일 사이드 메뉴 flex를 좌측 정렬로 복구
- 랭킹 앱 행 `key={idx}` → `key={item.id}`로 안정화(언어 전환·마퀴 리사이즈 시 리스트 깜빡임 완화)

## [0.2.18] - 2026-05-04

### Fixed
- 홈 셸 `updateSystemState`가 오래된 React state를 베이스로 쓰던 버그 — `localStorage` 최신값으로 병합·레이아웃 패치는 변경 필드만 전달. 마이페이지에서 일본어 등으로 바꾼 뒤 좌·우 패널을 열 때 한국어로 되돌아가던 현상
- `MOABOM_SYSTEM_STATE_CHANGED_EVENT`로 홈 `systemState` 동기화
- `alignMoabomPreferenceWithCoreProfile`: ja/zh 선택 시 코어가 아직 `ko`인 경우(프로필 `en` 반영 지연) Moabom 언어 유지
- `Moa_OverflowMarqueeText`: ResizeObserver를 rAF로 묶어 CJK 등 폭 변동 시 좌우 떨림 완화, 마퀴에 `translate3d`·`contain: layout`·`backface-visibility`

## [0.2.17] - 2026-05-04

### Fixed
- `Moa_OverflowMarqueeText`: ResizeObserver + 오버플로 임계값 깜빡임으로 `setOverflows`가 연쇄되며 React #185(최대 업데이트 깊이)가 날 수 있던 문제 — 히스테리시스, `wOuter < 2` 무시, `overflows` 의존 제거로 관측 루프 차단
- `MyPageWindowContent`: `initialTab`/탭 라우팅 `setActiveTab`을 동일 값이면 생략해 불필요한 렌더 연쇄 완화

## [0.2.16] - 2026-05-04

### Changed
- `Moa_OverflowMarqueeText`: 마퀴 주기를 `이동거리(px) ÷ 고정 선속도(36px/s)`로 계산해 길·짧은 라벨 체감 속도 통일, 극단만 1.75~28초로 클램프

## [0.2.15] - 2026-05-04

### Changed
- `Moa_OverflowMarqueeText`: 넘칠 때 `[텍스트][간격][동일 텍스트]` 무한 루프 마퀴로 전환 — 끝·앞이 자연스럽게 이어지며 `--moa-marquee-sep`(기본 1.25rem)로 꼬리·머리 사이 여백 조절

## [0.2.14] - 2026-05-04

### Changed
- `Moa_OverflowMarqueeText`: PC·모바일 동일하게 넘침 시 좌측 스크롤만 반복(호버 분기 제거), 끝에서 잠시 멈춘 뒤 처음으로 돌아와 다시 재생 — 되감기(우측) 애니메이션 제거
- 마퀴 래퍼 `min-height`·`inline-block`+`vertical-align: middle`로 짧은 라벨과 긴 라벨 줄 정렬 균일화

### Removed
- `parentGroupHover` prop(그룹 호버 전용 마퀴는 사용처 없음)

## [0.2.13] - 2026-05-04

### Fixed
- 좌측 패널 앱 그리드 `justify-items: center` + `min-width: auto`로 긴 라벨이 셀 밖으로 겹치던 문제 — `stretch`, 그리드 자식 `min-width: 0`, 라벨 컨테이너·버튼 `w-full`/`max-width`로 클리핑
- `(hover: none)`(대부분 모바일)에서 마퀴가 멈추지 않고 자동 반복되도록 CSS 분기
- 메인 그리드·마이페이지 보관함도 동일한 셀 폭·`min-width: 0` 패턴으로 정리

## [0.2.12] - 2026-05-04

### Added
- 넘치는 한 줄 라벨용 `Moa_OverflowMarqueeText`(ResizeObserver + 호버·포커스 시만 CSS 스크롤, `prefers-reduced-motion` 존중)
- 메인/좌측/우측 패널 앱 아이콘·앱 카드·마이페이지 라이브러리/사이드 탭 등에 적용

## [0.2.11] - 2026-05-04

### Fixed
- 회원가입 언어 선택값을 코어 프로필 언어 타입(`ko|en`)으로 정규화해 선언 파일 생성 시 타입 오류가 나지 않도록 수정
- 마이페이지 크레딧 테스트 번역 스텁에서 ES2020 타깃과 맞지 않는 `replaceAll` 사용 제거

## [0.2.10] - 2026-05-04

### Fixed
- 표시 언어가 한국어일 때 앱 이름·설명이 영어로만 나오던 문제 — `moa_apps.*`는 템플릿 오버레이(`lang/*.json`)에 정의된 경우에만 사용하고, 오버레이가 활성인데 키가 없으면 `G7Core.t`를 거치지 않고 `Moa_apps` 원문(한글)으로 폴백

## [0.2.9] - 2026-05-04

### Fixed
- 마이페이지 표시 언어 변경 후 메인·좌측 패널·라이브러리 앱 제목이 영문으로 고정되는 문제 — 서버에 저장된 Moabom 설정이 있을 때는 코어 프로필 정렬(`alignMoabomPreferenceWithCoreProfile`)을 적용하지 않음
- 설정 저장 직후 `currentUser.language` 갱신으로 Moabom 설정 GET이 반복되어 구버전 서버 응답이 로컬 언어를 덮어쓰던 레이스 — 동기화 effect 의존성을 로그인 사용자 식별자(`memberKey`, 코어 id·이메일)만으로 한정

## [0.2.8] - 2026-05-04

### Added
- 마이페이지 라이브러리 섹션에 `locale`·`resolveAppStrings` 연동으로 표시 언어 전환 시 앱 이름·설명 즉시 반영
- `lang/en.json`, `lang/ja.json`, `lang/zh.json`에 카탈로그 앱용 `moa_apps.{id}.name|description` 번역 블록
- `resolveAppStrings` 단위 테스트 (`resolveAppStrings.test.ts`)

### Changed
- `CenterPanel` 단위 테스트에 `appsById`, `authWindowAppIds` 필수 prop 반영

## [0.2.7] - 2026-05-04

### Fixed
- 환경설정에서 언어만 바꿀 때 `currentUser` 객체 갱신으로 `initialTab` 동기화 effect가 다시 돌며 활성 탭이 프로필로 돌아가던 문제 — 로그인 여부(`isLoggedIn`)가 바뀔 때만 부모 `initialTab`을 반영
- 탭 유효성 보정 effect가 번역된 `tabs` 배열 참조에 묶여 매 렌더마다 실행되던 부담을 `tabStructureForRouting` 기준으로 제한

## [0.2.6] - 2026-05-04

### Fixed
- 마이페이지 좌측 탭: 서버 메뉴 설정에 한글 라벨이 있으면 번역 파일보다 우선되어 언어 전환 시 고정되는 문제 — `lang` 번역이 있으면 항상 우선 표시

## [0.2.5] - 2026-05-04

### Fixed
- 마이페이지 표시 언어 변경 시 `G7Core.locale.change`(템플릿 엔진 재초기화)가 다시 호출되며 홈 셸·창이 초기화되던 문제 — 마이페이지는 항상 `lang/*.json` 오버레이만 로드하도록 통일

### Added
- 로그인·회원가입·비밀번호 찾기/재설정 창(`Moa_AuthWindowContent`) 문자열을 `moa_auth.*` 키와 `MoabomUiI18nProvider`로 번역하여 홈과 동일하게 실시간 언어 전환

### Changed
- 서버 설정 동기화 시 코어 프로필 정렬 후에도 `template-global` 로케일 스코프로 되돌리지 않음(전역 리페인트 방지)

## [0.2.4] - 2026-05-04

### Changed
- 홈(`Moa_HomePage`) 플레이스홀더·앱 그리드 추가 토스트·SNS `postMessage` 오류 문구를 `moa_shell.*` 키로 통일하고 `t` 의존성을 보강
- `Moa_LoginPrompt` SNS 버튼·구분 라벨을 `moa_shell.login_prompt.social_*` / `sns_label`로 번역 가능하게 정리
- `MoabomUiI18nTestProvider` 스텁에 로그인 프롬프트 키 추가, `LoginPrompt`·`RightPanel`·`CenterPanel` 단위 테스트에서 Provider로 감쌈

## [0.2.3] - 2026-05-04

### Changed
- 마이페이지 설정에서 표시 언어를 바꿀 때는 `G7Core.locale.change`를 호출하지 않고 템플릿 `lang/ko|en|ja|zh.json` 오버레이만 적용해 전역 화면 리페인트를 막음
- 서버 설정 동기화 시 코어 프로필과 맞추어 `preferences.language`가 바뀌는 경우에만 `template-global`로 두어 기존처럼 전역 로케일 반영

## [0.2.2] - 2026-05-04

### Changed
- 마이페이지 설정에서 **표시 언어만** 변경한 경우 `AuthManager.checkAuth` 전체 재호출을 생략하고 프로필 `language`만 갱신해, 로그인 화면과 같은 깜빡임·재동기화 부하를 줄임 (`isMoabomSystemStateLanguageOnlyChange`)

## [0.2.1] - 2026-05-04

### Fixed
- Vitest가 jsdom 29 → `html-encoding-sniffer`/`@exodus/bytes` ESM 로딩 오류(`ERR_REQUIRE_ESM`)로 워커를 띄우지 못하던 문제를 `happy-dom` 테스트 환경으로 해결
- 테스트 설정의 `localStorage` 목이 `getItem`을 반영하지 않아 Bearer 토큰/API 테스트가 실패하던 문제를 인메모리 구현으로 수정
- `fetchEnabledSocialProviders` 모듈 캐시가 테스트 간에 남아 SNS 관련 단언이 깨지던 문제 — `resetSocialAuthProvidersCache()`로 초기화

## [0.2.0] - 2026-05-04

### Added
- 코어 `POST /api/user/profile/update-language`와 Moabom `preferences.language` 동기: 한·영은 프로필과 동일, 일·중은 프로필을 `en`으로 유지
- 일·중 UI는 `GET /api/templates/moabom-basic/lang/ja|zh.json` 오버레이로 표시하고 `G7Core.locale.change`를 호출하지 않아 창 깜빡임 완화
- 서버의 `users.language`와 설정 불일치 시 마이페이지에서 자동 정렬 후 사용자 설정 API에 반영

### Changed
- `moabomT`: 오버레이 사전 조회 후 `G7Core.t` 폴백

## [0.1.99] - 2026-05-04

### Added
- 마이페이지 문자열용 `lang/en.json`, `lang/ja.json`, `lang/zh.json`의 `moa_mypage` 블록을 `ko.json`과 동일 키 구조로 정비

### Changed
- 마이페이지 UI·토스트·설정 탭을 `useMoabomT` + `G7Core.locale.change` 연동으로 번역 키 기반 표시로 통일

## [0.1.98] - 2026-05-04

### Changed
- 로그인·비로그인 모두 Moabom 저장 언어와 템플릿 로케일(`G7Core.locale.change`)을 초기 로드·서버 동기화 시점에 맞춥니다.

## [0.1.97] - 2026-05-03

### Fixed
- 관리자 마이페이지 설정에서 노출 해제한 탭을 마이페이지 좌측 메뉴에서 숨기도록 수정

## [0.1.96] - 2026-05-03

### Added
- 마이페이지 환경설정을 `moabom_system` 스키마와 `moabom-system` 사용자 설정 API에 연결
- 일본어/중국어 리소스와 4종 화면 테마, 실시간 포인트 컬러 적용 흐름 추가

### Changed
- 마이페이지 설정 탭을 별도 컴포넌트로 분리하고 홈 패널 열림/중앙 모드 상태를 통합 저장소로 관리

## [0.1.95] - 2026-05-03

### Changed
- SNS 가입자 비밀번호 변경 안내를 토스트 대신 계정 보안 패널의 일반 안내문으로 표시

## [0.1.94] - 2026-05-03

### Changed
- SNS 가입자 회원 탈퇴는 비밀번호 입력 없이 최종 확인 단계로 바로 이동하도록 조정

## [0.1.93] - 2026-05-03

### Changed
- SNS 가입자 비밀번호 변경 안내를 로컬스토리지 대신 프로필 API의 DB 기반 provider 정보로 판별

## [0.1.92] - 2026-05-03

### Changed
- SNS 가입자가 마이페이지 비밀번호 변경을 누르면 provider 안내 토스트만 표시하도록 조정

## [0.1.91] - 2026-05-03

### Changed
- 마이페이지 계정 보안 확장 패널 배경을 `moa-group` 스타일로 통일

## [0.1.90] - 2026-05-03

### Added
- 마이페이지 계정 보안에서 그누보드7 API 기반 비밀번호 변경 및 회원 탈퇴 플로우 추가

## [0.1.89] - 2026-05-03

### Changed
- 마이페이지 좌측 메뉴에 구독 관리를 추가하고 계정 관리의 구독 패널을 구독 관리 탭으로 이동

## [0.1.88] - 2026-05-03

### Changed
- 마이페이지 내 활동 필터 버튼을 모바일에서 2열 그리드로 정리

## [0.1.87] - 2026-05-03

### Changed
- 마이페이지 내 활동 상단 타이틀/설명을 제거하고 글·댓글·받은 반응 요약 카드를 3열 반응형 배치로 개선

## [0.1.86] - 2026-05-03

### Changed
- 마이페이지 `활동 기록` 탭을 `내 활동`으로 변경하고 게시판 활동 API 기반으로 작성글/댓글/받은 반응을 표시

## [0.1.85] - 2026-05-03

### Added
- 마이페이지 크레딧 카드에 출석체크 즉시 적립 버튼 추가

## [0.1.84] - 2026-05-03

### Changed
- 마이페이지 크레딧 탭을 코어 API 대신 `moabom-credit` 모듈 API 조회로 변경

## [0.1.83] - 2026-05-03

### Changed
- 마이페이지 크레딧 호칭을 통일하고 크레딧 탭을 API 조회 기반으로 변경

## [0.1.82] - 2026-05-03

### Changed
- 우측 패널 관리자 모드 버튼의 인라인 배경 스타일 제거 (`variant="dark"` 기본 스타일 적용)

## [0.1.81] - 2026-05-03

### Changed
- 마이페이지 프로필 설정의 이미지 변경 버튼 아래 정사각형 저장 안내 문구 제거

## [0.1.80] - 2026-05-03

### Changed
- 로그인/회원가입 SNS 버튼의 빈 간격 보정 요소를 제거하고 가운데 정렬로 단순화

## [0.1.79] - 2026-05-03

### Changed
- 로그인/회원가입 SNS 버튼을 우측 패널 스타일과 동일하게 맞추고 최소 반응형 구간에서 아이콘만 표시

## [0.1.78] - 2026-05-03

### Fixed
- 마이페이지 프로필 저장 시 계정관리로 이동한 필수 이름/이메일 값을 함께 전송하도록 수정

## [0.1.77] - 2026-05-03

### Changed
- 마이페이지 프로필 사진을 200x200 정사각형으로 크롭 후 그누보드7 아바타 API에 저장하고 우측 패널에 즉시 반영

## [0.1.76] - 2026-05-03

### Changed
- 비로그인 상태의 앱 보관함 내가 만든 앱 영역에 로그인 필요 안내 표시

## [0.1.75] - 2026-05-03

### Fixed
- `/login` 직접 진입 시 초기 로그인창 효과가 닫기/최소화/회원가입/비밀번호 찾기 전환을 다시 덮지 않도록 수정

## [0.1.74] - 2026-05-03

### Changed
- 앱 보관함 앱 실행 연결, 즐겨찾기 실시간 공유, 최근 실행 앱 9개 저장/표시 처리 추가

## [0.1.73] - 2026-05-03

### Changed
- 마이페이지 우측 컨텐츠 세로 채움 관련 스타일을 제거하고 좌측 메뉴 높이 채움만 유지

## [0.1.72] - 2026-05-03

### Changed
- 인증창 즐겨찾기 버튼 숨김, 비로그인 마이페이지 탭 제한, PC 마이페이지 높이 채움 처리

## [0.1.71] - 2026-05-03

### Fixed
- 인증창 fitContent 높이 재측정 시 고정 초기 좌표가 남아 아래로 치우치던 위치 계산 수정

## [0.1.70] - 2026-05-03

### Changed
- 테스크바 버튼 border를 transparent 변수 대신 전용 variant의 `border: none`으로 단순화

## [0.1.69] - 2026-05-03

### Changed
- 테스크바 버튼을 전용 variant로 분리해 앱 그라데이션, 흰 텍스트, 연한 회색 그림자를 사용하도록 정리

## [0.1.68] - 2026-05-03

### Fixed
- 테스크바 아이콘 복원을 click 이벤트 대신 pointerup 기반으로 처리해 드래그 슬라이드와 실행 충돌 방지

## [0.1.67] - 2026-05-03

### Fixed
- 테스크바 상태를 열린 창 상태와 분리해 새로고침 복구, 아이콘 실행, 최소화 제한 동작을 정리

## [0.1.66] - 2026-05-03

### Fixed
- 테스크바 아이콘 클릭 복원이 열린 창 제한에 막히지 않도록 수정하고 버튼 크기/패딩 조정

## [0.1.65] - 2026-05-03

### Changed
- 테스크바 아이콘과 열린 창 개수 제한을 분리하고 스크롤바 없는 가로 슬라이드로 정리

## [0.1.64] - 2026-05-03

### Changed
- 최소화 테스크바 버튼 제한, 가로 슬라이드, 드래그 클릭 방지 및 로컬 저장 처리 추가

## [0.1.63] - 2026-05-03

### Changed
- 일반 앱 윈도우 위치 이동 폭을 10px로 줄이고 인증/마이페이지 창은 중앙 고정으로 조정

## [0.1.62] - 2026-05-03

### Fixed
- 첫 번째 중앙 창을 기준으로 이후 윈도우가 같은 방향으로 쌓이도록 초기 위치 계산 수정

## [0.1.61] - 2026-05-03

### Changed
- 첫 번째 윈도우는 중앙에서 열리고 이후 창만 위치 보정되도록 조정

## [0.1.60] - 2026-05-03

### Changed
- 윈도우 최대 실행 수를 5개로 제한하고 새 창 초기 위치를 좌상단 방향으로 보정

## [0.1.59] - 2026-05-03

### Changed
- 마이페이지 계정 정보를 계정관리 탭으로 이동하고 사용자 안내 문구를 자연스럽게 정리

## [0.1.58] - 2026-05-03

### Changed
- filled 버튼 hover 이펙트를 shadow 중심으로 통일하고 dark 버튼 색상을 `#475465` 톤으로 조정

## [0.1.57] - 2026-05-03

### Changed
- 우측 패널 SNS 버튼이 브랜드 색상은 유지하면서 `moa-btn-medium` 크기 규격을 따르도록 정리

## [0.1.56] - 2026-05-03

### Changed
- 인증 주요 CTA 버튼 크기를 medium으로 통일하고 primary 버튼 hover 이펙트 추가

## [0.1.55] - 2026-05-03

### Changed
- 메인 상단 좌우 패널 토글은 `moa-point-fill` 예외로 두고 기존 point 배경만 사용하도록 복구

## [0.1.54] - 2026-05-03

### Fixed
- `moa-point-fill` border가 실제 렌더링되도록 `border: 1px solid var(--moa-point-fill-bg)`로 수정

## [0.1.53] - 2026-05-03

### Changed
- `.moa-btn` 베이스에서 variant/outline 전용 기본 변수를 제거하고 색상·그림자 정의를 각 variant로 이동

## [0.1.52] - 2026-05-03

### Changed
- `moa-point-fill`에 point 컬러 border를 추가하고 안쪽 그림자를 `inset 0 1px 0 #ffffff4d`로 조정

## [0.1.51] - 2026-05-03

### Changed
- point 컬러 채움 배경과 그림자 스타일을 `moa-point-fill`/공통 변수로 재사용하도록 정리
- primary 버튼, 마이페이지 활성 메뉴, 패널 서브탭 인디케이터, 활성 토글의 point 채움 스타일을 통일

## [0.1.50] - 2026-05-03

### Changed
- 메인 모드 선택 버튼 패딩을 전체 화면 크기에서 `px-3 py-1`로 통일

## [0.1.49] - 2026-05-03

### Changed
- 메인 헤더와 토글 축소 적용 기준을 모바일 오버레이 전체가 아닌 480px 이하로 제한

## [0.1.48] - 2026-05-03

### Changed
- 메인 헤더와 토글 축소를 PC가 아닌 모바일 오버레이 구간에만 적용
- 모바일 메인 모드 선택 버튼 패딩을 `px-3 py-1`로 정리

## [0.1.47] - 2026-05-03

### Added
- 토글 아이콘용 `xxs` 아이콘 크기 추가

### Changed
- 모바일 메인 헤더 패딩과 모드 타이틀 크기를 줄여 타이틀 줄바꿈 방지
- 좌우 패널 토글을 5px 축소한 원형 thumb 기준으로 비율 조정

## [0.1.46] - 2026-05-03

### Changed
- 로그인 프롬프트와 인증/패널 variant 버튼의 중복 radius 클래스를 제거해 공통 버튼 radius(`0.9rem`)로 통일
- 우측 패널 SNS 로그인 버튼의 전용 색상은 유지하되 radius를 이메일 로그인 버튼과 동일한 `0.9rem`로 조정

## [0.1.45] - 2026-05-03

### Changed
- 모바일 좌측 패널 앱 타이틀 크기를 낮추고 메인 앱 타이틀·설명 크기를 소폭 확대
- 360px 이하 모바일에서 오버레이 패널 외부 닫기 버튼 여백이 유지되도록 패널 폭과 좌측 앱 그리드 간격 조정

## [0.1.44] - 2026-05-03

### Fixed
- 모바일 회원가입에서 스위치 체크박스 포커스 시 인증 창이 위로 밀리는 현상 방지

### Changed
- 우측 패널 SNS 로그인 버튼 radius를 이메일 로그인 버튼과 동일한 35px로 명시

## [0.1.43] - 2026-05-02

### Added
- 약관 동의용 스위치 스타일 체크박스 컴포넌트 추가

### Changed
- 우측 패널 SNS 로그인 버튼을 구글·네이버·카카오 전용 색상 스타일로 복구
- 우측 패널 이메일 로그인 아래 회원가입·비밀번호 찾기 보조 버튼 제거
- 로그인·회원가입 하단 SNS 버튼 순서를 Google, Naver, Kakao 순으로 고정

## [0.1.42] - 2026-05-02

### Changed
- 인증 창과 로그인 유도 카드의 액션 버튼을 공통 버튼 variant/size 기반으로 정리
- 전역 `text-xs`와 `moa-btn-xs` 크기를 `0.8rem`로 맞추고 메인 설명 크기 변수를 `0.8rem`로 조정
- SNS 로그인 전용 버튼 hover 오버라이드를 제거해 공통 버튼 hover 규칙으로 통일

## [0.1.41] - 2026-05-02

### Changed
- 템플릿 전반의 `font-bold`를 `font-semibold`로, 기존 `font-semibold`를 `font-medium`으로 한 단계 낮춰 굵기 체계 정리
- 홈페이지 중앙 태스크바·우측 패널 액션 버튼을 공통 버튼 variant/size 기반으로 정리

## [0.1.40] - 2026-05-02

### Changed
- MOABOM 버튼 기본 굵기를 `font-weight: 500`으로 조정
- 마이페이지 variant 버튼에서 중복 폰트 크기·굵기·색상 클래스 제거

## [0.1.39] - 2026-05-02

### Changed
- `dark-outline` 버튼 색상을 `#475465` 기준으로 낮춰 검은 느낌 완화
- 버튼 hover 시 배경·보더·텍스트·그림자 전환 애니메이션 복원

## [0.1.38] - 2026-05-02

### Changed
- outline 버튼의 기존 최종 렌더링 색상(투명 흰 배경, 옅은 hover 배경, 진해지는 보더)을 전역 버튼 규칙에 직접 복원
- outline 버튼 배경·보더 알파값을 공통 변수로 통일하고, 화면 테마 아이콘의 직접 색상 클래스를 제거해 부모 버튼 색상 상속

## [0.1.37] - 2026-05-02

### Changed
- 버튼 variant별 최종 색상과 hover 색상을 공통 변수 구조 안에 복원하고, 알파 배경은 단일 값으로 통일
- 환경 설정 테마 버튼 아이콘 색상을 언어 버튼과 같은 선택 텍스트 헬퍼로 통일

## [0.1.36] - 2026-05-02

### Changed
- 모든 MOABOM 버튼 variant를 공통 CSS 변수 기반 구조로 정리해 filled/outline 스타일 규칙 통일
- variant별 hover·배경·테두리 중복 선언을 제거하고 화면별 버튼 스타일 덮어쓰기 없이 전역 버튼 규칙만 사용

## [0.1.35] - 2026-05-02

### Changed
- 버튼 스타일을 전역 `.moa-btn-*` 규칙 한 곳에서만 관리하도록 마이페이지 전용 버튼 override 제거
- `primary`·`primary-outline` 버튼에서 `color-mix` 기반 보정 스타일을 제거해 불필요한 `@supports` 분기 생성을 방지

## [0.1.34] - 2026-05-02

### Changed
- 마이페이지 액션 버튼은 `primary-outline`, 환경 설정 선택 버튼은 활성 `primary`·비활성 `primary-outline` 공통 규칙으로 통일
- 마이페이지 전용 `primary` 버튼 override와 별도 선택 버튼 스타일 제거

## [0.1.33] - 2026-05-02

### Changed
- 마이페이지 좌우 영역 간격을 `gap-5`로 조정하고, 좌측 메뉴·우측 콘텐츠 그룹 간격을 `gap-3`으로 통일
- 마이페이지 콘텐츠 래퍼의 불필요한 `p-2` 패딩 제거

## [0.1.32] - 2026-05-02

### Changed
- 마이페이지 사이드바 제목·본문 헤더 영역 제거 및 해당 영역을 숨기던 모바일 전용 CSS 정리

## [0.1.31] - 2026-05-03

### Changed
- 이미 로그인된 상태에서는 로그인·회원가입 창을 열지 않음 — `openAuthWindow` 가드·토스트(`이미 로그인되어 있습니다.`), 세션 확정 시 해당 창 자동 닫기, SNS 오류 콜백은 `isLoggedInRef`로 레이스 방지

## [0.1.30] - 2026-05-03

### Changed
- 마이페이지 프로필 저장 시 코어 토스트(`G7Core.toast` / `toast` 핸들러)로 성공·실패 메시지 표시

## [0.1.29] - 2026-05-03

### Fixed
- 마이페이지 프로필 API를 `/api/user/profile` 대신 **`/api/me`** 로 호출 — `core.profile.read` 권한 없는 일반 회원에서 발생하던 403 방지

## [0.1.28] - 2026-05-03

### Changed
- SNS 가입 직후 별도 “프로필 정보 확인” 창 제거 — `sirsoft-social-auth` exchange가 즉시 토큰 발급
- 마이페이지 「프로필 설정」에 계정 정보(이름·이메일·휴대폰) 섹션 추가 및 `/api/user/profile` GET·PUT 연동

## [0.1.27] - 2026-05-03

### Fixed
- 인증 `fitContent` 창: 스크롤만으로 보이던 현상 완화 — 콘텐츠 높이를 `scrollHeight`·`offsetHeight`·`boundingRect` 중 최대값으로 잡고 여유(px) 확대, 레이아웃 이중 flex·스크롤 래퍼 정리
- 소셜 로그인 영역 등 나중에 높이가 늘어나도 다시 맞추도록 **ResizeObserver 재도입**(코너 리사이즈 드래그 중·수동 높이 잠금 시에는 콜백 무시하여 떨림 방지)

## [0.1.26] - 2026-05-03

### Changed
- 로그인 성공·인증 창 닫기 시 더 이상 `navigate`/`/` 라우팅 호출 안 함(URL·SPA 전환 없이 상태만 반영)

## [0.1.25] - 2026-05-03

### Fixed
- 인증 윈도우 안에서 로그인·회원가입·비밀번호 찾기 전환 시 `navigatePath`를 호출하지 않아 우측 패널과 같이 URL·페이지 갱신 없이 모드만 전환

## [0.1.24] - 2026-05-03

### Changed
- 모든 윈도우 본문 공통 패딩 `py-3` → `pt-3` (인증·마이페이지·플레이스홀더)
- 인증 창 `fitContent` 하단 여백 10px 증량(합계 `BODY_EDGE_BOTTOM` 20px)

### Fixed
- 로그인 등 `fitContent` 창에서 `ResizeObserver`+리사이즈 핸들이 맞물려 발생하던 크기 떨림 제거 — 코너로 창 크기를 조정하면 자동 높이 맞춤을 끊고, 전환 시에만 재측정

## [0.1.23] - 2026-05-03

### Changed
- 마이페이지 윈도우 바깥 여백을 인증 창과 동일(`py-3`, 가로 패딩 없음)
- 일반 앱 플레이스홀더 윈도우 여백을 동일 기준으로 정리

## [0.1.22] - 2026-05-02

### Changed
- 로그인·회원가입 안내 문구 수정

## [0.1.21] - 2026-05-02

### Changed
- 로그인·회원가입 안내 문구 문법·톤 다듬음

## [0.1.20] - 2026-05-02

### Changed
- 인증 `fitContent` 창 하단 여백 20px → 10px
- 로그인·회원가입 설명 문구에서 특정 브랜드명 제거, 일반 안내 멘트로 변경

## [0.1.19] - 2026-05-02

### Changed
- 인증 패널 루트에서 `px-6` 제거(윈도우 본문 여백만 사용). 모아 그룹 카드에서 테일윈드/아이콘 그림자 제거
- `fitContent` 창 크기 계산 시 본문 기준 좌우·하단 20px 여유와 높이 `scrollHeight`·라운딩 여유 적용으로 경미한 세로 스크롤 발생 완화

## [0.1.18] - 2026-05-02

### Changed
- 인증 윈도우 본문 패딩을 `p-6`에서 `py-3 px-6`으로 조정
- PC에서 인증 전용 윈도우는 내용 높이에 맞춰 크기를 잡고 화면 중앙에 배치(`Window` `fitContent`); 모바일(compact)은 기존처럼 전체 화면

## [0.1.17] - 2026-05-02

### Fixed
- 홈 화면 인증 확인을 2초 폴링에서 제거하고, 검증 성공 후에만 로그인 UI로 표시해 세션 만료 시 우측 패널 깜빡임 완화
- `/api/auth/user` 검증 실패 시 무효 `auth_token`을 제거해 만료 세션이 로그아웃 상태로 안정적으로 유지되도록 개선

## [0.1.16] - 2026-05-01

### Added
- SNS 신규 가입자에게 이메일, 이름, 닉네임, 휴대폰을 선택 입력받는 프로필 보완 윈도우 추가
- SNS 프로필 보완 저장 또는 나중에 하기 후 로그인 토큰을 반영하는 흐름 추가

## [0.1.15] - 2026-05-01

### Fixed
- 우측 관리자 모드 버튼 노출 조건을 사용자 인증 응답에 포함되는 관리자 권한 값(is_admin) 기준으로 변경

## [0.1.14] - 2026-05-01

### Added
- 최고 관리자에게 우측 프로필 카드에서 관리자 화면으로 이동하는 관리자 모드 버튼 추가

## [0.1.13] - 2026-05-01

### Fixed
- SNS 로그인 후 AuthManager 상태를 동기화하지 않아 우측 패널이 다시 로그인 프롬프트로 바뀌는 문제 수정
- SNS provider 조회 결과를 프론트에서 캐시하고 비인증 모드 외 중복 조회를 줄이도록 개선

## [0.1.12] - 2026-05-01

### Changed
- SNS 로그인 시작 방식을 데스크톱 팝업 우선, 모바일/차단 시 전체 페이지 이동 fallback 방식으로 변경
- SNS 팝업 완료 메시지를 받아 기존 일회용 코드 교환 API로 로그인 상태를 갱신하도록 연결

## [0.1.11] - 2026-05-01

### Changed
- 우측 로그인 프롬프트의 이메일 인증 영역과 SNS 로그인 영역을 SNS 라벨 구분선으로 분리
- 로그인/회원가입 윈도우의 SNS 구분선 색상을 흰색에서 SNS 라벨 톤으로 통일

## [0.1.10] - 2026-05-01

### Changed
- 중앙 패널 하단 푸터 스크롤 숨김/표시 모션을 모바일뿐 아니라 모든 화면 크기에서 동작하도록 확장

## [0.1.9] - 2026-05-01

### Fixed
- 모바일 하단 푸터를 기존 레이아웃 흐름으로 유지하면서 전환 중 스크롤 보정 이벤트를 무시해 화면 떨림 방지

## [0.1.8] - 2026-05-01

### Fixed
- 모바일 하단 푸터 숨김 전환 시 스크롤 영역 높이 변화로 화면이 떨리는 문제 수정

## [0.1.7] - 2026-05-01

### Changed
- 모바일 앱 그리드 스크롤 방향에 따라 중앙 패널 하단 카피라이트/약관 영역이 접히고 다시 표시되도록 변경

## [0.1.6] - 2026-05-01

### Added
- 로그인 윈도우와 우측 로그인 프롬프트에 이메일 로그인, 비밀번호 찾기, 비밀번호 재설정 API 흐름 연결
- `/forgot-password`, `/reset-password` 딥링크 라우트와 인증 윈도우 초기 모드 추가

## [0.1.5] - 2026-05-01

### Changed
- 우측 로그인 프롬프트와 공용 SNS 로그인 버튼을 sirsoft-social-auth 모듈 provider 설정 및 OAuth redirect 라우트에 연결

## [0.1.4] - 2026-04-30

### Changed
- 관리자 SNS 연결설정에서 활성화된 provider만 로그인/회원가입 윈도우에 표시하도록 변경

## [0.1.3] - 2026-04-30

### Added
- 로그인/회원가입 윈도우에 Google, Kakao, Naver SNS 로그인 버튼 추가
- SNS OAuth callback 일회용 코드 교환 후 토큰 저장 및 로그인 상태 반영 처리 추가

## [0.1.2] - 2026-04-30

### Added
- 로그인/회원가입 URL 진입 시 MOABOM 런처 위에 인증 윈도우를 자동으로 여는 딥링크 동작 추가

### Changed
- 인증 레이아웃을 기존 `_user_base` 상속 화면에서 `HomePage` 초기 윈도우 호출 구조로 변경

## [0.1.1] - 2026-04-27

### Changed
- 마이페이지 버튼을 MOABOM 공통 버튼 라이브러리 스타일로 통일
- 마이페이지 프로필/환경설정/크레딧/앱 보관함/활동/계정 영역에 약한 검은색 그룹 배경 적용
- 우측 패널 프로필 액션 버튼을 공통 버튼 타입으로 정리

## [0.1.0] - 2026-04-18

### Added
- 초기 템플릿 구조 생성
- 기본 베이스 레이아웃 (_user_base.json)
- 홈 레이아웃 (home.json)
- 에러 페이지 레이아웃 (404, 403, 500, 503, maintenance)
- 인증 레이아웃 (login, register)
- 템플릿 단위 테스트 실행용 vitest.config.ts 추가
- LICENSE 파일(MIT) 추가

### Changed
- template.json 컴포넌트 메타데이터를 components.json 기준으로 정합화
- 템플릿 소스의 기존 네이밍/로그 식별자를 moabom-theme로 정리
