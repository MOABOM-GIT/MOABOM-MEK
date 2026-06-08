<?php

namespace Modules\Moabom\Social\Auth;

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
                'ko' => 'SNS 로그인',
                'en' => 'Social Auth',
            ],
            'description' => [
                'ko' => 'SNS 로그인 모듈 권한',
                'en' => 'Social authentication module permissions',
            ],
            'categories' => [
                [
                    'identifier' => 'settings',
                    'name' => [
                        'ko' => '환경설정',
                        'en' => 'Settings',
                    ],
                    'description' => [
                        'ko' => 'SNS 로그인 환경설정 권한',
                        'en' => 'Social authentication settings permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '환경설정 조회',
                                'en' => 'View Settings',
                            ],
                            'description' => [
                                'ko' => 'SNS 로그인 환경설정 조회',
                                'en' => 'View social authentication settings',
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
                                'ko' => 'SNS 로그인 환경설정 수정',
                                'en' => 'Update social authentication settings',
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
     * `platform-settings` 부모는 `moabom-system`이 등록합니다. 이 모듈은 SNS 항목만 같은 부모 아래에 둡니다.
     */
    public function getAdminMenus(): array
    {
        return [
            [
                'name' => [
                    'ko' => 'SNS 연결설정',
                    'en' => 'Social Connections',
                ],
                'slug' => 'moabom-social-auth-settings',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/platform/settings/social-auth',
                'icon' => 'fas fa-share-alt',
                'order' => 10,
                'permission' => 'moabom-social-auth.settings.read',
            ],
        ];
    }
}
