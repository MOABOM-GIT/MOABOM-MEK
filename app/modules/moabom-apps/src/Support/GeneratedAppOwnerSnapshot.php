<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use App\Enums\UserStatus;
use Modules\Moabom\Apps\Models\GeneratedApp;

/**
 * admin 목록용 소유자 스냅샷.
 */
final class GeneratedAppOwnerSnapshot
{
    public function __construct(
        private readonly GeneratedAppOwnerResolver $ownerResolver,
    ) {}

    /**
     * @return array{user_id: int, nickname: string, status: string}
     */
    public function forApp(GeneratedApp $app): array
    {
        $user = $this->ownerResolver->resolveUser($app);
        $nickname = trim($this->ownerResolver->nickname($app));
        if ($nickname === '') {
            $nickname = (string) __('moabom-apps::messages.apps.generated.owner_unknown');
        }

        $status = 'unknown';
        if ($user !== null) {
            $raw = trim((string) ($user->status ?? ''));
            $status = $raw !== '' ? $raw : UserStatus::Active->value;
        }

        return [
            'user_id' => (int) $app->user_id,
            'nickname' => $nickname,
            'status' => $status,
        ];
    }
}
