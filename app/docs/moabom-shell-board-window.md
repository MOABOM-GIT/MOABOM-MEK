# Moabom 홈 셸 — 게시판 윈도우 + G7 board JSON

> **전략 (C):** React 데스크톱 셸(`HomePage` / `Moa_Window`) + 윈도우 본문은 G7 `board/*.json`을 `DynamicRenderer`로 렌더.  
> **백엔드:** `sirsoft-board` API·관리자 설정 그대로. UI만 JSON 이식 + 셸 브릿지 추가.  
> **G7 참고 SSOT:** [sirsoft-basic layouts — 게시판](frontend/templates/sirsoft-basic/layouts.md), upstream `templates/_bundled/sirsoft-basic/layouts/board/**`

---

## 아키텍처 (팩트)

```
/board/:slug[/:id]  →  routes.json (layout: home)  →  HomePage (React 셸)
                              ↓
                    openBoardWindow(slug, postId?)
                              ↓
                    Moa_Window  →  BoardWindowHost (신규)
                              ↓
              LayoutLoader.loadLayout('board/index' | 'board/show')
                              ↓
              DynamicRenderer (extends _user_base 없는 content JSON)
                              ↓
              /api/modules/sirsoft-board/boards/{slug}/posts ...
```

| 계층 | 기술 | 비고 |
|------|------|------|
| 셸 | React | 윈도우·태스크바·URL·좌우 패널 |
| 게시판 UI | G7 JSON | sirsoft-basic에서 이식·moabom 스타일 보정 |
| API | sirsoft-board | 관리자 환경설정·권한은 서버·API 응답으로 반영 |

**하지 않는 것:** 홈 셸 JSON 전환, 게시판 React 통재작성(D), `_user_base`에 게시판 슬롯 끼우기.

---

## 기존 인프라 (재사용)

| 있음 | 경로 |
|------|------|
| 윈도우·URL 패턴 | `openLegalPage`, `moabomShellRoutes.ts`, `Moa_ShellWindowRenderer.tsx` |
| API·토큰 | `moabomShellHttp.ts`, `moabomShellAccess.ts` |
| G7 렌더 | `G7Core.getDynamicRenderer()`, `TemplateApp.getLayoutLoader()` |
| 레이아웃 선로드 훅 | `__g7BeforeLayoutLoad` (`sirsoftEcommerceLayoutPrefetch.ts`) — board form/CKEditor 휴리스틱만 |
| Ghost routes | `moabomGhostRoutesFetch.ts` |
| board 레이아웃 테스트 | `src/__tests__/layouts/board-*.test.tsx` (JSON 이식 후 사용) |

| 없음 (구현 대상) |
|------------------|
| 운영 E2E — 글쓰기·댓글 (배포 후 수동) |

| 좌측 패널 공지 (추가) |
|----------------------|
| `NOTICE_DATA` → `openBoardWindow('notice')` — `Moa_LeftPanel` · `moaShellNoticeBoard.ts` |

---

## 페이즈 체크리스트

### Phase 0 — 셸 누수 차단 · 라우트 · URL 파싱

- [x] `errors/*.json` — `extends: _user_base` 제거 (단독 에러 UI)
- [x] `routes.json` — `/board/:slug`, `/board/:slug/:id` → `layout: home`
- [x] `moabomShellRoutes.ts` — `kind: 'board'` (`slug`, `postId?`)
- [x] `HomePage.applyShellRoute` — board URL 시 윈도우 열기 (Phase 1)

**완료 기준:** `/board/notice` 접속 시 HomePage 로드, `_user_base` 플레이스홀더 미노출.

### Phase 1 — 윈도우 껍데기 (JSON 없이)

- [x] `WindowState` — `boardSlug`, `postId?` (또는 가상 `appId` 규약)
- [x] `openBoardWindow(slug, postId?)` — `openLegalPage` 패턴
- [x] `Moa_ShellWindowRenderer` — placeholder → 이후 Host
- [x] `applyShellRoute` / `popstate` / `MobileNav` 연동 (`routeChange`)
- [x] `formatShellPathForWindow` board 분기

**완료 기준:** notice URL·뒤로가기·태스크바·닫기 동작.

### Phase 2 — `BoardWindowHost`

- [x] `BoardWindowHost.tsx` — `loadLayout` + `DynamicRenderer` + `route`/`query` 주입
- [x] 레이아웃 선택: 목록 `board/index`, 상세 `board/show` (window 전용 이름 가능)
- [x] 윈도우 타이틀 API `board.name` / `post.title` 갱신

**완료 기준:** 윈도우 안 G7 목록 JSON + `posts` data_source 동작.

### Phase 3 — G7 JSON 이식 (읽기)

- [x] upstream `sirsoft-basic/layouts/board/**` + `partials/board/**` 복사
- [x] `extends: _user_base` 제거, content/slots만 유지 (`components` + Toast)
- [x] moabom className·CSS 보정 (`moa-home/31-board-window.css` — 윈도우 호스트 스코프)
- [x] `board-*` vitest 레이아웃 테스트 (JSON 이식·401 errorHandling — 로컬 실행은 배포 전 Cloud Build 경로)

**완료 기준:** `notice` 목록·상세·basic 타입·페이지네이션.

