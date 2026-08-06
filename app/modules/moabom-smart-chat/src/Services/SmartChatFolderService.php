<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Moabom\Smart\Chat\Models\SmartChatConversation;
use Modules\Moabom\Smart\Chat\Models\SmartChatFolder;

class SmartChatFolderService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function list(User $user): array
    {
        return SmartChatFolder::query()
            ->where('user_id', $user->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (SmartChatFolder $f) => $this->serialize($f))
            ->values()
            ->all();
    }

    public function create(User $user, string $name): SmartChatFolder
    {
        $name = $this->normalizeName($name);
        $max = (int) config('moabom-smart-chat.folders.max_per_user', 30);
        $count = SmartChatFolder::query()->where('user_id', $user->id)->count();
        if ($count >= $max) {
            throw new InvalidArgumentException('messages.folders.limit');
        }

        $maxSort = (int) SmartChatFolder::query()->where('user_id', $user->id)->max('sort_order');

        return SmartChatFolder::query()->create([
            'user_id' => $user->id,
            'uuid' => (string) Str::uuid(),
            'name' => $name,
            'sort_order' => $maxSort + 1,
        ]);
    }

    public function findOwned(User $user, string $uuid): ?SmartChatFolder
    {
        return SmartChatFolder::query()
            ->where('user_id', $user->id)
            ->where('uuid', $uuid)
            ->first();
    }

    public function rename(SmartChatFolder $folder, string $name): SmartChatFolder
    {
        $folder->name = $this->normalizeName($name);
        $folder->save();

        return $folder;
    }

    public function delete(SmartChatFolder $folder): void
    {
        SmartChatConversation::query()
            ->where('folder_id', $folder->id)
            ->update(['folder_id' => null]);
        $folder->delete();
    }

    public function serialize(SmartChatFolder $folder): array
    {
        return [
            'uuid' => $folder->uuid,
            'name' => $folder->name,
            'sort_order' => $folder->sort_order,
        ];
    }

    private function normalizeName(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            throw new InvalidArgumentException('messages.folders.name_required');
        }
        $max = (int) config('moabom-smart-chat.folders.max_name_chars', 80);
        if (mb_strlen($name) > $max) {
            $name = mb_substr($name, 0, $max);
        }

        return $name;
    }
}
