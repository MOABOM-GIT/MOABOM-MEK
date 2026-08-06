# Moabom VM Standalone 병행 구축 계획 — SSOT

> **작성:** 2026-07-28 (Cursor 채팅 합의 반영)
> **대상 독자:** 프로젝트 오너(수동 작업) · Cursor 에이전트(구현)
> **성격:** **복사·병행 구축 (greenfield POC)** — 운영 **이전·컷오버·대체가 아님**
> **범위:** 새 GCP 계정 · VM 1대 · `moabom.com` · 와일드카드 SaaS · Run/Tasks/LB 미사용
> **비범위:** `smartmek` / `mek360.com` Cloud Run **중단·DNS 변경·데이터 이관** (명시적 결정 전까지 금지)

### 운영 vs 병행 환경 (필독)

| | 운영 (그대로 유지) | 병행 VM (새로 만듦) |
|---|-------------------|---------------------|
| GCP | `smartmek` (기존 계정) | **신규 계정·프로젝트** |
| 도메인 | `mek360.com` | `moabom.com` |
| 런타임 | Cloud Run + queue Run + realtime VM + Cloud SQL | VM 1대 통합 |
| 데이터 | 운영 DB·GCS | **별도** (빈 설치 또는 선택적 덤프 복사) |
| 배포 | `build-and-deploy.sh` | `deploy/vm-standalone/` |
| 목적 | **현재 서비스 계속** | VM-only 아키텍처 **검증** |

**이 문서의 Phase를 완료해도 운영 Cloud Run은 자동으로 꺼지지 않는다.**
두 환경은 **동시에 살아 있어도 된다.** 나중에 운영을 VM으로 옮길지는 **별도 의사결정** (본 문서 Phase 12 — 기본 **하지 않음**).

---

## 0. 오늘 확정된 결정 (Decision Log)

| # | 결정 | 비고 |
|---|------|------|
| D1 | **새 Google Cloud 계정(프로젝트)** 에 VM 1대 | 운영 `smartmek`와 격리 |
| D2 | **GCS 버킷 1개** | `tenants/{slug}/` prefix 로 테넌트 분리 (현행과 동일 패턴) |
| D3 | **MySQL + Laravel + queue + scheduler + Reverb + Redis** 를 VM 한 곳에 통합 | **신규 VM 스택**에만 적용 (운영 Run/SQL/realtime VM은 유지) |
| D4 | **와일드카드 멀티테넌트** 유지 | `{slug}.moabom.com` Host → DB/GCS 전환 (`ResolveMoabomTenant`) |
| D5 | **도메인 `moabom.com`** | `base_domain`·`platform_hosts`·소셜 콜백·TLS 재설계 |
| D6 | **Cloud Run 우회 코드 단순화** | queue plane·Run ingress·`*.run.app` Host 분기 등 제거 (VM 브랜치) |
| D7 | **인프라 찌꺼기 버리고 깨끗이 시작** | upstream G7만으로 재개발 ❌ · Moabom 확장을 **단계적으로 활성화** ✅ |
| D8 | **HTTP(S) Load Balancer 없이** VM 고정 IP + nginx (realtime VM과 동일 패턴) | 와일드카드 TLS는 DNS challenge |
| D9 | **운영 Cloud Run 계속** | `mek360.com` / `smartmek` **이동·중단 없음** — VM은 병행 복제 개념 |
| D10 | **데이터는 기본 분리** | 운영 DB/GCS를 VM으로 **옮기지 않음** (필요 시 테넌트 1개 덤프만 선택) |

### D7 해석 (중요 — Cursor 필독)

| 버림 | 유지 |
|------|------|
| `mobaom-queue`, Cloud Tasks, `MOABOM_QUEUE_PLANE_*` | `app/modules/moabom-*` |
| `deploy/deploy-cloud-tasks-queue-service.sh` 등 Run 전용 스크립트 | `app/templates/moabom-basic`, `moabom-admin_basic` |
| `TenantRequestHost` 의 `*.run.app` / LB forwarded 우회 (VM 브랜치에서 단순화) | `app/plugins/moabom-*`, `app/lang-packs/` |
| Cloud SQL socket, Run entrypoint, 이중 supervisord | SaaS: `TenantRuntimeBootstrap`, `TenantRegistry`, platform DB |
| 별도 realtime VM (`moabom-realtime-prod`) | G7 **필수** `deploy/core-patches/` (GCS early boot 등 — VM에서도 검증) |
| Cloud Build 이미지 기반 배포 (VM 경로는 git pull + 빌드 스크립트로 대체) | `ShouldBroadcastNow` 실시간 경로 (v3 SSOT) |

