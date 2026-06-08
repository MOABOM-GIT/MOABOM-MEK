<?php

/*
 * SaaS 플래그 SSOT — config:cache 시 env() 가 여기만 평가됨.
 *
 * moabom-system.config 의 saas.* 는 config('moabom-saas.*') 를 참조한다.
 * @see deploy/ssot/moabom-system.config.php
 */

return [
    'enabled' => env('MOABOM_SAAS_ENABLED', false),
    'base_domain' => env('MOABOM_SAAS_BASE_DOMAIN', 'mek360.com'),
    'platform_hosts' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('MOABOM_SAAS_PLATFORM_HOSTS', 'mek360.com,www.mek360.com,auth.mek360.com')),
    ))),
    'platform_database' => env('MOABOM_PLATFORM_DATABASE', 'moabom-platform'),
    // tenant bootstrap 후에도 cross-query SSOT (SNS master credential 등)
    'platform_write_database' => env('DB_WRITE_DATABASE', 'moabom-db'),
    'registry_cache_ttl' => (int) env('MOABOM_SAAS_REGISTRY_CACHE_TTL', 60),
    'dev_tenant_slug' => env('MOABOM_SAAS_DEV_TENANT_SLUG', ''),
    // module 카테고리 storage backend 기본값은 db 고정.
    // 과거 gcs 분기 재진입 시 split-brain 재발 이력이 있어 운영은 db 단일 경로만 허용.
    // @see deploy/AGENT-FAILURE-ANALYSIS.md §10~§13
    'module_settings_backend' => env('MOABOM_SAAS_MODULE_SETTINGS_BACKEND', 'db'),
    // A안 — 테넌트 language_packs 카탈로그를 platform 단일 SSOT로 read-through.
    // true 시 테넌트 DB 의 language_packs 는 platform 테이블을 가리키는 VIEW 가 되어
    // mirror/싱크 없이도 항상 일치한다 (그누보드7 코어 무수정 — DB 객체 레벨 routing).
    // 기본 false: 기존 mirror 경로 유지(안전 롤백).
    'shared_language_packs' => filter_var(
        env('MOABOM_SAAS_SHARED_LANGUAGE_PACKS', false),
        FILTER_VALIDATE_BOOL,
    ),
];
