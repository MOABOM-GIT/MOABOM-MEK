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
                [
                    'identifier' => 'balances',
                    'name' => [
                        'ko' => '유저 크레딧',
                        'en' => 'User Credits',
                    ],
                    'description' => [
                        'ko' => '유저 크레딧 조회·조정 권한',
                        'en' => 'User credit list and adjustment permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '유저 크레딧 조회',
                                'en' => 'Read User Credits',
                            ],
                            'description' => [
                                'ko' => '유저 크레딧 잔액 목록 조회',
                                'en' => 'Read user credit balance list',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'adjust',
                            'name' => [
                                'ko' => '유저 크레딧 조정',
                                'en' => 'Adjust User Credits',
                            ],
                            'description' => [
                                'ko' => '유저 크레딧 수동 증감',
                                'en' => 'Manually increase or decrease user credits',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                        [
                            'action' => 'delete',
                            'name' => [
                                'ko' => '유저 크레딧 삭제',
                                'en' => 'Delete User Credits',
                            ],
                            'description' => [
                                'ko' => '유저 크레딧 잔액·원장·출석 기록 완전 삭제',
                                'en' => 'Permanently delete user credit balances, ledger, and attendance records',
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
                    'ko' => '크레딧 관리',
                    'en' => 'Credit Management',
                ],
                'slug' => 'moabom-credit-settings',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/platform/settings/credit',
                'icon' => 'fas fa-coins',
                'order' => 40,
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