**순정 upstream G7만 설치하고 Moabom을 처음부터 다시 짜지 않는다.**
MOABOM-MEK 저장소에서 **활성 확장 + 최소 core overlay** 를 가져가고, **배포·런타임만** VM SSOT로 새로 만든다.

---

## 1. 배경 — 왜 VM인가 (채팅 요약)

### 1.1 Cloud Run에서 겪은 구조적 불일치

G7/Laravel은 전통적으로 **상시 프로세스** 전제다.

- `queue:work` (훅 리스너·알림·활동로그·크레딧 등)
- `schedule:run` (이커머스 배치·사이트맵·대시보드 등)
- Reverb (WebSocket)

Cloud Run SSOT는 **`min-instances=0` + request-based CPU** 이다.

| 문제 | 증상 |
|------|------|
| 웹 컨테이너 내장 `queue:work` | idle·스케일 0 시 job 적체 |
| Reverb sidecar | 인스턴스별 독립 WS → 이벤트 불일치 → **별도 realtime VM** 으로 분리됨 |
| queue plane (`mobaom-queue` + Cloud Tasks) | Run `min=0` 에 맞춘 HTTP wake — 복잡도 증가 |
| LB + `X-Forwarded-Host` | 와일드카드 SaaS + RF-26 스푸핑 방어 |

### 1.2 VM 통합으로 기대하는 개선

| 영역 | 현행 (하이브리드) | VM 통합 후 |
|------|-------------------|------------|
| Laravel → Reverb publish | HTTPS → 외부 realtime VM | **127.0.0.1:6001** (루프백, TLS 없음) |
| MySQL | Cloud SQL socket | **localhost** (지연·연결 단순화) |
| 큐 | DB job + Cloud Tasks wake + queue Run | **supervisor `queue:work` 상시** |
| 스케줄러 | Cloud Scheduler → queue Run → `schedule:run` | **VM cron** 매분 |
| WS | 브라우저 → realtime VM, API → Run | **동일 VM nginx** (단일 Reverb + Redis) |
| 멀티테넌트 Host | LB → Run → forwarded | **클라이언트 Host 직접** (`*.moabom.com`) |
| 인프라 조각 | Run + queue Run + realtime VM + SQL + LB + Tasks | **VM + 버킷 1개** (+ 선택 Secret Manager) |

실시간: v3 **REST catch-up 안전망** 은 유지 (WS 단독 의존 금지 — `app/docs/moabom-realtime-plane-v3.md`).

---

## 2. 목표 아키텍처

```
                         Internet
                            │
                     DNS *.moabom.com
                     moabom.com / www
                     realtime.moabom.com
                     auth.moabom.com
                     *.apps.moabom.com (생성앱, Phase 8+)
                            │
                            ▼
              ┌─────────────────────────────────────┐
              │  GCP Compute Engine (신규 계정)      │
              │  moabom-app-prod (고정 공인 IP)        │
              │                                     │
              │  nginx :443 (와일드카드 TLS)           │
              │    ├─ PHP-FPM → Laravel (G7+Moabom) │
              │    ├─ /app/* → Reverb WS (127.0.0.1)│
              │    └─ 정적 / dist (빌드 산출물)        │
              │                                     │
              │  supervisor:                        │
              │    queue:work (database)            │
              │    reverb:start (또는 compose)       │
              │  cron: * * * * schedule:run         │
              │                                     │
              │  Docker (내부):                       │
              │    MySQL 8 (platform + tenant DBs)  │
              │    Redis 7 (Reverb scaling)         │
              │    Reverb (선택: compose 또는 bare)  │
              └──────────────┬──────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │  GCS 버킷 1개 (신규 계정)     │
              │  tenants/{slug}/attachments/… │
              └─────────────────────────────┘

사용하지 않음: Cloud Run · Cloud SQL · Cloud Tasks ·
              HTTP(S) LB · mobaom-queue · realtime 전용 VM
```

### 2.1 호스트·도메인 SSOT (`moabom.com`)

