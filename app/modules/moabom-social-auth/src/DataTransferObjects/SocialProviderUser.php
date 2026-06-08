<?php

namespace Modules\Moabom\Social\Auth\DataTransferObjects;

class SocialProviderUser
{
    /**
     * SNS 제공자 사용자 정보입니다.
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $providerUserId,
        public readonly ?string $email,
        public readonly ?string $name,
        public readonly ?string $nickname,
        public readonly ?string $avatar,
        public readonly ?string $accessToken,
        public readonly ?string $refreshToken,
        public readonly ?\DateTimeInterface $tokenExpiresAt,
    ) {}
}
