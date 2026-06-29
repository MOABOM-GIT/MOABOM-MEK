<?php

namespace Modules\Moabom\Chat;

use App\Extension\AbstractModule;
use Modules\Moabom\Chat\Listeners\ChatNotificationChannelListener;
use Modules\Moabom\Chat\Listeners\ChatNotificationDataListener;

class Module extends AbstractModule
{
    public function getPermissions(): array
    {
        return [
            'name' => [
                'ko' => '프로필 메시지',
                'en' => 'Profile Messages',
            ],
            'description' => [
                'ko' => '메시지방·메시지·차단 관리',
                'en' => 'Message threads, messages, and block management',
            ],
            'categories' => [
                [
                    'identifier' => 'chat',
                    'name' => [
                        'ko' => '메시지',
                        'en' => 'Messages',
                    ],
                    'description' => [
                        'ko' => '프로필 메시지 권한',
                        'en' => 'Profile message permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'use',
                            'name' => [
                                'ko' => '메시지 사용',
                                'en' => 'Use Messages',
                            ],
                            'description' => [
                                'ko' => '프로필 메시지 기능 사용',
                                'en' => 'Use profile messaging features',
                            ],
                            'type' => 'user',
                            'roles' => ['user'],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function getDynamicTables(): array
    {
        return [
            'moabom_chat_conversations',
            'moabom_chat_conversation_members',
            'moabom_chat_messages',
            'moabom_chat_user_blocks',
        ];
    }

    /**
     * @return array<int, class-string>
     */
    public function getHookListeners(): array
    {
        return [
            ChatNotificationDataListener::class,
            ChatNotificationChannelListener::class,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getNotificationDefinitions(): array
    {
        return [
            [
                'type' => 'chat_message',
                'hook_prefix' => 'moabom-chat',
                'name' => [
                    'ko' => '새 메시지',
                    'en' => 'New message',
                ],
                'description' => [
                    'ko' => '메시지방에 새 메시지가 도착하면 멤버에게 발송',
                    'en' => 'Sent to members when a new message arrives',
                ],
                'channels' => ['database'],
                'hooks' => ['moabom-chat.message.after_create'],
                'variables' => [
                    ['key' => 'name', 'description' => '수신자 이름'],
                    ['key' => 'sender_name', 'description' => '발신자 표시 이름'],
                    ['key' => 'sender_uuid', 'description' => '발신자 UUID'],
                    ['key' => 'conversation_uuid', 'description' => '메시지방 UUID'],
                    ['key' => 'message_preview', 'description' => '메시지 미리보기'],
                ],
                'templates' => [
                    [
                        'channel' => 'database',
                        'recipients' => [['type' => 'related_user', 'relation' => 'member']],
                        'click_url' => '/users/{sender_uuid}/chat?conversation={conversation_uuid}',
                        'subject' => [
                            'ko' => '새 메시지',
                            'en' => 'New message',
                        ],
                        'body' => [
                            'ko' => '{sender_name}: {message_preview}',
                            'en' => '{sender_name}: {message_preview}',
                        ],
                    ],
                ],
            ],
        ];
    }
}
