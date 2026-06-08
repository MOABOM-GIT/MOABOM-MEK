<?php

namespace Modules\Moabom\Social\Auth\Repositories;

use App\Models\User;
use Modules\Moabom\Social\Auth\Models\SocialAuthCode;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAuthCodeRepositoryInterface;

class SocialAuthCodeRepository implements SocialAuthCodeRepositoryInterface
{
    /**
     * 일회용 교환 코드를 생성합니다.
     */
    public function create(User $user, string $provider, string $plainCode, \DateTimeInterface $expiresAt, bool $requiresProfileCompletion = false): SocialAuthCode
    {
        return SocialAuthCode::create([
            'user_id' => $user->id,
            'provider' => $provider,
            'code_hash' => hash('sha256', $plainCode),
            'requires_profile_completion' => $requiresProfileCompletion,
            'expires_at' => $expiresAt,
        ]);
    }

    /**
     * 사용 가능한 코드를 조회합니다.
     */
    public function findUsableByPlainCode(string $plainCode): ?SocialAuthCode
    {
        return SocialAuthCode::where('code_hash', hash('sha256', $plainCode))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    /**
     * 코드를 사용 처리합니다.
     */
    public function markUsed(SocialAuthCode $code): bool
    {
        return $code->update(['used_at' => now()]);
    }

    /**
     * 프로필 보완 완료를 기록합니다.
     */
    public function markProfileCompleted(SocialAuthCode $code): bool
    {
        return $code->update(['profile_completed_at' => now()]);
    }

    /**
     * 만료된 코드를 정리합니다.
     */
    public function deleteExpired(): int
    {
        return SocialAuthCode::where('expires_at', '<=', now())->delete();
    }
}