| 호스트 | 역할 | `TenantHostParser` |
|--------|------|---------------------|
| `moabom.com`, `www.moabom.com` | 플랫폼 | `platform` |
| `auth.moabom.com` | 소셜 OAuth broker | `platform` (`platform_hosts`에 등록) |
| `apps.moabom.com` | 생성앱 허브 (표준) | `platform` 또는 apps 라우팅 |
| `{slug}.moabom.com` | 테넌트 SaaS | `tenant` |
| `{id}.apps.moabom.com` | 생성앱 dedicated host | `GeneratedAppHostParser` (Phase 8+) |
| `realtime.moabom.com` | 브라우저 WSS (권장) | nginx → Reverb 프록시 |

환경 변수 (신규 `.env` / `deploy/vm-standalone/env.example`):

```dotenv
MOABOM_SAAS_ENABLED=true
MOABOM_SAAS_BASE_DOMAIN=moabom.com
MOABOM_SAAS_PLATFORM_HOSTS=moabom.com,www.moabom.com,auth.moabom.com,apps.moabom.com
MOABOM_PLATFORM_DATABASE=moabom-platform

APP_URL=https://moabom.com

QUEUE_CONNECTION=database
DB_QUEUE_RETRY_AFTER=120

BROADCAST_CONNECTION=reverb
REVERB_HOST=realtime.moabom.com
REVERB_PORT=443
REVERB_SCHEME=https
# Laravel → Reverb publish (동일 VM 루프백 — 네트워크 병목 제거)
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=6001
REVERB_SERVER_SCHEME=http

FILESYSTEM_DISK=gcs
GOOGLE_CLOUD_STORAGE_BUCKET=<신규-버킷명>
```

---

## 3. VM 권장 스펙 (POC → 소규모 운영)

| 항목 | POC | 소규모 운영 |
|------|-----|-------------|
| 머신 | `e2-standard-2` (2 vCPU, 8GB) | `e2-standard-4` (4 vCPU, 16GB) |
| 리전 | `asia-northeast3` (서울) | 동일 |
| 부트 디스크 | 30GB | 30GB |
| 데이터 디스크 | 100GB `pd-balanced` (MySQL 전용) | 200GB+ |
| OS | Debian 12/13 | 동일 |
| IP | **고정 공인 IP** 필수 | 동일 |

`e2-micro` / realtime VM 스펙은 **Laravel+MySQL 통합에 부적합**.

---

## 4. Phase별 실행 계획

각 Phase는 **완료 기준(DoD)** 을 만족한 뒤 다음 Phase로 진행한다.
Cursor는 해당 Phase만 구현하고, 사용자 수동 항목을 먼저 확인한다.

---

### Phase 0 — 합의·브랜치·격리 (사용자 + Cursor)

**목표:** 운영 **무영향** — VM 병행 작업 공간만 확보.

| 담당 | 작업 |
|------|------|
| 사용자 | 새 GCP 프로젝트 생성 (이름 예: `moabom-prod`) |
| 사용자 | 결제·할당량 확인 (Compute, Storage) |
| Cursor | git 브랜치 `feat/vm-standalone` (또는 사용자 지정) — `deploy/vm-standalone/` 만 우선 추가 |
| Cursor | 본 문서·`README.md` 커밋 (사용자 요청 시) |

**DoD**

- [ ] 새 프로젝트 ID 기록 (문서 §12 빈칸 채움)
- [ ] 운영 `smartmek` DNS/Run 변경 없음

---

### Phase 1 — GCP 기초 (사용자 주도)

**목표:** VM·버킷·IAM·방화벽·고정 IP.

#### 1.1 사용자 — GCP 콘솔 / gcloud

1. **API 활성화**
   - Compute Engine API
   - Cloud Storage API
   - (선택) Secret Manager API
   - (선택) Cloud DNS API — 레지스트라가 GCP DNS가 아니면 생략

2. **고정 공인 IP 예약** (`asia-northeast3`)
   - 이름 예: `moabom-app-ip`

3. **방화벽 (VPC default)**
   | 규칙 | 포트 | 소스 | 비고 |
   |------|------|------|------|
   | `moabom-allow-https` | tcp:443 | `0.0.0.0/0` | HTTP는 80 → 443 리다이렉트용 |
   | `moabom-allow-http` | tcp:80 | `0.0.0.0/0` | certbot HTTP-01 보조 (와일드카드는 DNS-01) |
   | `moabom-allow-ssh` | tcp:22 | **관리자 IP만** | `0.0.0.0/0` 금지 권장 |

