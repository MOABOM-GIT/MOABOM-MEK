<?php

namespace Modules\Moabom\Apps\Services;

use Modules\Moabom\Apps\Contracts\AiGenerationSessionRepositoryInterface;
use Modules\Moabom\Apps\Models\AiGenerationSession;

class AiGenerationSessionService
{
    public function __construct(
        private readonly AiGenerationSessionRepositoryInterface $sessionRepository,
    ) {
    }

    /**
     * @param  array{prompt: string, app_type: string, model_id: string, generated_app_id?: int|null}  $data
     */
    public function begin(int $userId, array $data, ?int $sessionId = null): AiGenerationSession
    {
        if ($sessionId !== null) {
            $existing = $this->sessionRepository->findForUser($userId, $sessionId);
            if ($existing !== null) {
                return $this->sessionRepository->update($existing, [
                    'status' => 'streaming',
                    'app_type' => $data['app_type'],
                    'model_id' => $data['model_id'],
                ]);
            }
        }

        $this->sessionRepository->abandonActiveForUser($userId);

        return $this->sessionRepository->create([
            'user_id' => $userId,
            'status' => 'streaming',
            'app_type' => $data['app_type'],
            'model_id' => $data['model_id'],
            'generated_app_id' => $data['generated_app_id'] ?? null,
            'messages' => [],
            'partial_raw' => '',
            'truncated' => false,
            'finish_reason' => null,
        ]);
    }

    public function findActiveForUser(int $userId): ?AiGenerationSession
    {
        return $this->sessionRepository->findActiveForUser($userId);
    }

    public function findForUser(int $userId, int $id): ?AiGenerationSession
    {
        return $this->sessionRepository->findForUser($userId, $id);
    }

    public function persistProgress(
        AiGenerationSession $session,
        string $partialRaw,
        ?array $messages = null,
    ): AiGenerationSession {
        $payload = [
            'partial_raw' => $partialRaw,
            'status' => 'streaming',
        ];

        if ($messages !== null) {
            $payload['messages'] = $messages;
        }

        return $this->sessionRepository->update($session, $payload);
    }

    /**
     * @param  array<string, mixed>  $result
     */
    public function complete(AiGenerationSession $session, array $result, ?array $messages = null): AiGenerationSession
    {
        $truncated = (bool) ($result['truncated'] ?? false);

        return $this->sessionRepository->update($session, [
            'status' => $truncated ? 'paused' : 'completed',
            'partial_raw' => (string) ($result['raw'] ?? $session->partial_raw),
            'truncated' => $truncated,
            'finish_reason' => $result['finish_reason'] ?? null,
            'messages' => $messages ?? $session->messages,
        ]);
    }

    public function pause(AiGenerationSession $session, string $partialRaw): AiGenerationSession
    {
        return $this->sessionRepository->update($session, [
            'status' => 'paused',
            'partial_raw' => $partialRaw,
        ]);
    }

    public function linkGeneratedApp(AiGenerationSession $session, int $generatedAppId): AiGenerationSession
    {
        return $this->sessionRepository->update($session, [
            'generated_app_id' => $generatedAppId,
        ]);
    }

    public function deleteForGeneratedApp(int $userId, int $generatedAppId): void
    {
        $this->sessionRepository->deleteForGeneratedApp($userId, $generatedAppId);
    }

    public function cancelForUser(int $userId, int $id): bool
    {
        $session = $this->findForUser($userId, $id);
        if ($session === null) {
            return false;
        }

        if (! in_array($session->status, ['streaming', 'paused'], true)) {
            return false;
        }

        return $this->sessionRepository->deleteForUser($userId, $id);
    }

    public function cancelStreamingForUser(int $userId): int
    {
        return $this->sessionRepository->deleteStreamingForUser($userId);
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(AiGenerationSession $session, bool $includePartial = true): array
    {
        $payload = [
            'id' => $session->id,
            'status' => $session->status,
            'app_type' => $session->app_type,
            'model_id' => $session->model_id,
            'generated_app_id' => $session->generated_app_id,
            'truncated' => $session->truncated,
            'finish_reason' => $session->finish_reason,
            'messages' => $session->messages ?? [],
            'updated_at' => $session->updated_at?->toISOString(),
        ];

        if ($includePartial) {
            $payload['partial_raw'] = $session->partial_raw ?? '';
        }

        return $payload;
    }
}
