<?php

return [
    'home_background' => [
        'gd_required' => '이미지 처리를 위해 PHP GD 확장이 필요합니다.',
        'invalid_type' => 'JPEG, PNG 이미지만 업로드할 수 있습니다. (WebP는 서버 GD에 WebP 지원이 있을 때만 가능)',
        'webp_not_supported' => '이 서버는 WebP 이미지를 처리할 수 없습니다. JPEG 또는 PNG로 업로드해 주세요.',
        'storage_write_failed' => '이미지 저장 경로에 쓸 수 없습니다. storage/app/modules/moabom-system 권한을 확인해 주세요.',
        'empty_file' => '빈 파일입니다.',
        'decode_failed' => '이미지를 읽을 수 없습니다.',
        'invalid_dimensions' => '이미지 크기가 올바르지 않습니다.',
        'encode_failed' => '이미지 인코딩에 실패했습니다.',
        'upload_success' => '홈 배경 이미지를 등록했습니다.',
        'upload_failed' => '홈 배경 이미지 등록에 실패했습니다.',
        'delete_success' => '홈 배경 이미지를 삭제했습니다.',
        'delete_failed' => '홈 배경 이미지 삭제에 실패했습니다.',
    ],
    'validation' => [
        'invalid_background_image_id' => '배경 식별자는 1~13 또는 업로드된 이미지의 UUID여야 합니다.',
    ],
    'settings' => [
        'fetch_success' => '마이페이지 설정을 조회했습니다.',
        'save_success' => '마이페이지 설정을 저장했습니다.',
        'save_failed' => '마이페이지 설정 저장에 실패했습니다.',
        'clear_cache_success' => '마이페이지 설정 캐시를 초기화했습니다.',
    ],
    'user' => [
        'fetch_success' => '사용자 시스템 설정을 조회했습니다.',
        'save_success' => '사용자 시스템 설정을 저장했습니다.',
    ],
    'public_defaults' => [
        'fetch_success' => '플랫폼 기본 설정을 조회했습니다.',
    ],
    'public_shell_boot' => [
        'fetch_success' => '셸 부트 데이터를 조회했습니다.',
    ],
    'extension_boot_meta' => [
        'fetch_success' => '확장 부트 메타를 조회했습니다.',
    ],
    'shell_routes' => [
        'fetch_success' => '셸용 라우트 스냅샷을 조회했습니다.',
        'template_not_found' => '템플릿을 찾을 수 없습니다: :template',
        'routes_not_found' => '템플릿 routes.json 을 찾을 수 없습니다.',
        'invalid_json' => 'routes.json 이 올바른 JSON 이 아닙니다.',
        'unknown_error' => '라우트 데이터를 불러오지 못했습니다.',
    ],
    'shell_rankings' => [
        'usage_accepted' => '앱 사용량을 반영했습니다.',
        'apps_fetch_success' => '앱 순위를 조회했습니다.',
        'users_fetch_success' => '유저 순위를 조회했습니다.',
    ],
    'saas' => [
        'hospitals' => [
            'list_success' => '등록된 업체 목록을 조회했습니다.',
            'show_success' => '업체 정보를 조회했습니다.',
            'created' => '업체 테넌트를 추가했습니다.',
            'not_found' => '업체를 찾을 수 없습니다.',
            'validation_failed' => '업체 추가 요청이 올바르지 않습니다.',
            'provision_failed' => '업체 프로비저닝에 실패했습니다.',
            'packages_success' => '업체 패키지 카탈로그를 조회했습니다.',
            'usage_success' => '업체 용량 정보를 조회했습니다.',
            'usage_failed' => '업체 용량 측정에 실패했습니다.',
            'purge_success' => '업체 데이터 정리가 완료되었습니다.',
            'purge_failed' => '업체 데이터 정리에 실패했습니다.',
            'purge_validation_failed' => '데이터 정리 확인 입력값이 올바르지 않습니다.',
            'destroy_success' => '업체가 완전히 삭제되었습니다.',
            'destroy_failed' => '업체 삭제에 실패했습니다.',
            'destroy_validation_failed' => '삭제 확인 입력값이 올바르지 않습니다.',
            'operation_success' => '작업 상태를 조회했습니다.',
            'operation_not_found' => '작업 기록을 찾을 수 없습니다.',
        ],
    ],
    // 'apps.*' 키 전체는 별도 모듈로 분리되었다(2026-06-02).
    // - apps.ai.*, apps.generated.*: moabom-apps
    // - apps.cpap.*: moabom-cpap
];
