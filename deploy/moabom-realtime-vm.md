# Moabom Realtime VM — SSOT (`moabom-realtime-prod`)

> **상위:** [`app/docs/moabom-realtime-plane-v3.md`](../app/docs/moabom-realtime-plane-v3.md)  
> **설치 산출물:** [`deploy/realtime-vm/`](./realtime-vm/)  
> **제약:** Cloud Run 플래그·인스턴스 수 변경 금지. G7/Moabom 앱 전체는 VM에 설치하지 않음.

---

## 1. 목표 (오늘 세션 합의)

| 목표 | 내용 |
|------|------|
| **비용** | Cloud Run Request-based CPU 스로틀 유지. Reverb sidecar 부담·WS idle 지연을 VM으로 분리 |
| **안정성** | 전용 VM에서 Reverb + Redis 상시 구동. 브라우저 WS 끊김·다중 인스턴스 간 이벤트 유실 완화 |
| **범위** | VM에는 **Reverb + Redis + nginx(TLS)** 만. Laravel·MySQL·G7 코어 없음 |
| **유지** | Moabom API·SaaS·DB는 기존 Cloud Run(`smartmek` / `mek360.com`) 그대로 |
| **안전망** | v3 REST catch-up(인박스·알림·presence revision) **유지** — WS 단독 의존 금지 |

### 해결하려는 구조적 문제

1. **Cloud Run sidecar Reverb** — `127.0.0.1:6001`이 컨테이너마다 독립. session-affinity 있어도 인스턴스 간 WS·publish 불일치 가능
2. **Request-based CPU** — idle 시 Reverb 프로세스 지연 → WS 이벤트 지연 → 폴링 의존 증가
3. **Redis 필요** — Reverb scaling 채널 + 향후 다중 프로세스 대비 (단일 VM에서도 `REVERB_SCALING_ENABLED=true`)

---

## 2. VM 인프라 (팩트)

| 항목 | 값 |
|------|-----|
| GCP 프로젝트 | `smartmek` |
| 인스턴스명 | `moabom-realtime-prod` |
| 존 | `asia-northeast3-c` |
| 머신 | `e2-micro` (2 vCPU burst, ~1GB RAM) |
| 내부 IP | `10.178.0.4` |
| **고정 공인 IP** | **`34.50.62.24`** |
| OS | Debian 13 (trixie) |
| SSH | `moabom@34.50.62.24` · 키 `moabom-g7` · WSL Host `moabom-realtime-prod` |

---

## 3. 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│  브라우저 (moabom-basic Shell)                                           │
│  wss://realtime.mek360.com/app/moabom-laravel-key                             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ TLS :443
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VM moabom-realtime-prod (34.50.62.24)                                  │
│  nginx ──► Reverb :6001 (127.0.0.1, Docker)                             │
│  Redis :6379 (Docker, localhost only)                                   │
└───────────────────────────────▲─────────────────────────────────────────┘
                                │ HTTPS publish (Pusher HTTP API /apps/…)
┌───────────────────────────────┴─────────────────────────────────────────┐
│  Cloud Run mobaom-container (asia-northeast3) — 변경 없음               │
│  Laravel broadcast → websocket_server_* (VM endpoint)                   │
│  Reverb sidecar supervisord — **비활성화 완료** (Run 플래그 무변경)        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 드라이버 이원화 (moabom-reverb SSOT)

| 축 | 설정 키 | 컷오버 후 값 (예) |
|----|---------|-------------------|
| **클라이언트** (브라우저 Echo) | `websocket_host` | `realtime.mek360.com` |
| | `websocket_port` | `443` |
| | `websocket_scheme` | `https` |
| **서버** (Laravel→Reverb publish) | `websocket_server_host` | `realtime.mek360.com` 또는 `34.50.62.24` |
| | `websocket_server_port` | `443` (nginx 경유) 또는 `6001` |
| | `websocket_server_scheme` | `https` 또는 `http` |
| **자격증명** (양쪽 동일 필수) | `websocket_app_id/key/secret` | `moabom-laravel` / `moabom-laravel-key` / Secret Manager |

코드 SSOT: `plugins/moabom-reverb/src/WebsocketDriverConfigApplier.php`, `ReverbCredentialSync.php`

### 3.2 이벤트 버스 (v3 — VM 분리 후에도 동일)

