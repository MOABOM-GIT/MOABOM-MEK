<?php

namespace Modules\Moabom\Apps\Repositories;

use Modules\Moabom\Apps\Contracts\AiGenerationSessionRepositoryInterface;
use Modules\Moabom\Apps\Models\AiGenerationSession;

class AiGenerationSessionRepository implements AiGenerationSessionRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): AiGenerationSession
    {
        return AiGenerationSession::query()->create($data);
    }

    public function findForUser(int $userId, int $id): ?AiGenerationSession
    {
        return AiGenerationSession::query()
            ->where('user_id', $userId)
            ->whereKey($id)
            ->first();
    }

    public function findResumableForUser(int $userId): ?AiGenerationSession
    {
        return AiGenerationSession::query()
            ->where('user_id', $userId)
            ->where(function ($query): void {
                $query->whereIn('status', ['active', 'streaming', 'paused'])
                    ->orWhere(function ($nested): void {
                        $nested->where('status', 'completed')->where('truncated', true);
                    });
            })
            ->whereNotNull('partial_raw')
            ->where('partial_raw', '!=', '')
            ->latest('updated_at')
            ->first();
    }

    public function findActiveForUser(int $userId): ?AiGenerationSession
    {
        return $this->findResumableForUser($userId);
    }

    public function abandonActiveForUser(int $userId): void
    {
        AiGenerationSession::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['active', 'streaming', 'paused'])
            ->update(['status' => 'abandoned']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(AiGenerationSession $session, array $data): AiGenerationSession
    {
        $session->update($data);

        return $session->fresh() ?? $session;
    }

    public function deleteForGeneratedApp(int $userId, int $generatedAppId): void
    {
        AiGenerationSession::query()
            ->where('user_id', $userId)
            ->where('generated_app_id', $generatedAppId)
            ->delete();
    }

    public function deleteForUser(int $userId, int $id): bool
    {
        return AiGenerationSession::query()
            ->where('user_id', $userId)
            ->whereKey($id)
            ->delete() > 0;
    }

    public function deleteStreamingForUser(int $userId): int
    {
        return AiGenerationSession::query()
            ->where('user_id', $userId)
            ->where('status', 'streaming')
            ->delete();
    }
}