4. **VM 생성**
   - 이름: `moabom-app-prod`
   - Zone: `asia-northeast3-a` (또는 b/c)
   - 위 스펙 · 고정 IP 연결
   - OS: Debian 13
   - SSH: 사용자 키 등록 (`moabom` 등)

5. **GCS 버킷 1개**
   - 이름: 전역 유일 (예: `moabom-prod-assets-<랜덤>`)
   - 리전: `asia-northeast3` (VM과 동일)
   - uniform bucket-level access: ON
   - public access prevention: enforced (권장)

6. **서비스 계정**
   - 이름: `moabom-vm-runtime@<PROJECT>.iam.gserviceaccount.com`
   - 역할 (최소):
     - `roles/storage.objectAdmin` (해당 버킷만 IAM 조건 권장)
     - (Secret Manager 사용 시) `roles/secretmanager.secretAccessor`
   - VM 인스턴스에 이 SA **attach** (키 파일 없이 metadata 사용 권장)

7. **데이터 디스크** (선택이 아니라 권장)
   - MySQL datadir 마운트 `/var/lib/mysql` 또는 `/data/mysql`

#### 1.2 DoD

- [ ] `ssh moabom@<고정IP>` 접속
- [ ] `gcloud compute instances describe moabom-app-prod` 에 external IP 확인
- [ ] `gsutil ls gs://<버킷>` 성공 (VM SA로)

---

### Phase 2 — VM OS 부트스트랩 (Cursor + 사용자)

**목표:** Docker·nginx·certbot·디렉터리 SSOT.

| 담당 | 작업 |
|------|------|
| Cursor | `deploy/vm-standalone/install-on-vm.sh` 작성 (`deploy/realtime-vm/install-on-vm.sh` 참고) |
| Cursor | `deploy/vm-standalone/compose/docker-compose.yml` — **mysql, redis** (reverb는 Phase 6에서 Laravel 연동 방식 확정) |
| 사용자 | VM에서 install 스크립트 실행 (root) |
| Cursor | `/opt/moabom-app/` 레이아웃 SSOT 문서화 |

**설치 패키지 (예상):** docker.io, docker compose, nginx, certbot, python3-certbot-nginx (또는 certbot DNS plugin), git, curl, jq.

**DoD**

- [ ] `docker compose ps` — mysql healthy, redis healthy
- [ ] nginx 기동 (아직 자체서명 또는 HTTP만 — Phase 3 DNS 후 TLS)

---

### Phase 3 — DNS + 와일드카드 TLS (사용자 주도)

**목표:** `moabom.com` 이 VM 고정 IP로 해석.

#### 3.1 사용자 — 도메인 레지스트라

| 레코드 | 타입 | 값 |
|--------|------|-----|
| `moabom.com` | A | `<VM 고정 IP>` |
| `www.moabom.com` | A 또는 CNAME | 동일 |
| `auth.moabom.com` | A | 동일 |
| `apps.moabom.com` | A | 동일 |
| `realtime.moabom.com` | A | 동일 |
| `*.moabom.com` | A | 동일 (와일드카드 — 테넌트) |
| `*.apps.moabom.com` | A | 동일 (Phase 8+, 생성앱) |

와일드카드 SSL:

- **권장:** certbot **DNS-01** (`*.moabom.com` + `moabom.com` SAN)
- 레지스트라/GCP Cloud DNS API 자격증명 준비
- HTTP-01만으로는 `*.moabom.com` 불가

#### 3.2 Cursor

- `deploy/vm-standalone/nginx/moabom.com.conf` — server_name, php-fpm, Reverb location (`deploy/realtime-vm/nginx/` 참고)
- TLS 경로: `/etc/letsencrypt/live/moabom.com/`

**DoD**

- [ ] `curl -sI https://moabom.com` → nginx 응답
- [ ] `curl -sI https://test.moabom.com` → 동일 VM (404/tenant-not-found 까지 OK)

---

### Phase 4 — 앱 설치 (깨끗한 G7 + 최소 Moabom) (Cursor)

**목표:** Laravel 기동 · installer · platform DB · SaaS 플래그.

#### 4.1 저장소·코어

