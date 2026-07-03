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
    'website_link' => [
        // 셸 img 서빙용 icon_token TTL(초). 기본 30일 — 저장·조회 시 재발급.
        'icon_access_token_ttl_seconds' => (int) env('MOABOM_APPS_WEBSITE_ICON_TOKEN_TTL', 2_592_000),
    ],

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

    /*
     * 앱 SEO/AI 노출 (메인 사이트 /app/{id} · /apps 봇 전용 서버렌더).
     *
     * 노출 범위: 기본 제공 앱(AppRegistry + builtin 보강) + 전역 공개(visibility=global)
     * SEO 노출 대상: 전역 공개 마이앱만. private/tenant 마이앱은 절대 비노출.
     */
    'seo' => [
        'enabled' => filter_var(env('MOABOM_APPS_SEO_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

        // 전역 공개 마이앱의 중복콘텐츠 방지용 canonical 호스트(빈 값이면 app.url 사용).
        'canonical_base' => trim((string) env('MOABOM_APPS_SEO_CANONICAL_BASE', '')),

        // 메인 사이트 셸 경로.
        'detail_path_prefix' => '/app',
        'index_path' => '/apps',

        // 사이트맵에 포함할 전역 공개 마이앱 최대 개수.
        'max_generated' => (int) env('MOABOM_APPS_SEO_MAX_GENERATED', 1000),

        // robots.txt(/llms.txt) 동적 서빙 여부(코어 미보유 — 모듈이 제공).
        'serve_robots' => filter_var(env('MOABOM_APPS_SEO_SERVE_ROBOTS', true), FILTER_VALIDATE_BOOLEAN),

        // SEO 비노출 기본앱 id(개인/시스템 페이지 등).
        'exclude' => ['mypage'],

        /*
         * app.json 미보유 기본 제공 앱 보강 카탈로그.
         * AppRegistry(app.json)로 집계되지 않는 템플릿 전용 앱만 여기에 선언한다.
         */
        'builtin' => [
            [
                'id' => 'hospital-info',
                'category' => 'basic',
                'name' => ['ko' => '병원 정보', 'en' => 'Hospital Info'],
                'description' => [
                    'ko' => '병원 위치·진료 정보를 빠르게 찾아보는 모아봄 기본 앱',
                    'en' => 'Find hospital locations and care information quickly on MOABOM',
                ],
                'keywords' => ['병원', '병원정보', 'hospital', 'clinic'],
                'icon' => 'hospital',
                'order' => 1,
            ],
            [
                'id' => 'create-app',
                'category' => 'basic',
                'name' => ['ko' => 'AI 앱 만들기', 'en' => 'Create AI App'],
                'description' => [
                    'ko' => '설명만 입력하면 AI가 나만의 웹앱을 즉시 만들어 주는 모아봄 앱 생성기',
                    'en' => 'Describe what you need and AI instantly builds your own web app on MOABOM',
                ],
                'keywords' => ['AI 앱', '앱 만들기', 'ai app builder', 'no-code', 'web app'],
                'icon' => 'magic',
                'order' => 2,
            ],
        ],

        /*
         * AI 크롤러 User-Agent 토큰(부분 일치). core.seo.resolve_is_bot 훅에서 봇으로 판정.
         */
        'ai_crawler_user_agents' => [
            'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
            'Google-Extended', 'GoogleOther',
            'PerplexityBot', 'Perplexity-User',
            'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'Claude-User', 'Claude-SearchBot',
            'CCBot', 'Bytespider', 'Amazonbot', 'Applebot-Extended',
            'cohere-ai', 'Diffbot', 'ImagesiftBot', 'Meta-ExternalAgent', 'meta-externalagent',
            'YouBot', 'DuckAssistBot', 'Timpibot', 'Kangaroo Bot', 'MistralAI-User',
        ],
    ],
];
