# Moabom 런타임 계약 (Identity / DataGate / AuthBoot)

증상 패치 금지. 아래 계약만 SSOT로 수정한다. 배포는 Cloud Build/Cloud Run.

## DataGate (관리자 layout blur)

| 규칙 | 내용 |
|------|------|
| 엔진 | `TemplateApp` progressiveDataInit에 `type:websocket` · `auto_fetch:false` 키를 넣지 않는다 |
| Moabom | `_admin_base` `notifications` 는 `auto_fetch:false` 유지 (드롭다운 오픈 시 fetch) |
| 코어 패치 | 엔진 변경은 `deploy/core-patches/moabom-core.patch` 로 `core:update` 후에도 재적용 |
| Cloud Build | `npm run build:core` **실패 시 이미지 빌드 실패** (구 min.js 폴백 금지, RF-29) |
| 레이아웃 | 리스트 그리드는 `{ enabled, data_sources }` 스코프. blur CSS 직접 제거 금지 |
| layout-sync | 코어-only 변경 시 manifest unchanged skip은 **정상**. layout JSON 변경 시에만 DB sync |

문서: `app/docs/frontend/layout-json-components-loading.md` (deferred fetch 절).

## Identity (Presence)

| 규칙 | 내용 |
|------|------|
| SSOT | DB heartbeat + `visitor_id` 1행 (Reverb는 revision 신호만) |
| 승격 | `touch=login` 은 Sanctum user 필수. guest shadow purge는 인증 후 |
| 정리 | 인증 heartbeat 마다 동일 visitor_id·동일 마스크 IP guest shadow 삭제 (주기 폴링/채널 추가 금지) |
| 목록 | 인증 조회자는 요청 마스크 IP 와 같은 guest 행을 숨김 (본인 shadow — 전역 캐시 없음) |
| 집계 | summary `tenant_active` = 목록과 동일 `PresenceConnectListNormalizer::dedupe` |
| 클라 | login/logout heartbeat 후 `refreshConnectList: true` (+ login 시 summary 재조회) |

모듈: `app/modules/moabom-presence`.

## AuthBoot (셸 새로고침)

| 규칙 | 내용 |
|------|------|
| Optimistic | `auth_token` 있으면 UI logged-in 유지 후 백그라운드 validate |
| Clear | 확정 HTTP 401 만 `clearShellAccessToken` |
| Presence | Bearer는 토큰 유무 기준. `touch=login`은 로그인 전환 후 1회 |

파일: `useMoabomShellAuth.ts`, `moabomShellAuthPreload.ts`.