1. VM에 MOABOM-MEK clone (또는 rsync)
2. G7 upstream 정합:
   ```bash
   bash deploy/check-upstream-prep.sh   # 로컬/WSL에서 가능한 범위
   php artisan core:update              # VM에서 — 사용자가 PHP/compose 준비 후
   bash deploy/core-patches/apply-core-patches.sh
   ```
3. **Cloud Build 없이** 프론트 산출물: VM 전용 `deploy/vm-standalone/build-assets.sh` (Cursor 작성)
   - `moabom-system`, `moabom-basic`, `moabom-admin_basic` dist
   - 호스트 `npm ci/run build` 금지 규칙은 **VM 예외**로 문서화 (신규 SSOT만)

#### 4.2 최소 활성 확장 (1차)

| 확장 | 이유 |
|------|------|
| `moabom-system` | SaaS·테넌트·셸 SSOT |
| `moabom-basic` | 사용자 템플릿 |
| `moabom-admin_basic` | 관리자 |
| `moabom-reverb` (plugin) | Reverb 드라이버 |
| (코어 번들 sirsoft-* 중 installer 필수분) | G7 기본 |

**아직 비활성:** `moabom-chat`, `moabom-apps`, `sirsoft-ecommerce` 등 — Phase 8.

#### 4.3 DB

- MySQL 컨테이너에 DB 생성:
  - `moabom-platform` (registry)
  - `moabom-db` (플랫폼 기본 DB 또는 legacy)
- `php artisan migrate` (플랫폼)
- SaaS registry 테이블 (`moabom:saas:*` 커맨드 SSOT)

#### 4.4 `.env`

- `deploy/vm-standalone/env.example` → `/opt/moabom-app/app/.env`
- `MOABOM_QUEUE_PLANE_MODE` **미설정 또는 `legacy`** — queue plane 코드 비활성
- `DB_HOST=127.0.0.1` (또는 docker network `mysql`)

**DoD**

- [ ] `https://moabom.com/api/modules/moabom-system/public/ready` 200
- [ ] 관리자 설치/로그인 (플랫폼 호스트)
- [ ] `php artisan moabom:saas:tenant-register` 등으로 테넌트 1개 (`demo`)

---

### Phase 5 — 와일드카드 멀티테넌트 검증 (Cursor + 사용자)

**목표:** `demo.moabom.com` 테넌트 격리.

| 테스트 | 기대 |
|--------|------|
| `https://demo.moabom.com` | 테넌트 UI |
| `https://moabom.com` | 플랫폼 |
| 테넌트 API + GCS upload | `tenants/demo/` prefix |
| platform API on tenant host | 404 (`RestrictPlatformApiToPlatformHost`) |

**Cursor**

- VM 브랜치에서 `TenantRequestHost` 단순화 초안 (trusted proxy만, `*.run.app` 분기 제거)
- `config/moabom-saas.php` 기본값을 `moabom.com` 으로 변경하지 **않음** — `.env` only (운영 mek360 영향 방지)

**DoD**

- [ ] 2테넌트 이상 생성 시 Host별 DB 분리 확인
- [ ] `deploy/vm-standalone/smoke-tenant-hosts.sh` 통과 (Cursor 작성)

---

### Phase 6 — 큐 + 스케줄러 (상시 프로세스) (Cursor)

**목표:** Cloud Tasks / `mobaom-queue` 없이 동일 업무 처리.

#### 6.1 supervisor SSOT (`deploy/vm-standalone/supervisor/`)

```ini
[program:queue-worker]
command=php /var/www/moabom/artisan queue:work database --sleep=3 --tries=3 --timeout=60 --max-jobs=500 --max-time=1800 --memory=192
autostart=true
autorestart=true
user=www-data

[program:php-fpm]
...

[program:nginx]
...
```

#### 6.2 cron

```cron
* * * * * www-data cd /var/www/moabom && php artisan schedule:run --no-interaction >> /var/log/moabom/schedule.log 2>&1
```

#### 6.3 검증 job

| 트리거 | 확인 |
|--------|------|
| 로그인 | 크레딧 리스너 (Phase 8에서 moabom-credit 활성화 후) |
| 알림 훅 | `jobs` 테이블 → 워커 소비 |
| `layout-previews:cleanup` | 스케줄 로그 |

**DoD**

- [ ] `jobs` 테이블 적체 없이 비움
- [ ] queue plane env 없이 동작
- [ ] `moabom:queue:wake-pending` / Cloud Tasks **미사용**

