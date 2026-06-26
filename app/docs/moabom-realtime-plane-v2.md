# Moabom Realtime Plane v2 — 전면 리팩토링 SSOT

> **상위 문서:** [`moabom-shell-realtime-architecture.md`](./moabom-shell-realtime-architecture.md)  
> **원칙:** 증상 패치 금지. **단일 자격증명·단일 이벤트 버스·단일 visitor SSOT·명시적 mirror 실패**.

---

## 1. 반복 실패의 구조적 원인 (3차 리팩토링까지)

| 증상 | 근본 원인 | 기존 접근의 한계 |
|------|-----------|------------------|
| `wss://…/app/moabom-laravel-key` 연결 실패 | **Reverb 자격증명 이원화** — `reverb:start` 는 env만, HTTP 는 DB drivers hydrate. secret 불일치·빈 secret | nginx `if` 로 WS/HTTP 분기만 수정 |
| 플랫폼 0명 \| 현재 N명 | **mirror_ok = DB 연결 성공** 으로만 판정. upsert 실패는 heartbeat try/catch 에만 기록 | tenant dedupe·visitor_id 만 반복 |
| 방문자 중복 | session_key·visitor_id 레거시 행 공존 | API dedupe만 추가, DB 정리 미흡 |
| 접속자 갱신 불안정 | WS 실패 시 revision 이벤트 미도달 → 폴링만 의존 | 채널 추가만, WS 기반 미해결 |

---

## 2. 목표 아키텍처 (3 Plane + 1 Bus)

```
┌──────────────────────────────────────────────────────────────┐
│  Shell UI — RightPanel · ShellRealtimeStore (단일 구독)        │
└────────────────────────────┬─────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ Visitor Plane   │ │ Tenant Presence │ │ Realtime Bus        │
│ visitor_id SSOT │ │ tenant DB       │ │ Reverb (revision)   │
│ 1 browser=1 row │ │ authoritative   │ │ + notification      │
└────────┬────────┘ └────────┬────────┘ └──────────┬──────────┘
         │                     │ mirror (explicit)    │
         │                     ▼                      │
         │            ┌─────────────────┐             │
         └───────────►│ Platform Mirror │◄────────────┘
                      │ platform DB     │
                      │ health cache    │
                      └─────────────────┘
```

### 2.1 Reverb Credential Plane (R0 — 완료)

| 규칙 | 내용 |
|------|------|
| SSOT | `REVERB_APP_*` env + Secret Manager `REVERB_APP_SECRET` |
| 부트 | `ReverbCredentialSync::bootstrap()` — **모든** PHP 프로세스(reverb 포함) |
| hydrate | `WebsocketDriverConfigApplier` — DB secret 빈 값·불일치 시 env 로 보정 |
| nginx | `/app/moabom-laravel-key` 만 Reverb 프록시. `/app/{shell-app}` 는 Laravel |

### 2.2 Platform Mirror Plane (R1 — 완료)

| 규칙 | 내용 |
|------|------|
| 쓰기 | `PresencePlatformMirrorService::mirrorHeartbeat()` 단일 진입 |
| 실패 | cache `mirror-ok:{slug}` = false + structured log |
| summary | `mirror_degraded` = tenant_active > 0 && !mirrorHealthy |
| healthy | 최근 heartbeat mirror 성공 **또는** platform_tenant_active > 0 |
| 충돌 | platform upsert 전 `session_key` 레거시 행 제거 |

### 2.3 Realtime Event Bus (R2 — 진행)

| 채널 | 타입 | 이벤트 | 소비 |
|------|------|--------|------|
| `module.moabom-presence.tenant.{slug}.revision` | public | `presence.revision` | `ShellRealtimeStore` → debounced refetch |
| `private-user.{uuid}` | private | `notification.received` | 알림 패널 |

**금지:** here/joining/leaving, 낙관적 접속자 행, 이중 폴링+WS 혼합

### 2.4 Visitor Plane (R3 — 부분 완료)

- `visitor_id` unique upsert (tenant·platform)
- heartbeat 시 legacy session_key·fallback `session:{id}` 정리
- 프론트 `normalizePresenceConnectList` 최종 방어

---

## 3. 구현 로드맵

| Phase | 내용 | 상태 | 완료 기준 |
|-------|------|------|-----------|
| **R0** | ReverbCredentialSync + nginx `/app/{key}` 분리 | ✅ | WS handshake 성공, 콘솔 연결 오류 없음 |
| **R1** | PresencePlatformMirrorService + summary health | ✅ | mirror_degraded 시 플랫폼 `—` 표시 |
| **R2** | WS 연결 후 revision 구독 E2E | 🔄 | heartbeat → revision → 1회 refetch |
| **R3** | visitors 테이블로 sessions 대체 | ⏳ | P6 migration |
| **R4** | ShellSurfaceController 흡수 완료 | ⏳ | P1–P5 |
| **R5** | platform_total UI — 글로벌 vs 테넌트 분리 표기 | ⏳ | `platform_tenant_active` 노출 |

---

## 4. 검증

```bash
bash scripts/check-extension-autoload.sh
bash deploy/check-before-cloud-build.sh
# 배포 후
bash deploy/smoke-after-deploy.sh https://mek360.com
```

**수동**
1. DevTools Network — `wss://…/app/moabom-laravel-key` **101 Switching Protocols**
2. heartbeat 후 `presence.revision` 수신 (WS Messages)
3. summary — `mirror_ok: true`, `platform_tenant_active` ≥ 1 (접속 중일 때)
4. 접속자 — guest 1행 + IP 마스킹

---

## 5. 관련 파일

| 영역 | 파일 |
|------|------|
| Reverb SSOT | `plugins/moabom-reverb/src/ReverbCredentialSync.php` |
| nginx WS | `deploy/nginx-cloudrun.conf` |
| Platform mirror | `modules/moabom-presence/src/Services/PresencePlatformMirrorService.php` |
| Summary | `modules/moabom-presence/src/Services/PresenceSummaryService.php` |
| 프론트 realtime | `templates/moabom-basic/src/shell/ShellRealtimeStore.ts` |

---

*문서 버전: 2026-06-24 · Realtime Plane v2*
