<?php

namespace Modules\Moabom\Social\Auth\Repositories;

use App\Models\User;
use Modules\Moabom\Social\Auth\Models\SocialAccount;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAccountRepositoryInterface;

class SocialAccountRepository implements SocialAccountRepositoryInterface
{
    /**
     * 제공자 사용자 ID로 SNS 계정을 조회합니다.
     */
    public function findByProviderUser(string $provider, string $providerUserId): ?SocialAccount
    {
        return SocialAccount::where('provider', $provider)
            ->where('provider_user_id', $providerUserId)
            ->first();
    }

    /**
     * 사용자와 제공자로 SNS 계정을 조회합니다.
     */
    public function findByUserAndProvider(User $user, string $provider): ?SocialAccount
    {
        return SocialAccount::where('user_id', $user->id)
            ->where('provider', $provider)
            ->first();
    }

    /**
     * SNS 계정을 생성하거나 갱신합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateOrCreateForUser(User $user, string $provider, string $providerUserId, array $data): SocialAccount
    {
        return SocialAccount::updateOrCreate(
            [
                'provider' => $provider,
                'provider_user_id' => $providerUserId,
            ],
            array_merge($data, [
                'user_id' => $user->id,
                'linked_at' => $data['linked_at'] ?? now(),
            ])
        );
    }
}
