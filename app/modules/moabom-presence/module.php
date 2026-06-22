<?php

namespace Modules\Moabom\Presence;

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
                'ko' => '접속·친구',
                'en' => 'Presence & Friends',
            ],
            'description' => [
                'ko' => '접속자·친구 모듈 권한',
                'en' => 'Presence and friends module permissions',
            ],
            'categories' => [
                [
                    'identifier' => 'friends',
                    'name' => [
                        'ko' => '친구',
                        'en' => 'Friends',
                    ],
                    'description' => [
                        'ko' => '친구 요청·수락·목록',
                        'en' => 'Friend requests and list',
                    ],
                    'permissions' => [
                        [
                            'action' => 'manage',
                            'name' => [
                                'ko' => '친구 관리',
                                'en' => 'Manage Friends',
                            ],
                            'description' => [
                                'ko' => '친구 요청·수락·삭제',
                                'en' => 'Send, accept, and remove friends',
                            ],
                            'type' => 'user',
                            'roles' => ['user'],
                        ],
                    ],
                ],
            ],
        ];
    }
}
