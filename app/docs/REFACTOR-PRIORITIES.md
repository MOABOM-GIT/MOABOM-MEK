# 모아봄 플랫폼 리팩토링 — 추가 우선순위

요구사항 0~13과 코드베이스·설계도 대조 결과. **동작 100% 보존**이 전제.

## 실행 순서 (P0 → P6)

| 단계 | 내용 |
|------|------|
| P0 | 계약 테스트 CI 고정 + 배포 SSOT(Git 태그) 일치 |
| P1 | 병원 생성(로고·비고) + E2E |
| P2 | 저장소·드라이버 평면 분리 (G7 UI vs SaaS DB SSOT) |
| P3 | 디자인 시스템 게이트 + App SDK 검증 |
| P4 | 관리자 TTFB 베이스라인 + 부트 재설계 |
| P5 | compat 제거 + moabom-system 최종 축소 |
| P6 | 진행 중 앱 3종(App SDK) 정렬 |

## P0 — 릴리즈 게이트

- 병원·설정·shell-boot·앱·PWA·배포를 **단일 CI 파이프라인**으로 묶기
- `cloudbuild-v3.yaml` 이미지 태그 = Git HEAD 일치
- compat 항목마다 **제거 조건·검증** 표 (`decomposition-api-compat.json`, `region`→`note` 등)

## P2 — 저장소·드라이버

- 설정 종류별 라우팅 표: 일반 파일 / 첨부 / SaaS 모듈 설정 / 세션 / 캐시
- `Storage::disk()` 직접 호출 전수 스캔
- Cloud SQL 기본값 전환 시 G7 `StorageInterface` vs Moabom DB 평면 경계

## P3 — 디자인 시스템·앱 플랫폼

- layout JSON·TSX raw Tailwind 비율 CI
- `app.json` ↔ dist chunk 매칭 게이트
- AI 앱 데이터 API 권한·rate limit

## P4 — 관리자 성능

- admin 첫 paint·layout JSON 수·API 수 **정량 목표**
- admin 전용 최소 부트 API 검토

## 분산 SSOT 밖 자산

| 경로 | 비고 |
|------|------|
| `_archive_20260607/` | 로컬만, Git ignore |
| `app/storage/app/settings/` | 런타임 JSON |
| `deploy/ssot/` vs `modules/moabom-system/config/` | 이중 SSOT — 통합 검토 |
| `app/.git.g7-upstream-backup` | 패치 검증용 — 활성 복원 필요 |

## 테넌트 관리자 메뉴 (P1 관련)

**API:** `GET /api/admin/menus/active` → `MenuService::getAccessibleNavigationMenus`

**DB (테넌트 DB):**

| 테이블 | 역할 |
|--------|------|
| `menus` | 메뉴 정의 (core·모듈·플러그인·moabom-system 선언) |
| `role_menus` | admin 역할 × menu × read — **사이드바 노출의 실질 게이트** |
| `modules` / `plugins` | extension 메뉴는 status=active 일 때만 노출 |

**동기화 경로 (provision):**

1. `moabom:saas:tenant-repair` — menu row mirror + declarative sync + `role_menus`
2. `moabom:saas:sync-tenant-admin-menus` — core·확장 메뉴 재동기화
3. **(필수)** sync 이후 `role_menus` 재보정 — sync가 신규 menu row를 추가하면 repair 이전 매핑이 부족해질 수 있음

**증상:** 최초 병원 생성 직후 4개 메뉴만 보임 → 캐시 삭제·새로고침 후 전체 노출  
**원인:** provision 마지막 `sync-tenant-admin-menus` 이후 `role_menus` 미보정

## 병원 생성 로고 (P1)

**API:** `POST /api/modules/moabom-system/platform/saas/hospitals` (multipart)

**프론트:** `admin_saas_hospital_create.json` → FileInput → `_local.form.logo_light`

**검증:** `StoreSaasHospitalRequest` — `logo_light` nullable file, mimes 포함 svg

**알려진 버그:** `ActionDispatcher.deepMergeInto`가 dot notation(`form.logo_light`)으로 File 저장 시 File을 plain object로 spread → `{}` 또는 filename 문자열화 → Laravel `file` 검증 실패
