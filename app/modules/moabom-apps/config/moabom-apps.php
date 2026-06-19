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
    ],
];
