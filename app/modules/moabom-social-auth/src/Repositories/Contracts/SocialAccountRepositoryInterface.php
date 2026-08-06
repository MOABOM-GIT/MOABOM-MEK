<?php

namespace Modules\Moabom\Social\Auth\Repositories\Contracts;

use App\Models\User;
use Modules\Moabom\Social\Auth\Models\SocialAccount;

interface SocialAccountRepositoryInterface
{
    /**
     * 제공자 사용자 ID로 SNS 계정을 조회합니다.
     */
    public function findByProviderUser(string $provider, string $providerUserId): ?SocialAccount;

    /**
     * SNS 계정을 생성하거나 갱신합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateOrCreateForUser(User $user, string $provider, string $providerUserId, array $data): SocialAccount;
}
