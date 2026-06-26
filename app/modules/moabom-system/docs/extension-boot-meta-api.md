# 확장 부트 메타 API (`public/extension-boot-meta`)

## 목적

SPA 가 관리자의 모듈/플러그인 상태 변경 이후 **캐시 세대(Epoch)** 를 감지하고, 필요 시 지연 에셋만 다시 로드하거나 가벼운 알림을 띄울 수 있도록 공개 메타를 제공한다.

## 엔드포인트

- `GET /api/modules/moabom-system/public/extension-boot-meta`
- 제한: `throttle:120,1`

## 응답 (ResponseHelper 모듈 성공 래핑)

`success`, `message`, `data` 구조를 따른다.

### `data` 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `extension_epoch` | `integer` | 코어 `ClearsTemplateCaches` 와 동일한 확장 캐시 버전(Unix 시각 기반). Blade `G7Config.appConfig.moabom.extension_epoch` 와 비교 가능. |
| `client_actions` | `object` | 향후 서버 주도 UX 힌트(현재는 모두 기본값). |
| `client_actions.reload_deferred_assets` | `boolean` | `true` 이면 클라이언트가 G7 순정 `reloadModuleHandlers` / `reloadPluginHandlers` 등으로 **지연 확장만** 재수집하도록 권장. |
| `client_actions.notify_user` | `boolean` | `true` 이면 토스트 등 **가벼운 알림** 표시 권장. |
| `client_actions.message_key` | `string\|null` | 알림 시 사용할 i18n 키(모듈 번역). |
| `module_hints` | `array` | 향후 모듈 단위 힌트(예: `{ "identifier": "x", "action": "reload_layout" }`). 현재는 빈 배열. |

## 클라이언트 권장 흐름 (초안)

1. 초기 HTML 의 `G7Config.appConfig.moabom.extension_epoch` 를 보관한다.
2. 주기적(또는 포커스 복귀) `GET .../extension-boot-meta` 호출.
3. `data.extension_epoch` 가 로컬 값보다 크면:
  - `client_actions.reload_deferred_assets === true` 인 모듈만 선택적으로 G7 순정 reload 액션 호출.
   - `notify_user === true` 이면 `message_key` 로 알림.
4. SW/템플릿 JSON 캐시는 기존 `?v=`(동일 epoch) 정책과 병행한다.

## G7Config (Blade) 보조 키

`moabom-system` 의 Ghost View Composer가 `moabom-basic` 등에서 설정한다.

- `appConfig.moabom.extension_epoch` — 서버가 내려준 확장 세대.
- `appConfig.moabom.extensionDeferredRegistry` — **전체 지연 에셋 URL 맵**. Ghost 경로에서는 표면 `deferred*`를 비운 뒤 복원용으로 쓰이며, `/shop` 등 직접 진입 경로에서도 `MoabomUserBootDeferredAssetsGhostComposer`가 동일 맵을 병합한다.
