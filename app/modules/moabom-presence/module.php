<?php

namespace Modules\Moabom\Presence;

use App\Extension\AbstractModule;
use Modules\Moabom\Presence\Listeners\FriendshipNotificationDataListener;

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

    /**
     * @return array<int, class-string>
     */
    public function getHookListeners(): array
    {
        return [
            FriendshipNotificationDataListener::class,
        ];
    }

    /**
     * 친구 요청 알림 정의 — ModuleManager 가 activate/update 시 동기화.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getNotificationDefinitions(): array
    {
        return [
            [
                'type' => 'friend_request',
                'hook_prefix' => 'moabom-presence',
                'name' => [
                    'ko' => '친구 요청',
                    'en' => 'Friend Request',
                ],
                'description' => [
                    'ko' => '다른 사용자가 친구 요청을 내면 수신자에게 발송',
                    'en' => 'Sent when another user sends a friend request',
                ],
                'channels' => ['database'],
                'hooks' => ['moabom-presence.friendship.after_request'],
                'variables' => [
                    ['key' => 'name', 'description' => '수신자 이름'],
                    ['key' => 'app_name', 'description' => '사이트명'],
                    ['key' => 'requester_name', 'description' => '요청자 표시 이름'],
                    ['key' => 'site_url', 'description' => '사이트 URL'],
                ],
                'templates' => [
                    [
                        'channel' => 'database',
                        'recipients' => [['type' => 'related_user', 'relation' => 'addressee']],
                        'subject' => [
                            'ko' => '친구 요청',
                            'en' => 'Friend request',
                        ],
                        'body' => [
                            'ko' => '{requester_name}님이 친구 요청을 보냈습니다.',
                            'en' => '{requester_name} sent you a friend request.',
                        ],
                    ],
                ],
            ],
        ];
    }
}
