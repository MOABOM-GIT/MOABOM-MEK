<?php

/*
 * moabom-apps 모듈 설정 (AI 프로바이더 매핑).
 *
 * 환경변수 이름(MOABOM_AI_*, MOABOM_ANTHROPIC_*, MOABOM_OPENAI_*, MOABOM_GOOGLE_AI_*)
 * 은 분리 이전(moabom-system)에 사용되던 값을 그대로 유지해 Cloud Run 운영 변수
 * 를 변경하지 않아도 되도록 한다(F1 호환).
 *
 * 참조: moabom-system 의 config/moabom-system.php `ai` 섹션에서 이관.
 */

return [
    'ai' => [
        'provider' => env('MOABOM_AI_PROVIDER', 'auto'),
        'anthropic_api_key' => env('MOABOM_ANTHROPIC_API_KEY'),
        'openai_api_key' => env('MOABOM_OPENAI_API_KEY'),
        'google_api_key' => env('MOABOM_GOOGLE_AI_API_KEY'),
        'models' => [
            'gemini-flash-lite' => [
                'provider' => 'google',
                'model' => env('MOABOM_GOOGLE_AI_MODEL_LITE', 'gemini-3.1-flash-lite'),
            ],
            'claude-sonnet' => [
                'provider' => 'anthropic',
                'model' => env('MOABOM_ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
            ],
            'gpt-chat-latest' => [
                'provider' => 'openai',
                'model' => env('MOABOM_OPENAI_MODEL_CHAT', 'gpt-5.1-chat-latest'),
            ],
            'gpt-4o' => [
                'provider' => 'openai',
                'model' => env('MOABOM_OPENAI_MODEL', 'gpt-5.1-chat-latest'),
            ],
            // Gemini 3.5 Flash는 생성 중 토큰/스트림 중단 빈도가 높아 운영 선택지에서 제외한다.
            // 'gemini-flash' => [
            //     'provider' => 'google',
            //     'model' => env('MOABOM_GOOGLE_AI_MODEL', 'gemini-3.5-flash'),
            // ],
        ],
        'timeout' => env('MOABOM_AI_TIMEOUT', 45),
        'stream_timeout' => env('MOABOM_AI_STREAM_TIMEOUT', 120),
        'max_output_tokens' => env('MOABOM_AI_MAX_OUTPUT_TOKENS', 30000),
        'stream_concurrency' => [
            'max_active' => env('MOABOM_AI_MAX_CONCURRENT_STREAMS', 24),
            'max_queue' => env('MOABOM_AI_MAX_QUEUE_SIZE', 100),
            'avg_generation_seconds' => env('MOABOM_AI_QUEUE_AVG_SECONDS', 90),
            'slot_ttl_seconds' => env('MOABOM_AI_STREAM_SLOT_TTL', 660),
            'ready_grant_ttl_seconds' => env('MOABOM_AI_QUEUE_READY_GRANT_TTL', 120),
            'ticket_ttl_seconds' => env('MOABOM_AI_QUEUE_TICKET_TTL', 900),
            'retry_after_seconds' => env('MOABOM_AI_QUEUE_RETRY_AFTER', 5),
        ],
    ],

    /*
     * AI 생성 앱 프리뷰 (GENERATED-APP-TIERS.md)
     *
     * routing=dedicated_host (기본): apps.mek360.com / {id}.apps.mek360.com
     * routing=tenant_path (레거시): {tenant-host}/modules/moabom-apps/preview/...
     */
    'preview' => [
        'routing' => env('MOABOM_APPS_PREVIEW_ROUTING', 'dedicated_host'),
        'scheme' => env('MOABOM_APPS_PREVIEW_SCHEME', 'https'),
        'standard_host' => env('MOABOM_APPS_PREVIEW_STANDARD_HOST', 'apps.mek360.com'),
        'hosted_apps_domain' => env('MOABOM_APPS_PREVIEW_HOSTED_APPS_DOMAIN', 'apps.mek360.com'),
        'hosted_base_domain' => env('MOABOM_APPS_PREVIEW_HOSTED_BASE_DOMAIN', 'mek360.com'),
        'shell_frame_ancestors' => array_values(array_filter(array_map(
            static fn (string $value): string => trim($value),
            explode(',', (string) env('MOABOM_APPS_PREVIEW_FRAME_ANCESTORS', 'https://mek360.com,https://www.mek360.com,https://*.mek360.com'))
        ))),
        'path_prefix' => '/modules/moabom-apps/preview',
        'access_token_ttl_seconds' => (int) env('MOABOM_APPS_PREVIEW_TOKEN_TTL', 7200),
    ],
];