> **운영 주의:** G7 레이아웃 API는 DB `template_layouts` 를 서빙한다. `layouts/board/**` 파일만 추가하고 **`moabom:saas:sync-template-layouts --template=moabom-basic`** 를 돌리지 않으면 `Failed to fetch layout: 404` 가 난다. 배포 후 `run-layout-sync-job.sh` 가 `moabom-basic` 도 동기화한다 (v247+).

### Phase 4 — navigate 브릿지

- [x] 윈도우 스코프에서 JSON `navigate` → `openBoardWindow` / URL `pushShellPath`
- [x] `/login` → `openAuthWindow`
- [x] `replace: true`·쿼리(page, category) 유지 (`mergeQuery`·`updateQueryParams` 가로채기)

**완료 기준:** 목록↔상세가 윈도우 안에서 완결.

### Phase 5 — 권한·에러·IDV

- [x] data_source `errorHandling` 401/403/404 (toast·auth·hasError)
- [x] 428 본인인증 — `boardWindowLayoutRuntime` `boardApiGet` → `G7Core.dispatch(ensureIdentityVerified)` 후 재시도
- [x] `__g7BeforeLayoutLoad` — `board/*` 읽기 시 `sirsoft-board` 선로딩

### Phase 6 — 확장 (읽기 안정 후)

- [x] `board/form.json` 윈도우 전용 변환 (`components` + Toast)
- [x] `BoardWindowHost` — `/write`·`/edit` URL 시 `board/form` 로드
- [x] gallery/card·커스텀 타입 partial 스타일 보정 (윈도우 호스트 `@container` 그리드)
- [x] `$t:board.*` — `lang/partial/{ko,en}/board.json` (G7 sirsoft-basic 이식) + `boardWindowLayoutRuntime` 번역 preload
- [x] 스크롤 — `moa-app-window-viewport` 단일 책임 (`BoardWindowHost` 중첩 `overflow-y-auto` 제거)
- [x] 폭 100% — `31-board-window.css` 에서 `max-w-*`·`mx-auto` 오버라이드
- [x] 글쓰기 폼 — `initLocal`/`init_actions`/`_localInit` (`form_data` → `_local.form`, `tempKey`)
- [ ] 글쓰기·댓글 E2E 검증 (운영 배포 후)

> **본문 에디터:** `extension_point: html_editor` 는 레이아웃 API가 CKEditor5로 주입한다. `sirsoft-ckeditor5` dist 는 Cloud Build/Dockerfile SSOT(관리자와 동일). 셸은 `__g7BeforeLayoutLoad` 로 `board/*` 진입 시 플러그인·모듈 선로딩.

---

## 주요 파일 (편집 예상)

| 파일 | 페이즈 |
|------|--------|
| `templates/moabom-basic/routes.json` | 0 |
| `templates/moabom-basic/layouts/errors/*.json` | 0 |
| `src/utils/moabomShellRoutes.ts` | 0–1 |
| `src/pages/Moa_HomePage.tsx` | 1–4 |
| `src/components/composite/Moa_CenterPanel.tsx` (`WindowState`) | 1 |
| `src/pages/home/Moa_ShellWindowRenderer.tsx` | 1–2 |
| `src/components/composite/Moa_BoardWindowHost.tsx` (신규) | 2 |
| `layouts/board/**` (신규) | 3 |
| `src/runtime/sirsoftEcommerceLayoutPrefetch.ts` | 5 |
| `src/shell/moaShellBoardIds.ts` (신규, 가상 appId) | 1 |
| `src/shell/moaShellBoardNavigate.ts` · `installMoaShellBoardNavigateBridge.ts` | 4 |
| `src/shell/boardWindowLayoutRuntime.ts` | 2–5 |

**렌더 주의:** `moabom-basic` `components.json` 에 `Fragment` 없음 — 윈도우 호스트는 G7 `TemplateApp` 과 같이 `layout.components` 를 **각각** `DynamicRenderer` 로 렌더한다. `Fragment` 루트 래핑 시 `getComponent('Fragment')` → null → 빈 DOM.
| `src/shell/moaShellNoticeBoard.ts` · `src/data/Moa_mockData.ts` · `Moa_LeftPanel.tsx` | 좌측 공지 연동 |

---

## G7 코어 수정 여부

**수정하지 않음.** `app/app`, `app/resources/js/core`, 코어 `routes/`·`config/`·`migrations/`·`tests/` 는 건드리지 않는다.  
게시판 윈도우는 **G7 런타임 API만 소비**한다: `G7Core.getDynamicRenderer()`, `__templateApp.getLayoutLoader()`, `G7Core.dispatch`, `G7Core.api`.

---

## 관련 문서

- [sirsoft-basic layouts — 게시판](frontend/templates/sirsoft-basic/layouts.md)
- [layout-json.md](frontend/layout-json.md) · [layout-testing.md](frontend/layout-testing.md)
- [actions-handlers-navigation.md](frontend/actions-handlers-navigation.md) (`navigate`, `fallback`)
- [identity-guard-interceptor.md](frontend/identity-guard-interceptor.md)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-18 | i18n·스크롤·폭·글쓰기 initLocal/CKEditor 선로드 보정 |
| 2026-06-18 | 좌측 패널 공지·업데이트 → notice 게시판 윈도우, 428 IDV·board CSS 보정 |
| 2026-06-18 | Phase 4–5 반영 (navigate 브릿지·에러 처리·sirsoft-board 선로딩) |
| 2026-06-18 | Phase 1–3 반영 (윈도우 셸·BoardWindowHost·board JSON 이식) |
