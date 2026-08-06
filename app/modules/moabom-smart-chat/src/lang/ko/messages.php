<?php

return [
    'models' => [
        'fetch_success' => '모델 목록을 조회했습니다.',
    ],
    'conversations' => [
        'fetch_success' => '대화 목록을 조회했습니다.',
        'create_success' => '대화를 만들었습니다.',
        'update_success' => '대화를 수정했습니다.',
        'delete_success' => '대화를 삭제했습니다.',
        'not_found' => '대화를 찾을 수 없습니다.',
        'untitled' => '새 대화',
    ],
    'folders' => [
        'fetch_success' => '폴더 목록을 조회했습니다.',
        'create_success' => '폴더를 만들었습니다.',
        'update_success' => '폴더를 수정했습니다.',
        'delete_success' => '폴더를 삭제했습니다.',
        'not_found' => '폴더를 찾을 수 없습니다.',
        'name_required' => '폴더 이름을 입력해 주세요.',
        'limit' => '폴더 개수 한도에 도달했습니다.',
    ],
    'memory' => [
        'fetch_success' => '메모리를 조회했습니다.',
        'create_success' => '기억했습니다.',
        'delete_success' => '메모리를 삭제했습니다.',
        'not_found' => '메모리를 찾을 수 없습니다.',
        'content_required' => '기억할 내용을 입력해 주세요.',
    ],
    'share' => [
        'fetch_success' => '공유 대화를 조회했습니다.',
        'enable_success' => '공유 링크를 만들었습니다.',
        'disable_success' => '공유를 해제했습니다.',
        'not_found' => '공유 링크를 찾을 수 없습니다.',
        'shared_at_label' => '공유일',
    ],
    'messages' => [
        'fetch_success' => '메시지를 조회했습니다.',
        'parent_not_found' => '분기 기준 메시지를 찾을 수 없습니다.',
    ],
    'tools' => [
        'fetch_success' => '툴 목록을 조회했습니다.',
    ],
    'handoff' => [
        'create_success' => '앱 제작 프롬프트를 생성했습니다.',
    ],
    'generated_apps' => [
        'fetch_success' => '생성앱 목록을 조회했습니다.',
    ],
    'attachment' => [
        'upload_success' => '첨부했습니다.',
        'upload_failed' => '첨부 업로드에 실패했습니다.',
        'unsupported_type' => '지원하지 않는 파일 형식입니다. (이미지·txt·md·csv·pdf)',
        'too_large' => '파일이 너무 큽니다.',
        'default_prompt' => '첨부한 파일을 해석해 주세요.',
    ],
    'preferences' => [
        'fetch_success' => '설정을 조회했습니다.',
        'save_success' => '설정을 저장했습니다.',
    ],
    'validation' => [
        'content_required' => '메시지 또는 첨부를 입력해 주세요.',
    ],
    'stream' => [
        'busy' => '지금은 AI 응답이 많아 잠시 후 다시 시도해 주세요.',
    ],
    'llm' => [
        'no_key' => 'AI API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.',
        'upstream_failed' => 'AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    ],
    'credit' => [
        'spend_description' => 'AI 스마트챗 사용',
        'insufficient' => '크레딧이 부족합니다.',
    ],
    'conversation' => [
        'untitled' => '새 대화',
    ],
];
