<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Plugins\Moabom\Fcm\Enums\FcmPlatform;
use Plugins\Moabom\Fcm\Models\FcmDeviceToken;

final class FcmDeviceTokenService
{
    /**
     * @param  array{token: string, platform?: string, device_label?: string|null, user_agent?: string|null, tenant_id?: int|null}  $payload
     */
    public function register(User $user, array $payload): FcmDeviceToken
    {
        $token = trim($payload['token']);
        $platform = FcmPlatform::tryFrom((string) ($payload['platform'] ?? 'web')) ?? FcmPlatform::Web;

        /** @var FcmDeviceToken $row */
        $row = FcmDeviceToken::query()->updateOrCreate(
            ['token' => $token],
            [
                'user_id' => $user->id,
                'tenant_id' => $payload['tenant_id'] ?? $this->resolveTenantId(),
                'platform' => $platform->value,
                'device_label' => $payload['device_label'] ?? null,
                'user_agent' => isset($payload['user_agent'])
                    ? mb_substr((string) $payload['user_agent'], 0, 512)
                    : null,
                'last_seen_at' => now(),
            ],
        );

        return $row;
    }

    public function deleteForUser(User $user, string $token): bool
    {
        return FcmDeviceToken::query()
            ->where('user_id', $user->id)
            ->where('token', $token)
            ->delete() > 0;
    }

    /**
     * @return Collection<int, FcmDeviceToken>
     */
    public function tokensForUser(User $user): Collection
    {
        return FcmDeviceToken::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_seen_at')
            ->get();
    }

    /**
     * @param  list<string>  $tokens
     */
    public function deleteTokens(array $tokens): int
    {
        if ($tokens === []) {
            return 0;
        }

        return FcmDeviceToken::query()
            ->whereIn('token', $tokens)
            ->delete();
    }

    private function resolveTenantId(): ?int
    {
        if (! class_exists(\Modules\Moabom\System\Saas\TenantContext::class)) {
            return null;
        }

        try {
            if (! app()->bound(\Modules\Moabom\System\Saas\TenantContext::class)) {
                return null;
            }

            $tenant = app(\Modules\Moabom\System\Saas\TenantContext::class)->tenant();

            return $tenant?->id;
        } catch (\Throwable) {
            return null;
        }
    }
}
