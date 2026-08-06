<?php

namespace Modules\Moabom\System;

use App\Extension\AbstractModule;

class Module extends AbstractModule
{
    /**
     * 모듈 권한 목록을 반환합니다.
     */
    public function getPermissions(): array
    {
        return [
            'name' => [
                'ko' => '마이페이지·시스템 설정',
                'en' => 'My Page & System Settings',
            ],
            'description' => [
                'ko' => '마이페이지 설정·홈 배경·사용자 시스템 설정 권한',
                'en' => 'My Page settings, home backgrounds, and user system settings',
            ],
            'categories' => [
                [
                    'identifier' => 'settings',
                    'name' => [
                        'ko' => '환경설정',
                        'en' => 'Settings',
                    ],
                    'description' => [
                        'ko' => '마이페이지 설정 관리 권한',
                        'en' => 'My Page settings management permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '환경설정 조회',
                                'en' => 'Read Settings',
                            ],
                            'description' => [
                                'ko' => '마이페이지 설정 조회',
                                'en' => 'Read My Page settings',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'update',
                            'name' => [
                                'ko' => '환경설정 수정',
                                'en' => 'Update Settings',
                            ],
                            'description' => [
                                'ko' => '마이페이지 설정 수정',
                                'en' => 'Update My Page settings',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
                [
                    'identifier' => 'user-settings',
                    'name' => [
                        'ko' => '사용자 설정',
                        'en' => 'User Settings',
                    ],
                    'description' => [
                        'ko' => '본인 시스템 설정 관리 권한',
                        'en' => 'Manage own system settings',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '내 설정 조회',
                                'en' => 'Read Own Settings',
                            ],
                            'description' => [
                                'ko' => '본인 시스템 설정 조회',
                                'en' => 'Read own system settings',
                            ],
                            'type' => 'user',
                            'roles' => ['user'],
                        ],
                        [
                            'action' => 'update',
                            'name' => [
                                'ko' => '내 설정 수정',
                                'en' => 'Update Own Settings',
                            ],
                            'description' => [
                                'ko' => '본인 시스템 설정 수정',
                                'en' => 'Update own system settings',
                            ],
                            'type' => 'user',
                            'roles' => ['user'],
                        ],
                    ],
                ],
                [
                    'identifier' => 'saas',
                    'name' => [
                        'ko' => 'SaaS 업체',
                        'en' => 'SaaS Companies',
                    ],
                    'description' => [
                        'ko' => 'mek360.com 플랫폼 전용 업체 프로비저닝',
                        'en' => 'Platform-only company provisioning',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '업체 목록 조회',
                                'en' => 'List Companies',
                            ],
                            'description' => [
                                'ko' => '등록된 SaaS 업체 테넌트 조회',
                                'en' => 'Read SaaS company tenants',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'create',
                            'name' => [
                                'ko' => '업체 추가',
                                'en' => 'Add Company',
                            ],
                            'description' => [
                                'ko' => '신규 업체 테넌트 프로비저닝',
                                'en' => 'Provision new company tenant',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'purge',
                            'name' => [
                                'ko' => '업체 데이터 정리',
                                'en' => 'Purge Company Data',
                            ],
                            'description' => [
                                'ko' => 'DB·Storage 운영 데이터 정리 (baseline 유지)',
                                'en' => 'Purge tenant runtime DB/Storage data while keeping baseline',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'destroy',
                            'name' => [
                                'ko' => '업체 전체 삭제',
                                'en' => 'Destroy Company',
                            ],
                            'description' => [
                                'ko' => '레지스트리·DB·GCS 완전 제거',
                                'en' => 'Fully remove tenant registry, database, and storage',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
                [
                    'identifier' => 'realtime',
                    'name' => [
                        'ko' => 'Realtime VM',
                        'en' => 'Realtime VM',
                    ],
                    'description' => [
                        'ko' => 'mek360.com 플랫폼 Realtime VM(Reverb) 모니터링',
                        'en' => 'Platform Realtime VM (Reverb) monitoring',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => 'Realtime VM 조회',
                                'en' => 'Read Realtime VM',
                            ],
                            'description' => [
                                'ko' => 'Realtime VM WebSocket probe·런타임 엔드포인트 조회',
                                'en' => 'Read Realtime VM WebSocket probe and runtime endpoints',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * 관리자 메뉴 정의를 반환합니다.
     *
     * `platform-settings` 부모 행은 이 모듈이 한 번만 등록합니다.
     * 다른 Moabom 모듈은 동일 slug 없이 `parent_slug`로 같은 부모 아래 형제 메뉴만 둡니다.
     */
    public function getAdminMenus(): array
    {
        return \Modules\Moabom\System\Extension\MoabomSystemAdminMenus::forCurrentRequest();
    }

    /**
     * @return array<int, class-string>
     */
    public function getHookListeners(): array
    {
        return [
            \Modules\Moabom\System\Listeners\SaasSettingsRuntimeRestoreListener::class,
            \Modules\Moabom\System\Listeners\SiteLogoAttachmentListener::class,
            \Modules\Moabom\System\Listeners\DeclarativeMenuOrderGuardListener::class,
            \Modules\Moabom\System\Listeners\NotificationRealtimeStateListener::class,
            \Modules\Moabom\System\Listeners\NotificationPolicyListener::class,
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    public function getSchedules(): array
    {
        return [
            [
                'command' => 'moabom:notification-cleanup',
                'schedule' => 'daily',
                'description' => '알림 보관기간·사용자당 최대 건수 정리',
            ],
        ];
    }

    /**
     * 언인스톨 시 삭제할 동적 테이블 목록을 반환합니다.
     */
    public function getDynamicTables(): array
    {
        return [
            'moabom_system_user_settings',
        ];
    }
}
