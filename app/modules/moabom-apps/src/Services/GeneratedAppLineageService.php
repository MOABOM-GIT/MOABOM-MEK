<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppOwnerResolver;

/**
 * 생성앱 parent_app_id 체인 — 원제작자부터 현재 앱까지 제작자 목록.
 */
final class GeneratedAppLineageService
{
    private const MAX_DEPTH = 32;

    public function __construct(
        private readonly GeneratedAppRepositoryInterface $appRepository,
        private readonly GeneratedAppOwnerResolver $ownerResolver,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function creatorsForApp(int $appId): array
    {
        $chain = $this->resolveChain($appId);
        if ($chain === []) {
            return [];
        }

        $creators = [];
        $lastIndex = count($chain) - 1;

        foreach ($chain as $index => $app) {
            $user = $this->ownerResolver->resolveUser($app);
            $nickname = trim($this->ownerResolver->nickname($app));
            if ($nickname === '') {
                $nickname = __('moabom-apps::messages.apps.generated.owner_unknown');
            }

            $creators[] = [
                'generated_app_id' => (int) $app->id,
                'role' => $index === 0 ? 'original' : 'remix',
                'is_current' => $index === $lastIndex,
                'owner' => [
                    'id' => (int) $app->user_id,
                    'uuid' => $user?->uuid ? (string) $user->uuid : null,
                    'nickname' => $nickname,
                ],
            ];
        }

        return $creators;
    }

    /**
     * @return list<GeneratedApp>
     */
    private function resolveChain(int $appId): array
    {
        $apps = [];
        $visited = [];
        $currentId = $appId;

        for ($depth = 0; $depth < self::MAX_DEPTH && $currentId > 0; $depth++) {
            if (isset($visited[$currentId])) {
                break;
            }
            $visited[$currentId] = true;

            $app = $this->appRepository->findById($currentId);
            if ($app === null) {
                break;
            }

            $apps[] = $app;
            $parentId = $app->parent_app_id !== null ? (int) $app->parent_app_id : 0;
            $currentId = $parentId > 0 ? $parentId : 0;
        }

        return array_reverse($apps);
    }
}
