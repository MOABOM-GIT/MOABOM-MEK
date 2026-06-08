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
            'claude-sonnet' => [
                'provider' => 'anthropic',
                'model' => env('MOABOM_ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
            ],
            'gpt-4o' => [
                'provider' => 'openai',
                'model' => env('MOABOM_OPENAI_MODEL', 'gpt-4o'),
            ],
            'gemini-flash' => [
                'provider' => 'google',
                'model' => env('MOABOM_GOOGLE_AI_MODEL', 'gemini-2.5-flash-lite'),
            ],
        ],
        'timeout' => env('MOABOM_AI_TIMEOUT', 45),
    ],
];
