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
                'ko' => '마이앱 및 앱 모듈 권한',
                'en' => 'My apps and apps module permissions',
            ],
            'categories' => [
                [
                    'identifier' => 'generated',
                    'name' => [
                        'ko' => '마이앱',
                        'en' => 'My apps',
                    ],
                    'description' => [
                        'ko' => '관리자용 마이앱 관리 권한',
                        'en' => 'Admin permissions for my app management',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '마이앱 조회',
                                'en' => 'Read my apps',
                            ],
                            'description' => [
                                'ko' => '마이앱 목록·상세 조회',
                                'en' => 'List and view my apps',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'manage',
                            'name' => [
                                'ko' => '마이앱 관리',
                                'en' => 'Manage my apps',
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
     * 앱 리뷰 알림 정의.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getNotificationDefinitions(): array
    {
        return [
            [
                'type' => 'app_review_created',
                'hook_prefix' => 'moabom-apps',
                'name' => ['ko' => '앱 리뷰 등록 알림', 'en' => 'App Review Notification'],
                'description' => [
                    'ko' => '마이앱에 새 리뷰가 등록되면 앱 제작자에게 발송합니다.',
                    'en' => 'Sent to the app creator when a new review is posted on their app.',
                ],
                'channels' => ['database'],
                'hooks' => ['moabom-apps.community_review.after_create'],
                'variables' => [
                    ['key' => 'name', 'description' => '수신자 이름'],
                    ['key' => 'app_name', 'description' => '사이트명'],
                    ['key' => 'app_title', 'description' => '앱 제목'],
                    ['key' => 'review_author', 'description' => '리뷰 작성자'],
                    ['key' => 'review_title', 'description' => '리뷰 제목'],
                    ['key' => 'review_body', 'description' => '리뷰 본문 요약'],
                    ['key' => 'app_url', 'description' => '앱 리뷰 창 URL'],
                    ['key' => 'site_url', 'description' => '사이트 URL'],
                ],
                'templates' => [
                    [
                        'channel' => 'database',
                        'subject' => [
                            'ko' => '내 앱에 새 리뷰가 등록되었습니다',
                            'en' => 'New review on your app',
                        ],
                        'body' => [
                            'ko' => '{review_author}님이 \'{app_title}\' 앱에 리뷰를 남겼습니다: {review_title}',
                            'en' => '{review_author} posted a review on your app "{app_title}": {review_title}',
                        ],
                        'click_url' => '{app_url}',
                    ],
                ],
            ],
        ];
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
