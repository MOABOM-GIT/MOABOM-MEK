<?php

namespace Modules\Moabom\Credit;

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
                'ko' => '크레딧',
                'en' => 'Credit',
            ],
            'description' => [
                'ko' => '크레딧 모듈 권한',
                'en' => 'Credit module permissions',
            ],
            'categories' => [
                [
                    'identifier' => 'credits',
                    'name' => [
                        'ko' => '크레딧',
                        'en' => 'Credit',
                    ],
                    'description' => [
                        'ko' => '크레딧 조회 권한',
                        'en' => 'Credit read permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '크레딧 조회',
                                'en' => 'Read Credits',
                            ],
                            'description' => [
                                'ko' => '본인 크레딧 잔액과 내역 조회',
                                'en' => 'Read own credit balance and history',
                            ],
                            'type' => 'user',
                            'roles' => ['user'],
                        ],
                    ],
                ],
                [
                    'identifier' => 'settings',
                    'name' => [
                        'ko' => '환경설정',
                        'en' => 'Settings',
                    ],
                    'description' => [
                        'ko' => '크레딧 환경설정 권한',
                        'en' => 'Credit settings permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '환경설정 조회',
                                'en' => 'Read Settings',
                            ],
                            'description' => [
                                'ko' => '크레딧 환경설정 조회',
                                'en' => 'Read credit settings',
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
                                'ko' => '크레딧 환경설정 수정',
                                'en' => 'Update credit settings',
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
     */
    public function getAdminMenus(): array
    {
        return [
            [
                'name' => [
                    'ko' => '크레딧 설정',
                    'en' => 'Credit Settings',
                ],
                'slug' => 'moabom-credit-settings',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/platform/settings/credit',
                'icon' => 'fas fa-coins',
                'order' => 20,
                'permission' => 'moabom-credit.settings.read',
            ],
        ];
    }

    /**
     * 언인스톨 시 삭제할 동적 테이블 목록을 반환합니다.
     */
    public function getDynamicTables(): array
    {
        return [
            'moabom_credit_balances',
            'moabom_credit_transactions',
            'moabom_credit_attendances',
        ];
    }
}