| 채널 | 이벤트 | 발행 주체 |
|------|--------|-----------|
| `module.moabom-presence.tenant.{slug}.revision` | `presence.revision` | Cloud Run `PresenceRevisionService` |
| `core.user.notifications.{uuid}` | `notification.received` | G7 알림 |
| `core.user.notifications.{uuid}` | `chat.inbox.updated` | `moabom-chat` |
| `module.moabom-chat.tenant.{id}.conversation.{uuid}` | `message.*` | `moabom-chat` |

VM은 **전달만** 담당. 비즈니스 로직·DB는 Cloud Run.

---

## 4. 네트워크·방화벽

| 포트 | 대상 | 노출 |
|------|------|------|
| 22 | SSH | 관리자 IP 제한 권장 |
| 443 | nginx → Reverb WS + `/apps/` HTTP API | `0.0.0.0/0` |
| 6001 | Reverb | **127.0.0.1 only** (nginx 경유) |
| 6379 | Redis | **Docker internal only** |

DNS (운영 컷오버 전 필수):

```
realtime.mek360.com.  A  34.50.62.24
```

---

## 5. 설치·운영

```bash
# WSL — VM 최초 설치 (root)
ssh moabom-realtime-prod
sudo bash /opt/moabom-realtime/install-on-vm.sh

# 상태 확인
docker compose -f /opt/moabom-realtime/docker-compose.yml ps
curl -sI https://realtime.mek360.com/app/moabom-laravel-key
```

Secret: VM 설치 스크립트가 `gcloud secrets versions access` 로 `moabom-reverb-app-secret` 주입 (동일 프로젝트 `smartmek`).

---

## 6. Cloud Run 컷오버 체크리스트 (배포는 사용자 명시 시)

VM WS handshake 성공 후:

1. [ ] `realtime.mek360.com` DNS + TLS 정상
2. [ ] `deploy/smoke-after-deploy.sh` Reverb probe (또는 VM 직접 curl)
3. [ ] SaaS platform + tenant `drivers.websocket_*` — `websocket_host=realtime.mek360.com`, `websocket_server_host=realtime.mek360.com`, `websocket_server_port=443`, `websocket_server_scheme=https`
4. [ ] `deploy/production.env.yaml` — `REVERB_HOST=realtime.mek360.com`, `REVERB_SERVER_HOST=realtime.mek360.com`, `REVERB_SERVER_PORT=443`, `REVERB_SERVER_SCHEME=https`
5. [ ] `_IMAGE_TAG` 증가 → `check-before-cloud-build.sh` → `build-and-deploy.sh`
6. [ ] E2E: 친구요청·채팅·알림·presence revision
7. [x] Cloud Run sidecar Reverb 중지 — `deploy/supervisord.conf` 에서 `reverb:start` 제거, `nginx-cloudrun.conf` 로컬 Reverb 프록시 제거

---

## 6-1. 운영 health / 단일 장애점 관리

현재 Realtime plane 은 `moabom-realtime-prod` 단일 VM 이 SSOT 입니다. Cloud Run 내부 sidecar 는 제거했으므로, VM 장애 시 브라우저는 REST catch-up 으로 degrade 하지만 WebSocket 실시간성은 중단됩니다.

상시 확인:

```bash
bash deploy/check-realtime-vm-health.sh
MOABOM_REALTIME_VM_SSH=1 bash deploy/check-realtime-vm-health.sh
```

장애 시 1차 확인:

```bash
ssh moabom-realtime-prod
systemctl status nginx --no-pager
sudo docker compose -f /opt/moabom-realtime/docker-compose.yml ps
sudo docker compose -f /opt/moabom-realtime/docker-compose.yml logs --tail=120 reverb
sudo docker compose -f /opt/moabom-realtime/docker-compose.yml logs --tail=120 redis
```

복구 우선순위:

1. nginx TLS/프록시 정상화
2. Reverb 컨테이너 재기동
3. Redis health 확인
4. `deploy/check-realtime-vm-health.sh` 통과 확인

다중 VM/Managed Redis 전환은 별도 인프라 작업입니다. 그 전까지는 Cloud Run smoke 와 위 health 스크립트로 VM 경로를 배포 전후 확인합니다.

---

## 7. 오늘 완료된 앱 코드 (v363, VM과 독립)

| 영역 | 내용 |
|------|------|
| `moabom-presence` 0.1.24 | friendship revision bump, `friend_accepted` 알림 |
| `moabom-chat` 0.2.1 | `member.left` broadcast, `is_writable` |
| `moabom-basic` | ShellRealtimeStore, chat peer_left UI, 60s safety poll |
| 배포 | `v363` smoke 통과 |

---

*문서 버전: 2026-06-27 · Realtime VM SSOT*
