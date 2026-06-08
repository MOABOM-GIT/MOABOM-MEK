# SNS Admin — Host Scope × Abilities 확장 가이드

> **대상:** AI 에이전트 · Moabom 개발자  
> **모듈:** `moabom-social-auth`  
> **관련 SSOT:** [PROJECT-SOCIAL-AUTH-PROXY-MULTITENANT.md](../../../deploy/PROJECT-SOCIAL-AUTH-PROXY-MULTITENANT.md) (OAuth·브로커·배포 전체)

Admin SNS 설정 UI/API는 **접속 호스트(host scope)** 와 **관리자 권한(permission)** 의 조합으로 동작한다.  
새 테넌트 유형·도메인 정책·필드 노출을 추가할 때 **이 문서의 4계층 SSOT**만 따른다.

---

## 1. 개념 모델

```
┌─────────────────────────────────────────────────────────────┐
│  Host Scope (어디서 접속?)                                   │
│  platform │ tenant_subdomain │ tenant_custom (예정)         │
└──────────────────────────┬──────────────────────────────────┘
                           ×
┌──────────────────────────┴──────────────────────────────────┐
│  Permission (누가? — Laravel permission)                     │
│  moabom-social-auth.settings.read / .update                   │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  API abilities (features.*)  →  Layout computed  →  partial  │
└─────────────────────────────────────────────────────────────┘
```

| host_scope | 예시 Host | credential 편집 | provider on/off | 비고 |
|------------|-----------|-----------------|-----------------|------|
| `platform` | `mek360.com`, `auth.mek360.com` | ✅ | ✅ | platform DB SSOT |
| `tenant_subdomain` | `freshent.mek360.com` | ❌ (표시만) | ✅ | tenant DB, 마스터 키 상속 |
| `tenant_custom` | `shop.example.com` (예정) | TBD | TBD | `SocialAuthAdminHostScope`에서 분기 추가 |

**원칙:** 레이아웃 JSON·partial에서 `request.host`, `endsWith('.mek360.com')` 등 **호스트 문자열 직접 비교 금지**.

---

## 2. SSOT 파일 맵 (4계층)

| 계층 | 역할 | 경로 |
|------|------|------|
| **① Host scope + features** | 호스트별 capability 정의 | `src/Support/SocialAuthAdminHostScope.php` |
| **② API abilities** | GET/PUT settings 응답에 merge | `src/Http/Controllers/Admin/SocialAuthSettingsController.php` → `settingsAbilities()` |
| **③ 서버 저장·검증** | UI 우회 방지 | `SocialAuthSettingsService::persistProvidersToDatabase()`, `StoreSocialAuthSettingsRequest` |
| **④ Layout computed + partial** | UI disabled / if / className | `resources/layouts/admin/admin_social_auth_settings.json`, `partials/social_auth/*` |

**수정 경로:** `app/modules/moabom-social-auth/` (활성).  
`app/modules/_bundled/moabom-social-auth/` 직접 수정 금지 — `module:build` / 배포 파이프라인 기준은 활성 경로.

---

## 3. API `abilities` 계약

`GET|PUT /api/modules/moabom-social-auth/admin/settings` 응답 `data.abilities`:

```json
{
  "host_scope": "platform | tenant_subdomain | tenant_custom",
  "can_update": true,
  "readonly_sub_tenant": false,
  "can_manage_credentials": true,
  "inherits_master_credentials": false,
  "features": {
    "manage_credentials": true,
    "toggle_provider_enabled": true,
    "toggle_use_master_defaults": true,
    "view_master_credentials": false
  }
}
```

| 필드 | 설명 |
|------|------|
| `host_scope` | UI·정책 분기의 **주 키** (신규 scope 추가 시 여기 확장) |
| `can_update` | Laravel permission `moabom-social-auth.settings.update` |
| `can_manage_credentials` | **하위 호환** — `features.manage_credentials`와 동기 |
| `readonly_sub_tenant` | **하위 호환** — sub-tenant 여부 |
| `inherits_master_credentials` | GET 시 마스터 credential 병합 표시 여부 |
| `features.*` | **신규 UI/저장 분기는 features에만 추가** |

---

## 4. Layout `computed` 계약

`admin_social_auth_settings.json` — partial은 `_computed.*` 또는 `settings.data.abilities.features.*` 만 참조.

| computed | 용도 |
|----------|------|
| `hostScope` | 디버그·조건부 배너 (호스트 문자열 비교 대신 사용) |
| `isReadOnly` | `can_update !== true` → 전체 저장 불가 |
| `canManageCredentials` | credential 필드·체크박스 편집 가능 여부 |
| `credentialInputsLocked` | ID/Secret `disabled` SSOT |
| `credentialLabelClassName` | sub-tenant 라벨 흐림 |
| `credentialInputClassName` | sub-tenant 인풋 흐림·disabled 스타일 |

Provider 카드 partial (`_provider_card_{google,kakao,naver}.json`):

