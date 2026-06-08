<?php

namespace Modules\Moabom\Social\Auth\Repositories\Contracts;

use App\Models\User;
use Modules\Moabom\Social\Auth\Models\SocialAuthCode;

interface SocialAuthCodeRepositoryInterface
{
    /**
     * 일회용 교환 코드를 생성합니다.
     */
    public function create(User $user, string $provider, string $plainCode, \DateTimeInterface $expiresAt, bool $requiresProfileCompletion = false): SocialAuthCode;

    /**
     * 사용 가능한 코드를 조회합니다.
     */
    public function findUsableByPlainCode(string $plainCode): ?SocialAuthCode;

    /**
     * 코드를 사용 처리합니다.
     */
    public function markUsed(SocialAuthCode $code): bool;

    /**
     * 프로필 보완 완료를 기록합니다.
     */
    public function markProfileCompleted(SocialAuthCode $code): bool;

    /**
     * 만료된 코드를 정리합니다.
     */
    public function deleteExpired(): int;
}
