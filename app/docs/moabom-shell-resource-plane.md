# Moabom Shell HTTP · Auth · Resource Plane

> **상위:** [`moabom-shell-realtime-architecture.md`](./moabom-shell-realtime-architecture.md)  
> **원칙:** 증상 패치 금지. 모듈 API·Auth·리소스 캐시는 단일 SSOT. 전역 폴링·피드백 루프 금지.

## 1. ShellHttpPlane

| 경로 | 클라이언트 | 비고 |
|------|------------|------|
| `/api/modules/*` | `moabomShellHttp` / `createShellModuleApi` | G7 Axios onUnauthorized 우회 |
| `/api/me`, password, avatar | `moabomAuthenticatedApi` (세션) | `kind: unauthorized \| transient` |
| `/api/user/notifications*` | `requestShellJson` | 코어 경로·셸 fetch |

**금지:** 모듈 URL을 `moabomApiGet/Put` 로 호출.

**401:** `clearShellAccessToken` + `moabom:shell-auth-expired` → `applyAuthState(false, null)` 한 경로만.

## 2. ShellAuthPlane

- 유일 소유자: `useMoabomShellAuth.applyAuthState`
- `handleShellProfileUpdated(null)` → no-op (부분 갱신 실패 시 세션 유지)
- MyPage guest UI: `isLoggedIn` prop (currentUser null만으로 게스트 판정 금지)
- LeftPanel: `isLoggedIn` prop (토큰 단독 판정 금지)

## 3. ResourceStorePlane

### ActivityLevel (`useMoabomActivityLevel`)

- fetch 성공 후 리스너에 **값 push**만. 리스너 force refetch 금지.
- `invalidate` = cache clear + coalesced load 1회 + 값 push.
- 출석 후 `invalidate` 단일 진입 (`credit-changed` 이중 트리거 금지).

### Notifications

- unread: 로그인 1회 + WS/bridge.
- list: 알람 탭 활성 시에만. list 로드 시 unread 재조회 금지.

### Presence / Chat

- heartbeat·탭 목록: surface active 시에만. WS 끊김 safety 폴링만 예외.
- 채팅 private 채널: **활성 대화만** 구독. 인박스는 notification 채널.

## 4. BootPlane

- `shell-boot` + auth preload **병렬**.
- `catalog-critical` 비차단 통과 — library prefetch 백그라운드.
- 앱 오픈은 `awaitMoabomGeneratedAppLibraryPrefetch` 합류.

## 5. 검증 가드

`deploy/check-moabom-refactor-invariants.sh` — mypage 모듈 API · ActivityLevel 루프 패턴.
