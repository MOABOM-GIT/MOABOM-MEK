<?php

namespace Modules\Moabom\Apps;

use App\Extension\AbstractModule;
use Modules\Moabom\Apps\Extension\MoabomAppsAdminMenus;

/**
 * moabom-apps 모듈 진입점.
 *
 * 책임:
 *   - 사용자별 AI 앱 생성/저장 (`/api/modules/moabom-apps/apps/ai|generated/*`).
 *   - DB 테이블 `moabom_system_generated_apps` (테이블명 보존: F1 호환).
 */
class Module extends AbstractModule
{
    public function getPermissions(): array
    {
        return [
            'name' => [
                'ko' => 'Moabom 앱',
                'en' => 'Moabom Apps',
            ],
            'description' => [
                'ko' => 'AI 생성앱 및 앱 모듈 권한',
                'en' => 'AI generated apps and apps module permissions',
            ],
            'categories' => [
                [
                    'identifier' => 'generated',
                    'name' => [
                        'ko' => 'AI 생성앱',
                        'en' => 'AI Generated Apps',
                    ],
                    'description' => [
                        'ko' => '관리자용 AI 생성앱 관리 권한',
                        'en' => 'Admin permissions for AI generated apps',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '생성앱 조회',
                                'en' => 'Read Generated Apps',
                            ],
                            'description' => [
                                'ko' => 'AI 생성앱 목록·상세 조회',
                                'en' => 'List and view AI generated apps',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'manage',
                            'name' => [
                                'ko' => '생성앱 관리',
                                'en' => 'Manage Generated Apps',
                            ],
                            'description' => [
                                'ko' => '공개 범위 변경·완전 삭제',
                                'en' => 'Change visibility and purge apps',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
                [
                    'identifier' => 'community',
                    'name' => [
                        'ko' => '앱 리뷰',
                        'en' => 'App Reviews',
                    ],
                    'description' => [
                        'ko' => '앱 리뷰 관리 권한',
                        'en' => 'App review management permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '앱 리뷰 조회',
                                'en' => 'Read App Review Posts',
                            ],
                            'description' => [
                                'ko' => '앱 리뷰 목록·상세 조회',
                                'en' => 'List and view app review posts',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'manage',
                            'name' => [
                                'ko' => '앱 리뷰 관리',
                                'en' => 'Manage App Review Posts',
                            ],
                            'description' => [
                                'ko' => '블라인드·삭제',
                                'en' => 'Hide and delete posts',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function getAdminMenus(): array
    {
        return MoabomAppsAdminMenus::menus();
    }

    /**
     * 언인스톨 시 삭제될 동적 테이블.
     * Phase 3 분리(2026-06-02): 테이블명은 보존하되 소유권을 moabom-apps 로 이관.
     */
    public function getDynamicTables(): array
    {
        return [
            'moabom_system_generated_apps',
            'moabom_generated_app_rows',
            'moabom_app_community_posts',
        ];
    }
}
