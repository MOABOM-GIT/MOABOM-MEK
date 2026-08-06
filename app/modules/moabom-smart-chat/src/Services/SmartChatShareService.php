<?php

namespace Modules\Moabom\Smart\Chat\Services;

use Illuminate\Support\Str;
use Modules\Moabom\Smart\Chat\Models\SmartChatConversation;
use Modules\Moabom\Smart\Chat\Models\SmartChatMessage;

/**
 * 읽기 전용 공유 링크 — share_token 기반 공개 조회.
 */
class SmartChatShareService
{
    public function enable(SmartChatConversation $conversation): array
    {
        if ($conversation->share_token === null || $conversation->share_token === '') {
            $conversation->share_token = (string) Str::uuid();
        }
        $conversation->share_enabled_at = now();
        $conversation->save();

        return $this->serializeShare($conversation);
    }

    public function disable(SmartChatConversation $conversation): void
    {
        $conversation->share_token = null;
        $conversation->share_enabled_at = null;
        $conversation->save();
    }

    public function findByToken(string $token): ?SmartChatConversation
    {
        $token = trim($token);
        if ($token === '' || ! preg_match('/^[0-9a-f-]{36}$/i', $token)) {
            return null;
        }

        return SmartChatConversation::query()
            ->where('share_token', $token)
            ->whereNotNull('share_enabled_at')
            ->first();
    }

    /**
     * @return array{conversation: array<string, mixed>, messages: list<array<string, mixed>>}
     */
    public function publicPayload(SmartChatConversation $conversation, int $limit = 100): array
    {
        $limit = max(1, min(200, $limit));
        $messages = SmartChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->whereIn('role', ['user', 'assistant'])
            ->where('status', 'complete')
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn (SmartChatMessage $m) => [
                'role' => $m->role,
                'content' => $m->content,
                'created_at' => optional($m->created_at)?->toIso8601String(),
            ])
            ->values()
            ->all();

        return [
            'conversation' => [
                'title' => $conversation->title,
                'model_id' => $conversation->model_id,
                'shared_at' => optional($conversation->share_enabled_at)?->toIso8601String(),
            ],
            'messages' => $messages,
        ];
    }

    public function serializeShare(SmartChatConversation $conversation): array
    {
        $token = $conversation->share_token;
        $enabled = $conversation->share_enabled_at !== null && $token;
        $path = $enabled ? '/api/modules/moabom-smart-chat/public/shares/'.$token : null;

        return [
            'enabled' => (bool) $enabled,
            'share_token' => $enabled ? $token : null,
            'share_path' => $path,
            'share_url' => $enabled && $path ? url($path) : null,
            'share_enabled_at' => optional($conversation->share_enabled_at)?->toIso8601String(),
        ];
    }
}
