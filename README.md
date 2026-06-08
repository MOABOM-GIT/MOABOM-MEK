# MOABOM-MEK

Moabom 멀티테넌트 SaaS (Cloud Run) — G7 `app/` + 활성 확장 + `deploy/`.

## 저장소 구조

| 경로 | 역할 |
|------|------|
| `app/` | 그누보드7 + Moabom 최소 코어 패치(워킹 트리) + 활성 `moabom-*` 확장 |
| `deploy/` | Cloud Build / Cloud Run / 코어 패치셋 (`core-patches/`) |
| `scripts/` | 배포 전 검증 (`check-extension-autoload.sh` 등) |

## G7 upstream

- Upstream: [gnuboard/g7](https://github.com/gnuboard/g7) (`beta.7` 기준)
- 코어 delta: `deploy/core-patches/moabom-core.patch` (18파일)
- 업스트림 PR 후보: `deploy/core-patches/g7-upstream-hooks.patch`
- 갱신: `php artisan core:update` → `bash deploy/core-patches/apply-core-patches.sh`

## 배포 (유일 경로)

```bash
bash deploy/check-before-cloud-build.sh
./deploy/build-and-deploy.sh
```

`dist`·`node_modules`·`vendor`는 Git에 없음 — Cloud Build 가 생성.