---

### Phase 7 — Reverb + Redis 통합 (실시간·네트워크 병목 해소) (Cursor)

**목표:** realtime 전용 VM 제거·루프백 publish.

1. **Redis** — compose (이미 Phase 2)
2. **Reverb** — Laravel 앱 디렉터리에서 `php artisan reverb:start` (supervisor)
   - 또는 `deploy/realtime-vm` 패턴 미니 compose를 **같은 VM**에 두되 credentials SSOT는 `moabom-reverb` 플러그인
3. **nginx** — `realtime.moabom.com` → `127.0.0.1:6001` WebSocket upgrade (`deploy/realtime-vm/nginx/realtime.mek360.com.conf` 복제·도메인 치환)
4. **env**
   - 클라이언트: `REVERB_HOST=realtime.moabom.com` :443 https
   - 서버 publish: `REVERB_SERVER_HOST=127.0.0.1` :6001 http
5. **브로드캐스트** — `ShouldBroadcastNow` 유지 (DB 큐 경유 금지)

#### 기대 효과 (네트워크)

| 경로 | Before | After |
|------|--------|-------|
| API → Reverb publish | Run → 인터넷 → realtime VM | **루프백 <1ms** |
| 브라우저 → WS | 별도 VM | 동일 리전 VM (단일 hop) |
| Run 인스턴스 간 WS | split-brain 위험 | **단일 Reverb 프로세스** |

**DoD**

- [ ] `wss://realtime.moabom.com/app/...` handshake 101
- [ ] 채팅/알림/presence E2E (Phase 8 모듈 활성화 후 본격 — 여기서는 echo 테스트)
- [ ] `deploy/vm-standalone/smoke-reverb.sh` 통과

---

### Phase 8 — Moabom 기능 단계적 활성화 (Cursor + 사용자)

**순서 (의존성 순)** — 한 번에 전부 켜지 않음.

| 순서 | 모듈/플러그인 | 검증 |
|------|----------------|------|
| 8.1 | `moabom-credit` | 로그인·글 작성 크레딧 |
| 8.2 | `moabom-presence` | presence revision WS |
| 8.3 | `moabom-chat` | 인박스·대화 WS + REST catch-up |
| 8.4 | `moabom-apps` | 생성앱 · `*.apps.moabom.com` DNS/TLS |
| 8.5 | `sirsoft-board` | 게시판 |
| 8.6 | `sirsoft-ecommerce` | 주문·마일리지 스케줄 |
| 8.7 | 기타 plugins (FCM, weather, …) | 각 smoke |

각 단계:

```bash
php artisan extension:update-autoload --no-interaction
bash scripts/check-extension-autoload.sh
# 모듈 dist 빌드 (vm-standalone/build-assets.sh)
php artisan module:activate <id>   # 정책에 맞는 커맨드
```

**DoD (전체)**

- [ ] `deploy/vm-standalone/smoke-full.sh` (기존 smoke 축소 포크) 통과
- [ ] 실시간: v3 문서 시나리오 (친구요청·채팅·알림·presence)

---

### Phase 9 — Cloud Run 우회 코드 제거 (VM 브랜치 only) (Cursor)

**운영 main에 머지하기 전**, `feat/vm-standalone` 에서만 수행.

#### 제거·비활성 후보

| 경로 | 조치 |
|------|------|
| `deploy/deploy-cloud-tasks-queue-service.sh` | VM에서 미사용 — 삭제 또는 `deploy/legacy/cloud-run/` 이동 |
| `deploy/configure-cloud-scheduler-queue-tick.sh` | 동일 |
| `deploy/rollback-cloud-tasks-queue-plane.sh` | 동일 |
| `deploy/supervisord-web.conf`, `supervisord-queue.conf` | VM 단일 `supervisord.conf` 로 대체 |
| `CloudTasksQueueWakeDispatcher` | `queue_plane=legacy` 고정 시 no-op — VM 브랜치에서 listener 제거 검토 |
| `InternalQueueTaskController`, `InternalSchedulerTickController` | VM에서 삭제 |
| `TenantRequestHost::isCloudRunDefaultHost` 분기 | 단순화 |
| `deploy/lib/cloud-run-service-flags.sh` | VM 빌드 경로에서 참조 제거 |

#### 유지

