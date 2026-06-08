# Cursor rules (Moabom)

**4층:** (1) 규칙 주입 (2) 작업 시 트리거 (3) **스크립트 검증** (4) deploy MD = 사람·@참조

| 파일 | 적용 |
|------|------|
| `moabom-user-workflow.mdc` | **항상 — 최우선** 활성 디렉터리만·Cloud Build 배포만·_bundled/update --force/호스트 빌드/미러 금지 |
| `g7-core-readonly.mdc` | **항상** — 코어 비수정, `./scripts/g7` (사용자에게 「로컬」이라 말하지 말 것) |
| `moabom-architecture.mdc` | 확장·자산·TS·표면 |
| `moabom-operations.mdc` | **항상** — 에이전트 내부 If-Then·배포·autoload (사용자-facing은 user-workflow 우선) |
| `moabom-social-auth-admin-scope.mdc` | `moabom-social-auth` Admin·SNS 설정 — host scope × abilities 확장 |
| `no-git-investigation.mdc` | **항상** — 사용자 질문에 답하려고 git/GitHub 이력 뒤지기 금지 (정상 워크플로는 허용) |

| 스크립트 (읽기 대신 실행) | |
|---------------------------|--|
| `scripts/check-extension-autoload.sh` | 모듈 PSR-4 vs `autoload-extensions.php` |
| `deploy/check-before-cloud-build.sh` | 제출 전 v7 (2c autoload 포함) |
| `deploy/build-and-deploy.sh` | 빌드·배포·스모크 |

| Hooks (`.cursor/hooks.json`) | |
|--------------------------------|--|
| `sessionStart` | Moabom SSOT 컨텍스트 주입 |
| `beforeShellExecution` | **금지 셸 차단** (_bundled, update --force, rebuild, host npm, docker push 등) |
| `afterAgentResponse` | 금지 행위/안내 패턴 로그 (차단 불가) |

| deploy (장문) | |
|---------------|--|
| [AGENT-FAILURE-ANALYSIS.md](../deploy/AGENT-FAILURE-ANALYSIS.md) | **매 턴 재읽기 — STOP/GO·DoD-5 게이트. §9 = v98~v108 11 가설 결산 (재시도 금지)** |
| [LOCAL-RUN-PARITY.md](../deploy/unused/LOCAL-RUN-PARITY.md) | 배경·체크리스트 A~F — **에이전트 전체 읽기 금지** |
| [deploy/README.md](../deploy/README.md) | 인덱스 |

G7 코어: `app/AGENTS.md`, `app/docs/`.
