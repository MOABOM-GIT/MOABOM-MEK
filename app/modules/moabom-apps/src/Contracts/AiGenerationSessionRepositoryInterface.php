<?php

namespace Modules\Moabom\Apps\Contracts;

use Modules\Moabom\Apps\Models\AiGenerationSession;

interface AiGenerationSessionRepositoryInterface
{
    public function create(array $data): AiGenerationSession;

    public function findForUser(int $userId, int $id): ?AiGenerationSession;

    public function findActiveForUser(int $userId): ?AiGenerationSession;

    public function abandonActiveForUser(int $userId): void;

    public function update(AiGenerationSession $session, array $data): AiGenerationSession;

    public function deleteForGeneratedApp(int $userId, int $generatedAppId): void;

    public function deleteForUser(int $userId, int $id): bool;

    public function deleteStreamingForUser(int $userId): int;
}
