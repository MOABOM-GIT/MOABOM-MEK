<?php

/*
 * AI 스마트챗 — 채팅 전용 설정.
 * LLM 키·모델 맵은 moabom-apps.ai 를 재사용한다 (운영 env 공유).
 * 스트림 동시성은 create-app 게이트와 분리된 키를 쓴다.
 */

return [
    'default_model_id' => env('MOABOM_SMART_CHAT_DEFAULT_MODEL', 'gemini-flash-lite'),
    'system_prompt' => env(
        'MOABOM_SMART_CHAT_SYSTEM_PROMPT',
        'You are Moabom AI Smart Chat, a helpful assistant. Reply in the user\'s language. Be concise and practical.',
    ),
    'max_history_messages' => (int) env('MOABOM_SMART_CHAT_MAX_HISTORY', 40),
    'max_output_tokens' => (int) env('MOABOM_SMART_CHAT_MAX_OUTPUT_TOKENS', 4096),
    'stream_timeout' => (int) env('MOABOM_SMART_CHAT_STREAM_TIMEOUT', 120),
    'stream_concurrency' => [
        'max_active' => (int) env('MOABOM_SMART_CHAT_MAX_CONCURRENT', 16),
        'per_user' => 1,
        'slot_ttl_seconds' => (int) env('MOABOM_SMART_CHAT_SLOT_TTL', 180),
    ],
    // 대화(chat) 특화 · Claude/ChatGPT/Gemini × 상위·하위 = 6
    'allowed_model_ids' => [
        'claude-sonnet',
        'claude-haiku',
        'gpt-chat-latest',
        'gpt-chat-mini',
        'gemini-flash',
        'gemini-flash-lite',
    ],
    'attachments' => [
        'max_per_turn' => 4,
        'max_image_bytes' => (int) env('MOABOM_SMART_CHAT_MAX_IMAGE_BYTES', 10 * 1024 * 1024),
        'max_document_bytes' => (int) env('MOABOM_SMART_CHAT_MAX_DOC_BYTES', 8 * 1024 * 1024),
        'max_extracted_chars' => 40000,
        'history_image_turns' => 2,
    ],
    'preferences' => [
        'max_instructions_chars' => 4000,
    ],
    'folders' => [
        'max_per_user' => 30,
        'max_name_chars' => 80,
    ],
    'memory' => [
        'max_per_user' => 50,
        'max_inject' => 20,
        'max_chars' => 500,
    ],
    'tools' => [
        // 사이트 도구는 function calling(pull) — LLM 이 필요할 때만 계정 권한 범위에서 조회
        'site_allowlist' => ['profile', 'weather', 'credit', 'apps'],
        'default_enabled' => ['profile', 'weather', 'credit', 'apps'],
        'function_calling' => [
            // 턴당 도구 호출 라운드 상한 — 초과 시 도구 없이 텍스트 답변 강제
            'max_iterations' => (int) env('MOABOM_SMART_CHAT_TOOL_MAX_ITERATIONS', 3),
        ],
        'data_query' => [
            // 범용 데이터 카탈로그 쿼리 도구 (query_platform_data)
            'enabled' => (bool) env('MOABOM_SMART_CHAT_DATA_QUERY', true),
            'max_rows' => (int) env('MOABOM_SMART_CHAT_DATA_QUERY_MAX_ROWS', 50),
        ],
        'credit' => [
            'lookback_days' => (int) env('MOABOM_SMART_CHAT_CREDIT_LOOKBACK_DAYS', 90),
        ],
        'apps' => [
            'ranking_limit' => (int) env('MOABOM_SMART_CHAT_APPS_RANKING_LIMIT', 10),
        ],
        'weather_fallback' => [
            'lat' => (float) env('MOABOM_SMART_CHAT_WEATHER_LAT', 37.5665),
            'lon' => (float) env('MOABOM_SMART_CHAT_WEATHER_LON', 126.9780),
        ],
        'generated_app' => [
            'max_html_chars' => 12000,
        ],
        'web_search' => [
            'enabled' => (bool) env('MOABOM_SMART_CHAT_WEB_SEARCH', true),
            'timeout' => 6,
            'max_query_chars' => 200,
            'max_results' => 5,
            'max_context_chars' => 4000,
        ],
    ],
];