- `TenantQueueBootstrapper` (멀티테넌트 job 복원)
- `ResolveMoabomTenant`
- `deploy/core-patches/`
- v3 REST catch-up 프론트

**DoD**

- [ ] `grep -r MOABOM_QUEUE_PLANE_MODE deploy/vm-standalone/` 만 존재, VM 런타임 env에 없음
- [ ] `check-saas-runtime-invariants.sh` VM 포크 또는 VM용 게이트 스크립트 통과

---

### Phase 10 — 백업·모니터링·watchdog (Cursor + 사용자)

| 항목 | 방법 |
|------|------|
| MySQL | 일 1회 `mysqldump` → GCS `backups/mysql/` |
| GCS | 버킷 versioning ON |
| VM 디스크 스냅샷 | 주 1회 (GCP 스케줄) |
| 프로세스 | `watchdog.sh` + systemd timer (`deploy/realtime-vm/` 참고) |
| 로그 | `/var/log/moabom/` · docker logs |

**DoD**

- [ ] 복구 리허설 1회 (DB dump restore)

---

### Phase 11 — 성능·실시간 검증 (사용자 체감)

| 시나리오 | 기대 |
|----------|------|
| WS 연결 후 알림 | Run+VM 대비 지연 감소 |
| 채팅 메시지 | publish 루프백으로 즉시 |
| 한산 시간 job | queue worker 상시 — 적체 없음 |
| 동시 접속 N명 | 단일 VM 한계 측정 (문서화) |

---

### Phase 12 — (기본 하지 않음) 운영 컷오버

**본 계획의 목표가 아님.** VM POC가 만족스러워도 **자동으로 이 단계로 가지 않는다.**

- `mek360.com` DNS를 VM으로 바꾸기
- `smartmek` Cloud Run / Cloud SQL **종료**
- 운영 데이터 일괄 이관

→ 위는 **사용자가 별도로 “이제 운영을 VM으로 바꾼다”고 결정할 때만** 새 SSOT로 작성한다.
그 전까지 **운영 = Run, 병행 = moabom.com VM** 이 공존한다.

---

## 5. 사용자가 직접 해야 할 일 (마스터 체크리스트)

### 한 번만

- [ ] 새 GCP 프로젝트·결제
- [ ] `moabom.com` 도메인 (소유·네임서버)
- [ ] SSH 키 생성·VM 등록
- [ ] OAuth 앱 (네이버/카카오/구글) — redirect URI `https://auth.moabom.com/...` 재등록
- [ ] (FCM 사용 시) Firebase 프로젝트·서비스 계정 JSON
- [ ] (AI 사용 시) OpenAI/Anthropic/Google API 키

### Phase별

| Phase | 사용자 작업 |
|-------|-------------|
| 1 | VM·IP·버킷·SA·방화벽 |
| 3 | DNS A/와일드카드·certbot DNS |
| 4 | (선택) install 마법사에서 관리자 계정 |
| 8 | 모듈 활성화 승인·외부 API 키 입력 |
| 10 | 백업 스케줄 확인 |

---

## 6. Google Cloud 설정 요약

| 리소스 | 설정 |
|--------|------|
| Project | 신규 (운영 `smartmek` 와 분리) |
| Region | `asia-northeast3` |
| VM | `moabom-app-prod` + static IP |
| Disk | 부트 + MySQL 데이터 디스크 |
| GCS | 버킷 1개 · OBP · SA objectAdmin |
| SA | VM attached · 키 파일 지양 |
| Firewall | 443/80 공개, 22 제한 |
| **미사용** | Cloud Run, Cloud SQL, Cloud Tasks, Cloud Scheduler, HTTP(S) LB, Artifact Registry (선택) |

---

## 7. Cursor 에이전트 작업 규칙

1. **경로:** `deploy/vm-standalone/` 우선 · `app/modules/moabom-*` 는 Phase 8에서만 기능 변경.
2. **금지 (운영 보호):** `_IMAGE_TAG` 증가 · `build-and-deploy.sh` 실행 · `mek360.com` DNS/Run/env 변경 · 운영 DB/GCS **쓰기·삭제**.
3. **병행 = 복사 개념:** git·코어·모듈은 **같은 저장소**를 쓰되, **런타임·데이터·도메인은 완전 분리**.
4. **코어:** `app/app` 직접 수정 금지 — `deploy/core-patches/` 만.
5. **검증:** `ReadLints`, `scripts/check-extension-autoload.sh`, VM smoke 스크립트.
6. **로컬 PHP/Docker:** WSL 규칙상 호스트 PHPUnit/npm 금지 — **VM 또는 문서화된 VM 빌드 스크립트**만.
7. **Phase 완료 시:** 본 문서 DoD 체크박스 업데이트 + `deploy/vm-standalone/PROGRESS.md` 에 기록 (Cursor 작성).
8. **main 머지:** Phase 9 Run 코드 제거는 **`feat/vm-standalone` 브랜치만** — main 머지 전 운영 Run 영향 리뷰 필수.

