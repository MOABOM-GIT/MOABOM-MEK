<?php

/*
 * moabom-system 모듈 설정 (SSOT overlay — Cloud Build 시 modules/moabom-system/config/ 로 복사).
 *
 * SaaS 플래그는 app/config/moabom-saas.php (config:cache 대상)만 env()를 읽는다.
 */

return [
    // 'ai' 섹션 → moabom-apps 모듈로 분리(2026-06-02). config('moabom-apps.ai.*') / env 이름 보존.
    // 'weather' 섹션 → moabom-weather 플러그인으로 분리(2026-06-02). config('moabom-weather.*') / env 이름 보존.

    'shell_rankings' => [
        'period_hours' => 24,
        'limit' => 30,
        'cache_ttl' => 300,
        'open_hit_weight' => 10,
        'snapshot_retention_hours' => 168,
        'max_events_per_request' => 20,
        'max_open_hits_per_event' => 5,
        'max_active_seconds_per_event' => 1800,
        'user_activity' => [
            'post_weight' => 50,
            'comment_weight' => 20,
        ],
        'change_cache_ttl' => 86400,
        'ingest' => [
            'signed_token_required' => false,
            'max_requests_per_ip_per_minute' => 60,
            'max_requests_per_ip_per_minute_without_token' => 12,
        ],
    ],

    'decomposition_compat' => [
        'enabled' => filter_var(
            env('MOABOM_DECOMPOSITION_COMPAT', true),
            FILTER_VALIDATE_BOOL
        ),
    ],

    'boot_asset_ghost' => [
        'enabled' => env('MOABOM_BOOT_ASSET_GHOST', true),
        'user_template' => env('MOABOM_BOOT_ASSET_GHOST_TEMPLATE', 'moabom-basic'),
        'strip_deferred_on_request_paths' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('MOABOM_BOOT_ASSET_GHOST_PATHS', ''))
        ))) ?: ['', 'login', 'register', 'forgot-password', 'reset-password'],
        'slim_settings_on_same_paths' => env('MOABOM_BOOT_ASSET_GHOST_SLIM_SETTINGS', true),
        'home_shell_deferred_module_allowlist' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('MOABOM_BOOT_ASSET_GHOST_MODULE_ALLOWLIST', ''))
        ))),
        'strip_deferred_plugins_on_same_paths' => env('MOABOM_BOOT_ASSET_GHOST_STRIP_PLUGINS', true),
        'home_shell_deferred_plugin_allowlist' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('MOABOM_BOOT_ASSET_GHOST_PLUGIN_ALLOWLIST', ''))
        ))),
    ],

    'saas' => [
        'enabled' => (bool) config('moabom-saas.enabled', false),
        'base_domain' => (string) config('moabom-saas.base_domain', 'mek360.com'),
        'platform_hosts' => (array) config('moabom-saas.platform_hosts', ['mek360.com', 'www.mek360.com']),
        'platform_database' => (string) config('moabom-saas.platform_database', 'moabom-platform'),
        'registry_cache_ttl' => (int) config('moabom-saas.registry_cache_ttl', 60),
        'dev_tenant_slug' => (string) config('moabom-saas.dev_tenant_slug', ''),
        // module 카테고리 storage backend는 db 단일 경로가 SSOT.
        // @see deploy/AGENT-FAILURE-ANALYSIS.md §10~§13
        'module_settings_backend' => (string) config('moabom-saas.module_settings_backend', 'db'),
        // A안 — language_packs 카탈로그를 platform 단일 SSOT로 read-through(테넌트 DB는 VIEW).
        // true: 테넌트 language_packs = platform 테이블을 가리키는 VIEW (mirror 불필요).
        // false(기본): 기존 mirror(TenantLanguagePackMirror) 경로 유지 — 안전 롤백 가능.
        // @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md §A
        'shared_language_packs' => (bool) config('moabom-saas.shared_language_packs', false),
        'provision' => [
            'schema_source_db' => env('MOABOM_SAAS_SCHEMA_SOURCE_DB', env('MOABOM_SAAS_CLONE_SOURCE_DB', 'moabom-db')),
            'storage_owner' => env('MOABOM_SAAS_PROVISION_STORAGE_OWNER', 'www-data'),
            'appearance_defaults' => [
                'enabled' => filter_var(env('MOABOM_SAAS_PROVISION_APPEARANCE_DEFAULTS', true), FILTER_VALIDATE_BOOL),
                'strict' => filter_var(env('MOABOM_SAAS_PROVISION_APPEARANCE_STRICT', true), FILTER_VALIDATE_BOOL),
                'snapshot_path' => env(
                    'MOABOM_SAAS_PROVISION_APPEARANCE_SNAPSHOT',
                    'saas/provision-defaults/appearance.json'
                ),
                'blob_seed_prefix' => env(
                    'MOABOM_SAAS_PROVISION_APPEARANCE_BLOB_PREFIX',
                    'saas/provision-defaults/home-backgrounds'
                ),
            ],
        ],
        'deprovision' => [
            'usage_cache_ttl' => (int) env('MOABOM_SAAS_USAGE_CACHE_TTL', 300),
            'protected_slugs' => array_values(array_filter(array_map(
                'trim',
                explode(',', (string) env('MOABOM_SAAS_DEPROVISION_PROTECTED_SLUGS', 'e2etest,smoke'))
            ))),
        ],
    ],
];
