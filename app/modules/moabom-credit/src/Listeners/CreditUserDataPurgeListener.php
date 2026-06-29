<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Models\User;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

/**
 * 회원 삭제 전 크레딧 연관 데이터를 명시적으로 정리합니다.
 */
final class CreditUserDataPurgeListener implements HookListenerInterface
{
    public function __construct(
        private readonly CreditRepositoryInterface $creditRepository,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'core.user.before_delete' => [
                'method' => 'onBeforeUserDelete',
                'priority' => 50,
            ],
        ];
    }

    public function handle(...$args): void {}

    public function onBeforeUserDelete(...$args): void
    {
        $user = $args[0] ?? null;
        if (! $user instanceof User) {
            return;
        }

        $this->creditRepository->deleteAllDataForUser($user);
        MoabomPublicApiCacheKeys::forgetShellRankings();
    }
}
