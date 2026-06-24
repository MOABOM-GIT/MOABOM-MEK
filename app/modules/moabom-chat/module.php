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
                'ko' => '프로필 대화',
                'en' => 'Profile Chat',
            ],
            'description' => [
                'ko' => '대화방·메시지·대화거부 관리',
                'en' => 'Conversation, message, and chat block management',
            ],
            'categories' => [
                [
                    'identifier' => 'chat',
                    'name' => [
                        'ko' => '대화',
                        'en' => 'Chat',
                    ],
                    'description' => [
                        'ko' => '프로필 대화 권한',
                        'en' => 'Profile chat permissions',
                    ],
                    'permissions' => [
                        [
                            'action' => 'use',
                            'name' => [
                                'ko' => '대화 사용',
                                'en' => 'Use Chat',
                            ],
                            'description' => [
                                'ko' => '프로필 대화 기능 사용',
                                'en' => 'Use profile chat features',
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
                    'ko' => '새 대화 메시지',
                    'en' => 'New chat message',
                ],
                'description' => [
                    'ko' => '대화방에 새 메시지가 도착하면 멤버에게 발송',
                    'en' => 'Sent to members when a new chat message arrives',
                ],
                'channels' => ['database'],
                'hooks' => ['moabom-chat.message.after_create'],
                'variables' => [
                    ['key' => 'name', 'description' => '수신자 이름'],
                    ['key' => 'sender_name', 'description' => '발신자 표시 이름'],
                    ['key' => 'sender_uuid', 'description' => '발신자 UUID'],
                    ['key' => 'conversation_uuid', 'description' => '대화방 UUID'],
                    ['key' => 'message_preview', 'description' => '메시지 미리보기'],
                ],
                'templates' => [
                    [
                        'channel' => 'database',
                        'recipients' => [['type' => 'related_user', 'relation' => 'member']],
                        'click_url' => '/users/{sender_uuid}/chat?conversation={conversation_uuid}',
                        'subject' => [
                            'ko' => '새 대화 메시지',
                            'en' => 'New chat message',
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
