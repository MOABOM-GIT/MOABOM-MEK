<?php

return [
    'apps' => [
        'ai' => [
            'generate_success' => 'AI 앱 HTML을 생성했습니다.',
            'notice' => [
                'default' => 'AI provider 설정 전까지 표시되는 기본 미리보기입니다.',
                'anthropic_no_key' => 'Anthropic API 키가 설정되지 않아 미리보기 HTML을 생성했습니다.',
                'anthropic_failed' => 'Anthropic API 호출에 실패해 미리보기 HTML을 생성했습니다.',
                'openai_no_key' => 'OpenAI API 키가 설정되지 않아 미리보기 HTML을 생성했습니다.',
                'openai_failed' => 'AI 생성 API 호출에 실패해 미리보기 HTML을 생성했습니다.',
                'google_no_key' => 'Google AI API 키가 설정되지 않아 미리보기 HTML을 생성했습니다.',
                'google_failed' => 'Google AI API 호출에 실패해 미리보기 HTML을 생성했습니다.',
            ],
        ],
        'generated' => [
            'fetch_success' => '생성 앱 목록을 조회했습니다.',
            'show_success' => '생성 앱을 조회했습니다.',
            'not_found' => '생성 앱을 찾을 수 없습니다.',
            'save_success' => '생성 앱을 저장했습니다.',
            'update_success' => '생성 앱을 수정했습니다.',
        ],
    ],
];
