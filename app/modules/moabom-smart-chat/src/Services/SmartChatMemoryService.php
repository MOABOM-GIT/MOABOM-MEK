<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Moabom\Smart\Chat\Models\SmartChatConversation;
use Modules\Moabom\Smart\Chat\Models\SmartChatMemory;

/**
 * 사용자 선호 기억 — 1단 문장 목록. LLM 컨텍스트에 주입.
 */
class SmartChatMemoryService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function list(User $user): array
    {
        return SmartChatMemory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit((int) config('moabom-smart-chat.memory.max_per_user', 50))
            ->get()
            ->map(fn (SmartChatMemory $m) => $this->serialize($m))
            ->values()
            ->all();
    }

    public function add(User $user, string $content, ?SmartChatConversation $conversation = null): SmartChatMemory
    {
        $content = $this->normalizeContent($content);
        $max = (int) config('moabom-smart-chat.memory.max_per_user', 50);
        $count = SmartChatMemory::query()->where('user_id', $user->id)->count();
        if ($count >= $max) {
            // 가장 오래된 것 제거
            SmartChatMemory::query()
                ->where('user_id', $user->id)
                ->orderBy('id')
                ->limit(max(1, $count - $max + 1))
                ->delete();
        }

        return SmartChatMemory::query()->create([
            'user_id' => $user->id,
            'uuid' => (string) Str::uuid(),
            'content' => $content,
            'source_conversation_id' => $conversation?->id,
        ]);
    }

    public function findOwned(User $user, string $uuid): ?SmartChatMemory
    {
        return SmartChatMemory::query()
            ->where('user_id', $user->id)
            ->where('uuid', $uuid)
            ->first();
    }

    public function delete(SmartChatMemory $memory): void
    {
        $memory->delete();
    }

    /**
     * LLM 주입용 블록.
     */
    public function contextBlock(User $user): string
    {
        $items = SmartChatMemory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit((int) config('moabom-smart-chat.memory.max_inject', 20))
            ->get();

        if ($items->isEmpty()) {
            return '';
        }

        $lines = ['[user_memory]'];
        foreach ($items as $item) {
            $lines[] = '- '.$item->content;
        }

        return implode("\n", $lines);
    }

    public function serialize(SmartChatMemory $m): array
    {
        return [
            'uuid' => $m->uuid,
            'content' => $m->content,
            'created_at' => optional($m->created_at)?->toIso8601String(),
        ];
    }

    private function normalizeContent(string $content): string
    {
        $content = trim(preg_replace('/\s+/u', ' ', $content) ?? '');
        if ($content === '') {
            throw new InvalidArgumentException('messages.memory.content_required');
        }
        $max = (int) config('moabom-smart-chat.memory.max_chars', 500);
        if (mb_strlen($content) > $max) {
            $content = mb_substr($content, 0, $max);
        }

        return $content;
    }
}