### 다음 Cursor 프롬프트 예시

```
deploy/vm-standalone/MIGRATION-PLAN.md Phase 2를 진행해줘.
- install-on-vm.sh, compose/mysql+redis, nginx 스켈레톤
- 운영 Cloud Run/ smartmek 는 건드리지 마
- 완료 후 DoD와 사용자 수동 작업 목록을 알려줘
```

---

## 8. 현행 시스템과의 대응표

| 현행 (`smartmek`) | VM Standalone |
|-------------------|---------------|
| `mobaom-container` (Run) | nginx + php-fpm |
| `mobaom-queue` (Run) | supervisor `queue:work` |
| Cloud Scheduler → queue tick | cron `schedule:run` |
| Cloud Tasks `smartmek` | 없음 |
| Cloud SQL `moabom-sql-v2` | Docker MySQL |
| GCS `smartmek` 버킷 | 신규 버킷 1개 |
| `moabom-realtime-prod` VM | **통합 제거** |
| `moabom-lb-frontend` | 없음 (DNS → VM IP) |
| `mek360.com` | `moabom.com` |
| `deploy/production.env.yaml` | `deploy/vm-standalone/env.example` |

---

## 9. 리스크·완화

| 리스크 | 완화 |
|--------|------|
| VM SPOF | Phase 10 백업·스냅샷·watchdog |
| MySQL 운영 부담 | 데이터 디스크 분리·복구 리허설 |
| 와일드카드 TLS 실패 | DNS-01 자동화·만료 30일 전 갱신 |
| 단일 VM CPU 한계 | Phase 11 부하 측정 → 스펙 업 |
| VM 브랜치와 main 분기 | Phase 9까지 main 미머지 |
| G7 core 업데이트 | `core-patches` 유지·`check-upstream-prep.sh` |

---

## 10. 성공 기준 (병행 POC 완료)

1. `https://moabom.com` 플랫폼 + `https://{tenant}.moabom.com` 멀티테넌트 (**운영 `mek360.com` 과 무관**)
2. 큐·스케줄러·Reverb **상시 동작** (Cloud Tasks/queue Run 없음)
3. 채팅·presence·알림 WS + REST catch-up (v3)
4. GCS 테넌트 prefix 정상 (신규 버킷)
5. Run 전용 코드 VM 브랜치에서 제거 또는 격리
6. **운영 `mek360.com` / Cloud Run / Cloud SQL 이 Phase 전후 동일하게 동작** (무영향)
7. **운영 컷오버(Phase 12)는 수행하지 않음**

---

## 11. 참고 SSOT (기존 repo)

| 문서 | 내용 |
|------|------|
| `app/docs/moabom-realtime-plane-v3.md` | 실시간 4-plane·REST 안전망 |
| `deploy/moabom-realtime-vm.md` | Reverb nginx·compose (도메인만 치환) |
| `app/config/moabom-saas.php` | SaaS env 키 |
| `deploy/DEPLOY-RECURRING-FAILURES.md` RF-26 | Host 스푸핑 (VM에서는 단순화) |
| `.cursor/rules/moabom-generated-apps-data-plane.mdc` | platform DB SSOT |

---

## 12. 프로젝트 메모 (사용자가 채움)

| 항목 | 값 |
|------|-----|
| 신규 GCP Project ID | |
| VM 고정 IP | |
| GCS 버킷명 | |
| VM SSH | `moabom@` |
| git 브랜치 | `feat/vm-standalone` |
| certbot DNS plugin | |
| 1차 테넌트 slug | `demo` |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-28 | 초안 — Cloud Run 대화 합의·Phase 0–12 |
| 2026-07-28 | 운영 **이전 아님·병행 복제** 명시 (D9–D10, Phase 12, 성공 기준) |
