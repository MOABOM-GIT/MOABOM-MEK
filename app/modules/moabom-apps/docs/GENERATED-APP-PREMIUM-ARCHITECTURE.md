# AI 생성앱 프리미엄 기능 — 패키지 경계 SSOT

> 구현·리뷰·회귀는 본 문서 기준. `GENERATED-APP-TIERS.md` 의 Host/티어 SSOT 와 함께 읽는다.

---

## 1. 목적

Inspector 패치 · Hosted 데이터 콘솔 · 버전 타임머신 · 셸 네이티브 브릿지를
**한 파일에 몰아넣지 않고** 4개 독립 패키지로 유지한다.

---

## 2. 소유권 (불변)

| 패키지 | FE | BE | `AiGeneratorApp` 역할 |
|--------|----|----|------------------------|
| Inspector + NL patch | `templates/.../ai-generator/inspector/` | 기존 `AiAppService` patch (`generation_mode=patch`) | 패널 mount + selection→prompt 만 |
| Hosted data console | `templates/.../generated/hostedDataConsole/` | `GeneratedAppOwnerDataController` + `GeneratedAppHostingService` | **없음** (Viewer 진입) |
| Version / time machine | `templates/.../generated/versionHistory/` | `GeneratedAppVersionService` + revisions 테이블 | 저장 성공 시 스냅샷은 **BE store/update** 가 담당 |
| Shell native bridge | `generatedAppIframeBridge.ts` + Viewer 핸들러 | `GeneratedAppHtmlService` 주입 JS allowlist | **없음** |

### 넣지 말 것

- Hosted `/api/data/*` · CSP · 브릿지 주입 · 버전 복원 · 데이터 콘솔을 `AiAppController` / `AiGeneratorApp` 에 확장
- 임의 JS 실행·부모 DOM 접근을 생성 HTML 에 직접 삽입
- create-app IIFE 에 Data Console / Version UI 번들

---

## 3. Preview 이중 모델

| 단계 | 표면 | 브릿지 |
|------|------|--------|
| 생성 중 | `srcdoc` iframe (opaque origin, **no** `allow-same-origin`) | `injectPreviewInspectorBridge` — 미리보기 **전용**. 저장 HTML·`prepareGeneratedAppHtmlForPersist` 경로에서는 `stripPreviewInspectorBridge` |
| 저장 후 | `preview_url` (standard/hosted) | `GeneratedAppHtmlService::harden` 이 CSP·runtime·download·(hosted) data API·shell allowlist 주입 |

두 표면의 상태·보안 경계를 섞지 않는다.

### 생성 중 Inspector (srcdoc)

부모는 opaque origin 이라 `contentDocument` 접근 불가. 선택 모드는 postMessage 만:

| 방향 | type | 동작 |
|------|------|------|
| 부모 → iframe | `inspector-enable` / `inspector-disable` (`source: moabom-shell`) | 캡처 클릭·하이라이트 on/off. 비활성 시 앱 기본 동작 |
| iframe → 부모 | `inspector-selection` (`source: moabom-app`) | `{ cssPath, tagName, outerHtmlSnippet, textSnippet }` |

`allow-same-origin` 추가 금지 (stored XSS / 부모 탈출 위험).

---

## 4. `AiGeneratorApp` 조합-only 규칙

허용:

- 폼 상태 · `useAiAppStream` · `aiGenerationDraft` · `generatedAppHtmlPipeline`
- 자식 패널 mount (`AiGenerationCodePanel`, `inspector/*` 등)

금지:

- Hosted row CRUD · revision list/restore · shell postMessage allowlist 로직을 본 파일에 추가
- 기능별 대형 상태를 오케스트레이터에 누적 (기능 로컬 state 유지)

공유해도 되는 값: `draftHtml` / `sessionId` / `appId` / `appTier` 수준.

---

## 5. 회귀 포인트 (페이즈마다)

| 영역 | 파일 |
|------|------|
| Draft / completeness | `aiGenerationDraft.ts` |
| Persist pipeline | `generatedAppHtmlPipeline.ts` |
| Patch SEARCH/REPLACE | `AiAppService::applyPatchResponse` |
| HTML harden / bridges | `GeneratedAppHtmlService` |
| Hosted rows | `GeneratedAppHostingService` |
| iframe 메시지 | `generatedAppIframeBridge.ts` |

배포 전: `scripts/check-extension-autoload.sh`, `deploy/check-before-cloud-build.sh`.

---

## 6. Shell bridge allowlist

iframe → 부모 `postMessage` (`source: 'moabom-app'`):

| type | 동작 |
|------|------|
| `heartbeat-pong` | 워치독 |
| `backdrop-tone` | 툴바 톤 |
| `file-download` | 다운로드 위임 |
| `shell-toast` | 셸 토스트 (message, severity) |
| `shell-open-app` | 셸 앱 열기 (`appId` 문자열만) |
| `inspector-selection` | 생성 중 srcdoc Inspector 전용 (Viewer harden 경로에는 미주입) |

그 외 type 은 **무시(거부 기본값)**. Viewer 주입은 `GeneratedAppHtmlService` 만. 생성 중 Inspector 는 `previewInspectorBridge.ts` 만.
