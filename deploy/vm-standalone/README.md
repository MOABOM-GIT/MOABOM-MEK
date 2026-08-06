# Moabom VM Standalone — SSOT

운영 Cloud Run(`smartmek` / `mek360.com`)은 **계속 운영**하고, 새 GCP 계정·VM·`moabom.com` 은 **병행 복제(greenfield)** 로 구축하는 SSOT. **이전·컷오버가 아님.**

| 문서 | 용도 |
|------|------|
| **[MIGRATION-PLAN.md](./MIGRATION-PLAN.md)** | 오늘(2026-07-28) 합의된 결정·Phase 0–12·사용자/GCP 체크리스트·Cursor 지시 |
| [PROGRESS.md](./PROGRESS.md) | Phase 완료 추적 |
| [env.example](./env.example) | VM `.env` 템플릿 (`moabom.com`) |
| `compose/` | (Phase 2) Docker Compose·nginx·supervisor — Cursor가 생성 예정 |

**원칙**

- 기존 `deploy/build-and-deploy.sh` / Cloud Run 경로는 **건드리지 않음** (운영 유지).
- VM 전용 산출물은 **`deploy/vm-standalone/`** 에만 추가.
- Moabom **제품 코드**(`app/modules/moabom-*`, templates, plugins)는 가져가고, **Run 우회 인프라**만 제거·단순화.
