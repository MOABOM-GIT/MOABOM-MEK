# Cursor rules (Moabom)

에이전트 규칙 SSOT. 장문 배포·실패 분석은 `deploy/DEPLOY-RECURRING-FAILURES.md`, G7 상세는 `app/docs/`.

## 규칙 파일

| 파일 | 적용 | 내용 |
|------|------|------|
| `moabom-user-workflow.mdc` | **항상** | 사용자 응답·실행 최우선 — 활성 경로만, Cloud Build 배포만 |
| `g7-core-readonly.mdc` | **항상** | G7 코어 비수정, 허용 경로, 디버깅 원칙 |
| `moabom-operations.mdc` | **항상** | 배포·autoload·SaaS If-Then (에이전트 내부) |
| `no-git-investigation.mdc` | **항상** | 질문 답변 시 git/GitHub 이력 뒤지기 금지 |
| `moabom-architecture.mdc` | 요청 시 | 확장 자산·표면·TS·셸 UI |
| `moabom-social-auth-admin-scope.mdc` | `moabom-social-auth/**` | SNS Admin host scope × abilities |

## 검증 스크립트 (실행 우선)

| 스크립트 | 용도 |
|----------|------|
| `scripts/check-extension-autoload.sh` | PSR-4 vs `autoload-extensions.php` |
| `deploy/check-before-cloud-build.sh` | Cloud Build 제출 전 통합 게이트 |
| `deploy/build-and-deploy.sh` | 빌드·배포·스모크 |

## 운영 문서 (활성)

| 문서 | 용도 |
|------|------|
| [`README.md`](../../README.md) | 저장소 구조·upstream·배포 한 줄 |
| [`deploy/README.md`](../../deploy/README.md) | deploy/ 인덱스·파이프라인 |
| [`deploy/DEPLOY-RECURRING-FAILURES.md`](../../deploy/DEPLOY-RECURRING-FAILURES.md) | 배포·레이아웃 RF, 완료 상태 |
| [`deploy/core-patches/README.md`](../../deploy/core-patches/README.md) | G7 코어 패치 캡슐 |
| [`app/docs/`](../../app/docs/) | G7 개발 가이드 (AI 참조용) |
| [`app/AGENTS.md`](../../app/AGENTS.md) | G7 에이전트 가이드 |

과거 실험·장문 배경은 Git 이력 참고 (운영 SSOT 아님).