- **enabled 체크박스:** `disabled: {{_computed.isReadOnly}}` 만 (tenant도 on/off 가능)
- **ID/Secret:** `disabled: {{_computed.credentialInputsLocked || use_master_defaults}}`, `className: {{_computed.credentialInputClassName}}`
- **use_master_defaults 체크:** `if: {{_computed.canManageCredentials}}` (tenant에 hidden)

---

## 5. 새 scope / feature 추가 체크리스트

예: `tenant_custom`에서 “자체 OAuth 키 허용”

### Step 1 — Host 감지 (`SocialAuthAdminHostScope.php`)

```php
// resolve() 내부
$hostScope = self::detectHostScope($host); // platform | tenant_subdomain | tenant_custom

return [
    'host_scope' => $hostScope,
    // ...
    'features' => [
        'manage_credentials' => $hostScope === self::SCOPE_PLATFORM
            || $hostScope === self::SCOPE_TENANT_CUSTOM, // 예시
        // ...
    ],
];
```

### Step 2 — Controller

`settingsAbilities()`는 `SocialAuthAdminHostScope::resolve()` 결과 + `can_update` merge **유지**.  
abilities를 Controller에 inline 하드코딩하지 말 것.

### Step 3 — 저장·검증

- `SocialAuthSettingsService::persistProvidersToDatabase()` — scope별 persist 분기
- `StoreSocialAuthSettingsRequest::withValidator()` — scope별 validation
- **UI만 막고 서버가 strip하지 않으면 보안 구멍**

### Step 4 — Layout

- `admin_social_auth_settings.json` `computed`에 UI 플래그 1~2개 추가 (필요 시)
- partial `if` / `disabled` / `className` — **features 또는 computed만**

### Step 5 — 테스트

```bash
./scripts/g7 php artisan test --filter=SocialAuthAdminHostScope
./scripts/g7 php artisan test --filter=SocialAuthSettings
```

### Step 6 — 문서

- 이 파일 §1 표에 scope 행 추가
- [PROJECT-SOCIAL-AUTH-PROXY-MULTITENANT.md §6.3](../../../deploy/PROJECT-SOCIAL-AUTH-PROXY-MULTITENANT.md) 동기화

---

## 6. 금지 패턴 (Anti-patterns)

| ❌ 하지 말 것 | ✅ 대신 |
|--------------|---------|
| partial에 `host === 'freshent.mek360.com'` | `abilities.host_scope` / `features.*` |
| scope마다 `_provider_card_google_master.json` 복제 | 공통 partial + computed |
| `_bundled/` 레이아웃만 수정 | `modules/moabom-social-auth/resources/` |
| `readOnly`만 쓰고 disabled·스타일 생략 | `credentialInputsLocked` + `credentialInputClassName` |
| abilities 없이 프론트만 disabled | Service + FormRequest 서버 strip |

---

## 7. 현재 sub-tenant 동작 요약

**GET (tenant_subdomain):**

- platform master credential을 merge해 ID/Secret **표시** (`inherits_master_credentials`)
- `abilities.features.manage_credentials = false`

**PUT (tenant_subdomain):**

- `enabled`만 tenant DB에 저장
- credential·`use_master_defaults`는 서버에서 강제 null / true (`persistProvidersToDatabase`)

**UI:**

- 상단 sub-tenant 배너 + 카드 내 master inherit 배너
- credential 인풋: disabled + 회색(흐림)

---

## 8. G7 Admin `abilities` 관례 (타 모듈과 동일)

moabom-system `admin_mypage_settings`, admin identity 등과 동일 패턴:

- API가 `abilities.can_*` / `features.*` 반환
- layout `computed.isReadOnly` ← `can_update`
- 필드 `disabled` ← abilities 또는 computed

SNS Admin은 **host scope까지 abilities에 포함**한 확장형이다. 다른 Moabom Admin 화면도 SaaS multi-host가 필요하면 이 패턴을 재사용한다.

---

## 9. 빠른 grep (AI 에이전트용)

```bash
# SSOT 클래스
rg SocialAuthAdminHostScope app/modules/moabom-social-auth

# abilities merge
rg settingsAbilities app/modules/moabom-social-auth

# layout computed
rg canManageCredentials app/modules/moabom-social-auth/resources/layouts

# sub-tenant persist
rg isSubTenantHost app/modules/moabom-social-auth/src/Services/SocialAuthSettingsService.php
```

---

## 10. 관련 문서

| 문서 | 내용 |
|------|------|
| [PROJECT-SOCIAL-AUTH-PROXY-MULTITENANT.md](../../../deploy/PROJECT-SOCIAL-AUTH-PROXY-MULTITENANT.md) | OAuth 브로커·배포·장애 이력 |
| [PROJECT-ADMIN-SAAS-REBUILD.md](../../../deploy/PROJECT-ADMIN-SAAS-REBUILD.md) | Admin SaaS 전반 |
| [.cursor/rules/moabom-social-auth-admin-scope.mdc](../../../.cursor/rules/moabom-social-auth-admin-scope.mdc) | Cursor 에이전트 트리거 규칙 |

---

*마지막 갱신: host_scope + features SSOT 도입 (platform / tenant_subdomain)*
